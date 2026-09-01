import { ICameraStreamingService } from './ICameraStreamingService';
import { FrameStats, CameraSettings } from '../../types/camera';
import { CameraHealthState } from '../../types/camera-health';
import { CameraCaptureService } from './CameraCaptureService';
import { UploadWorker } from './UploadWorker';
import { CameraLogger } from '../../utils/logger';

export class CameraStreamingService implements ICameraStreamingService {
  private stats: FrameStats = {
    currentFps: 0,
    targetFps: 2,
    framesSent: 0,
    droppedFrames: 0,
    overwriteFrames: 0,
    staleFrames: 0,
    capturedFrames: 0,
    captureFailures: 0,
    avgEncodeTimeMs: 0,
    avgSendTimeMs: 0,
    frameRoundTripMs: 0,
    serverProcessingMs: 0,
    serverQueueMs: 0,
    socketBufferPeakBytes: 0,
    currentCaptureIntervalMs: 500,
    lastFrameTime: Date.now(),
    resolution: '640x360',
  };

  private statsListeners: Set<(stats: FrameStats) => void> = new Set();
  private healthListeners: Set<(state: CameraHealthState) => void> = new Set();

  private captureService: CameraCaptureService | null = null;
  private uploadWorker: UploadWorker | null = null;
  private activeState: CameraHealthState = CameraHealthState.Idle;

  // For calculating real FPS
  private frameTimestamps: number[] = [];
  private unsubCaptureState: (() => void) | null = null;
  private unsubUploadResult: (() => void) | null = null;


  public startRealStream(cameraRef: any, settings: CameraSettings): void {
    this.stopRealStream();

    this.stats.targetFps = settings.targetFps;
    this.stats.framesSent = 0;
    this.stats.droppedFrames = 0;
    this.stats.overwriteFrames = 0;
    this.stats.staleFrames = 0;
    this.stats.capturedFrames = 0;
    this.stats.captureFailures = 0;
    this.stats.avgEncodeTimeMs = 0;
    this.stats.avgSendTimeMs = 0;
    this.stats.socketBufferPeakBytes = 0;
    this.stats.currentCaptureIntervalMs = 500;
    this.stats.resolution = settings.resolution === '480p' ? '640x360' : settings.resolution === '720p' ? '1280x720' : '1920x1080';
    this.stats.lastFrameTime = Date.now();
    this.frameTimestamps = [];

    // Instantiate Services
    this.captureService = new CameraCaptureService();
    this.uploadWorker = new UploadWorker();

    // Setup Capture Callback
    this.captureService.setCaptureCallback((frame) => {
      if (this.uploadWorker) {
        this.uploadWorker.enqueue(frame);
        this.stats.overwriteFrames = this.uploadWorker.getOverwriteCount();
        this.stats.droppedFrames = this.uploadWorker.getDroppedFrameCount();
      }

      // Accumulate real capture & failure counts from service
      this.stats.capturedFrames = this.captureService?.getCaptureCount() ?? this.stats.capturedFrames;
      this.stats.captureFailures = this.captureService?.getFailureCount() ?? this.stats.captureFailures;

      // Calculate real FPS
      const now = Date.now();
      this.frameTimestamps.push(now);
      this.frameTimestamps = this.frameTimestamps.filter(t => now - t < 2000);
      this.stats.currentFps = Math.round((this.frameTimestamps.length / 2) * 10) / 10;
      this.stats.lastFrameTime = now;

      // Real capture duration EMA
      this.stats.avgEncodeTimeMs =
        this.stats.avgEncodeTimeMs === 0
          ? frame.captureDurationMs
          : Math.round(0.7 * this.stats.avgEncodeTimeMs + 0.3 * frame.captureDurationMs);

      this.notifyStatsListeners();
    });

    // Listen to capture state changes
    this.unsubCaptureState = this.captureService.onStateChange((state) => {
      this.setHealthState(state);
      // Sync capture failures on every state change so failures are reflected immediately (Fix 2)
      if (this.captureService) {
        this.stats.captureFailures = this.captureService.getFailureCount();
        this.notifyStatsListeners();
      }
    });

    // Listen to upload results
    this.unsubUploadResult = this.uploadWorker.onUploadResult((result) => {
      if (result.success) {
        this.stats.framesSent += 1;
        this.stats.avgSendTimeMs =
          this.stats.avgSendTimeMs === 0
            ? result.durationMs
            : Math.round(0.7 * this.stats.avgSendTimeMs + 0.3 * result.durationMs);

        try {
          const { ConnectionServiceFactory } = require('../connection/ConnectionServiceFactory');
          const connService = ConnectionServiceFactory.getInstance();
          const currentBuffer = connService.getBufferedAmount ? connService.getBufferedAmount() : 0;
          this.stats.socketBufferPeakBytes = Math.max(this.stats.socketBufferPeakBytes, currentBuffer);
          const latency = connService.getFrameLatency?.();
          if (latency) {
            this.stats.frameRoundTripMs = latency.roundTripMs;
            this.stats.serverProcessingMs = latency.serverMs;
            this.stats.serverQueueMs = latency.queueMs;
          }
        } catch {
          // ignore
        }
      }
      
      if (this.uploadWorker) {
        this.stats.staleFrames = this.uploadWorker.getStaleFrameCount();
        this.stats.droppedFrames = this.uploadWorker.getDroppedFrameCount();
        this.stats.overwriteFrames = this.uploadWorker.getOverwriteCount();
      }
      this.notifyStatsListeners();
    });

    // Resolve capture options — streaming target: 640×360 @ quality 0.25 (16:9 native)
    let quality = 0.25;
    let width = 640;
    let height = 360;
    if (settings.resolution === '720p') {
      quality = 0.15;
      width = 1280;
      height = 720;
    } else if (settings.resolution === '1080p') {
      quality = 0.25;
      width = 1920;
      height = 1080;
    }

    this.uploadWorker.start();
    this.captureService.start(cameraRef, { quality, maxWidth: width, maxHeight: height });
  }

