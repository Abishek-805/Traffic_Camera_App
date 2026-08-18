import { CameraHealthState } from '../../types/camera-health';
import { CameraLogger } from '../../utils/logger';

/** Frames older than this are discarded — stale traffic data is worse than no data */
const MAX_FRAME_AGE_MS = 2000;

/** Drop frame if WebSocket bufferedAmount exceeds this (bytes) */
const MAX_SOCKET_BUFFER_BYTES = 256 * 1024; // 256 KB

export interface CaptureResult {
  frameId?: string;
  base64: string;
  width: number;
  height: number;
  captureDurationMs: number;
  timestamp: number;
}

export interface UploadResult {
  success: boolean;
  error?: string;
  retryCount: number;
  durationMs: number;
}

export interface UploadWorkerConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  uploadTimeoutMs: number;
}

const defaultConfig: UploadWorkerConfig = {
  maxQueueSize: 1,
  maxRetries: 3,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 5000,
  uploadTimeoutMs: 10000,
};

export class UploadWorker {
  private frameIdCounter: number = 0;
  private latestFrame: CaptureResult | null = null;
  private isProcessing: boolean = false;
  private config: UploadWorkerConfig;
  private consecutiveUploadFailures: number = 0;
  private maxConsecutiveUploadFailures: number = 10;
  private uploadCount: number = 0;
  private uploadFailureCount: number = 0;
  private stats_staleFrames: number = 0;
  private stats_droppedFrames: number = 0;
  private stats_overwriteFrames: number = 0;
  private listeners: Set<(result: UploadResult) => void> = new Set();
  private onStateChange: ((state: CameraHealthState) => void) | null = null;
  private isStopped: boolean = true;