  public handleFrameSampled(frameData: { base64: string; width: number; height: number; timestamp: number; captureDurationMs?: number }): void {
    if (this.uploadWorker) {
      this.setHealthState(CameraHealthState.Streaming);
      this.stats.resolution = `${frameData.width}x${frameData.height}`;
      this.uploadWorker.enqueue({
        base64: frameData.base64,
        width: frameData.width,
        height: frameData.height,
        captureDurationMs: frameData.captureDurationMs ?? 0,
        timestamp: frameData.timestamp,
      });
      this.stats.overwriteFrames = this.uploadWorker.getOverwriteCount();
      this.stats.droppedFrames = this.uploadWorker.getDroppedFrameCount();
      this.stats.capturedFrames += 1;
      this.stats.avgEncodeTimeMs = Math.round(frameData.captureDurationMs ?? 0);

      const now = Date.now();
      this.frameTimestamps.push(now);
      this.frameTimestamps = this.frameTimestamps.filter(t => now - t < 2000);
      this.stats.currentFps = Math.round((this.frameTimestamps.length / 2) * 10) / 10;
      this.stats.lastFrameTime = now;
      this.notifyStatsListeners();
    }
  }

  public stopRealStream(): void {
    if (this.captureService) {
      this.captureService.stop();
      this.captureService = null;
    }
    if (this.uploadWorker) {
      this.uploadWorker.stop();
      this.uploadWorker = null;
    }

    if (this.unsubCaptureState) {
      this.unsubCaptureState();
      this.unsubCaptureState = null;
    }
    if (this.unsubUploadResult) {
      this.unsubUploadResult();
      this.unsubUploadResult = null;
    }

    this.stats.currentFps = 0;
    this.setHealthState(CameraHealthState.Idle);
    this.notifyStatsListeners();
  }

  public getFrameStats(): FrameStats {
    return { ...this.stats };
  }

  public getHealthState(): CameraHealthState {
    return this.activeState;
  }

  private setHealthState(newState: CameraHealthState): void {
    if (this.activeState === newState) return;
    this.activeState = newState;
    this.notifyHealthListeners();
  }

  public onStatsUpdate(listener: (stats: FrameStats) => void): () => void {
    this.statsListeners.add(listener);
    return () => this.statsListeners.delete(listener);
  }

  public onHealthStateChange(listener: (state: CameraHealthState) => void): () => void {
    this.healthListeners.add(listener);
    return () => this.healthListeners.delete(listener);
  }

  private notifyStatsListeners(): void {
    if (CameraCaptureService.STATIC_CAMERA_UI) return;
    const statsCopy = this.getFrameStats();
    this.statsListeners.forEach((l) => l(statsCopy));
  }

  private notifyHealthListeners(): void {
    const state = this.getHealthState();
    this.healthListeners.forEach((l) => l(state));
  }
}