  constructor(config?: Partial<UploadWorkerConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  public enqueue(frame: CaptureResult): boolean {
    if (this.isStopped) return false;
    
    // Assign monotonic frame ID at selection time if not already assigned
    if (!frame.frameId) {
      try {
        const { ConnectionServiceFactory } = require('../../services/connection/ConnectionServiceFactory');
        const connService = ConnectionServiceFactory.getInstance();
        const info = connService.getConnectionInfo();
        const direction = info?.assignedLane?.split(' ')[0]?.toUpperCase() || 'NORTH';
        this.frameIdCounter = (this.frameIdCounter || 0) + 1;
        const formattedCounter = String(this.frameIdCounter).padStart(6, '0');
        frame.frameId = `${direction}-${formattedCounter}`;
      } catch {
        this.frameIdCounter = (this.frameIdCounter || 0) + 1;
        frame.frameId = `NORTH-${String(this.frameIdCounter).padStart(6, '0')}`;
      }
    }

    CameraLogger.log('FRAME_SELECTED', { frameId: frame.frameId, timestamp: frame.timestamp });
    CameraLogger.log('FRAME_ENCODED', { frameId: frame.frameId, base64Length: frame.base64.length });

    // Single-slot buffer: Track queue overwrite when buffer already holds a frame
    if (this.latestFrame !== null) {
      this.stats_overwriteFrames += 1;
    }
    this.latestFrame = frame;
    CameraLogger.log('FRAME_QUEUED', { frameId: frame.frameId, queueSize: this.getQueueSize() });
    this.processUpload();
    return true;
  }

  public setOnStateChange(callback: (state: CameraHealthState) => void): void {
    this.onStateChange = callback;
  }

  public onUploadResult(listener: (result: UploadResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(): void {
    this.isStopped = false;
    this.latestFrame = null;
    this.isProcessing = false;
  }

  public stop(): void {
    this.isStopped = true;
    this.latestFrame = null;
    this.isProcessing = false;
  }

  public getQueueSize(): number {
    return this.latestFrame ? 1 : 0;
  }

  public getUploadCount(): number {
    return this.uploadCount;
  }

  public getUploadFailureCount(): number {
    return this.uploadFailureCount;
  }

  private async processUpload(): Promise<void> {
    if (this.isProcessing) return;
    if (this.isStopped) return;
    if (!this.latestFrame) return;

    this.isProcessing = true;

    try {
      while (this.latestFrame && !this.isStopped) {
        // Extract the frame and clear the slot so newer frames can land
        const frame = this.latestFrame;
        this.latestFrame = null;

        // --- Frame freshness gate (P0 fix) ---
        const frameAge = Date.now() - frame.timestamp;
        if (frameAge > MAX_FRAME_AGE_MS) {
          this.stats_staleFrames += 1;
          CameraLogger.log('Frame discarded: stale', { frameAgeMs: frameAge, maxAgeMs: MAX_FRAME_AGE_MS });
          continue; // drop and check for a newer frame
        }

        await this.uploadFrame(frame);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async uploadFrame(frame: CaptureResult): Promise<void> {
    const startTime = Date.now();

    // --- Single attempt for video frames: latest-frame-wins, no retries ---
    try {
      const { ConnectionServiceFactory } = require('../../services/connection/ConnectionServiceFactory');
      const connService = ConnectionServiceFactory.getInstance();
      const info = connService.getConnectionInfo();

      if (connService.getState() !== 'STREAMING' && connService.getState() !== 'REGISTERED') {
        CameraLogger.log('Upload skipped: not in STREAMING or REGISTERED state');
        return;
      }

      // --- Backpressure gate (P0 fix) ---
      const buffered = typeof connService.getBufferedAmount === 'function' ? connService.getBufferedAmount() : 0;
      if (buffered > MAX_SOCKET_BUFFER_BYTES) {
        CameraLogger.log('Frame dropped: socket backpressure', { bufferedAmount: buffered, threshold: MAX_SOCKET_BUFFER_BYTES });
        this.stats_droppedFrames += 1;
        return;
      }

      // Final freshness check (frame may have aged while waiting behind another upload)
      const frameAgeAtSend = Date.now() - frame.timestamp;
      if (frameAgeAtSend > MAX_FRAME_AGE_MS) {
        this.stats_staleFrames += 1;
        CameraLogger.log('Frame discarded: stale at send time', { frameAgeMs: frameAgeAtSend });
        return;
      }

      const direction = info?.assignedLane?.split(' ')[0]?.toLowerCase() || 'north';
      const uploadTimestamp = Date.now();
      const frameAgeMs = uploadTimestamp - frame.timestamp;
      const frameId = frame.frameId || `NORTH-${String(this.frameIdCounter).padStart(6, '0')}`;

      const sent = connService.sendMessage({
        version: '1.0',
        type: 'VIDEO_FRAME',
        timestamp: uploadTimestamp,
        payload: {
          node_id: info?.cameraId || 'CAM-001',
          frame_id: frameId,
          direction: direction,
          camera_direction: direction,
          frame_data: frame.base64,
          timestamp: uploadTimestamp / 1000,
          capture_timestamp: frame.timestamp,
          upload_timestamp: uploadTimestamp,
          frame_age_ms: frameAgeMs,
          capture_timestamp_iso: new Date(frame.timestamp).toISOString(),
        },
      });

      if (sent === false) {
        // Drop rejected by WebSocketConnectionService backpressure check
        this.stats_droppedFrames += 1;
        CameraLogger.log('VIDEO_FRAME_DROPPED', { frameId, reason: 'backpressure' });
        return;
      }

      CameraLogger.log('VIDEO_FRAME_SENT', { frameId, timestamp: uploadTimestamp });

      this.uploadCount += 1;
      this.consecutiveUploadFailures = 0;

      const duration = Date.now() - startTime;
      CameraLogger.log('Upload succeeded', { frameId, durationMs: duration });

      this.notifyListeners({
        success: true,
        retryCount: 0,
        durationMs: duration,
      });
    } catch (e: any) {
      this.uploadFailureCount += 1;
      this.consecutiveUploadFailures += 1;

      CameraLogger.log('Upload failed', {
        error: e.message || String(e),
        consecutiveFailures: this.consecutiveUploadFailures,
      });

      if (this.consecutiveUploadFailures >= this.maxConsecutiveUploadFailures) {
        CameraLogger.log('Upload error: Max consecutive upload failures reached', {
          count: this.consecutiveUploadFailures,
        });
      }

      this.notifyListeners({
        success: false,
        error: e.message || String(e),
        retryCount: 0,
        durationMs: Date.now() - startTime,
      });
    }
  }

  public getStaleFrameCount(): number {
    return this.stats_staleFrames;
  }

  public getDroppedFrameCount(): number {
    return this.stats_droppedFrames;
  }

  public getOverwriteCount(): number {
    return this.stats_overwriteFrames;
  }

  public getTotalDrops(): number {
    return this.stats_staleFrames + this.stats_droppedFrames + this.stats_overwriteFrames;
  }

  private notifyListeners(result: UploadResult): void {
    this.listeners.forEach((l) => l(result));
  }
}