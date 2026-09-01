import { ICameraCaptureService, CaptureResult, CaptureOptions } from './ICameraCaptureService';
import { CameraHealthState } from '../../types/camera-health';
import { CameraMode } from '../../types/camera';
import { CameraLogger } from '../../utils/logger';

export class CameraCaptureService implements ICameraCaptureService {
  public static CAMERA_PREVIEW_ONLY: boolean = false;
  public static STATIC_CAMERA_UI: boolean = false;
  public static ACTIVE_CAMERA_MODE: CameraMode = CameraMode.VISION_CAMERA;
  public static takePictureAsync_calls: number = 0;

  private state: CameraHealthState = CameraHealthState.Idle;
  private captureTimer: NodeJS.Timeout | null = null;
  private isCapturing: boolean = false;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 5;
  private baseIntervalMs: number = 500;
  private captureCount: number = 0;
  private successCount: number = 0;
  private failureCount: number = 0;
  private listeners: Set<(state: CameraHealthState) => void> = new Set();
  private onCaptureCallback: ((result: CaptureResult) => void) | null = null;
  private isStopped: boolean = true;
  private cameraRef: any = null;
  private options: CaptureOptions = { quality: 0.5, maxWidth: 1920, maxHeight: 1080 };
  private restartCount: number = 0;
  private maxRestarts: number = 3;
  private restartWindowMs: number = 30000; // max 3 restarts per 30s
  private lastRestartTime: number = 0;

  constructor() {}

  public getState(): CameraHealthState {
    return this.state;
  }

  public getCaptureCount(): number {
    return this.captureCount;
  }

  public getSuccessCount(): number {
    return this.successCount;
  }

  public getFailureCount(): number {
    return this.failureCount;
  }

  public setCaptureCallback(callback: (result: CaptureResult) => void): void {
    this.onCaptureCallback = callback;
  }

  public setBaseInterval(ms: number): void {
    this.baseIntervalMs = Math.max(100, ms);
  }

  public start(cameraRef: any, options: CaptureOptions): void {
    this.isStopped = false;
    this.cameraRef = cameraRef;
    this.options = options;
    CameraLogger.log('Camera started');
    this.setState(CameraHealthState.Starting);
    this.setState(CameraHealthState.Ready);
    if (CameraCaptureService.ACTIVE_CAMERA_MODE === CameraMode.LEGACY_SNAPSHOT) {
      this.scheduleNextCapture(this.baseIntervalMs);
    }
  }

  public stop(): void {
    if (this.isStopped) return;
    this.isStopped = true;
    this.cleanupTimers();
    this.isCapturing = false;
    this.cameraRef = null;
    CameraLogger.log('Camera stopped');
    this.setState(CameraHealthState.Stopped);
  }

  public pause(): void {
    this.cleanupTimers();
    this.isCapturing = false;
    this.setState(CameraHealthState.Idle);
  }

  public resume(cameraRef: any, options: CaptureOptions): void {
    if (this.isStopped) return;
    this.cameraRef = cameraRef;
    this.options = options;
    this.setState(CameraHealthState.Ready);
    this.scheduleNextCapture(this.baseIntervalMs);
  }

  private cleanupTimers(): void {
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }
  }

  private scheduleNextCapture(delayMs: number): void {
    if (this.isStopped) return;
    this.cleanupTimers();
    this.captureTimer = setTimeout(() => {
      this.executeCapture();
    }, delayMs);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        CameraLogger.log('CAPTURE_TIMEOUT', { timeoutMs });
        reject(new Error(`Camera capture timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async executeCapture(): Promise<void> {
    if (this.isStopped) return;

    if (CameraCaptureService.ACTIVE_CAMERA_MODE === CameraMode.VISION_CAMERA) {
      // ARCHITECTURAL GUARD: Structural bypass of takePictureAsync() in VisionCamera mode
      CameraLogger.log('CAPTURE_SKIPPED_VISION_CAMERA_MODE', { timestamp: Date.now(), takePictureAsync_calls: CameraCaptureService.takePictureAsync_calls });
      this.scheduleNextCapture(1000);
      return;
    }

    if (CameraCaptureService.ACTIVE_CAMERA_MODE === CameraMode.PREVIEW_ONLY || CameraCaptureService.CAMERA_PREVIEW_ONLY) {
      CameraLogger.log('CAPTURE_SKIPPED_PREVIEW_ONLY_MODE', { timestamp: Date.now() });
      this.scheduleNextCapture(1000);
      return;
    }

    // Concurrency Guard: Skip if already capturing
    if (this.isCapturing) {
      CameraLogger.log('Capture skipped: previous capture still processing');
      this.scheduleNextCapture(this.baseIntervalMs);
      return;
    }

    if (!this.cameraRef || !this.cameraRef.takePictureAsync) {
      // Do not count temporary null reference as hardware failure (e.g. during remount / orientation changes)
      CameraLogger.log('Capture skipped: camera reference is null or not ready');
      this.scheduleNextCapture(this.baseIntervalMs);
      return;
    }

    // Increment takePictureAsync_calls only when legacy snapshot actually invokes takePictureAsync
    CameraCaptureService.takePictureAsync_calls += 1;
    this.isCapturing = true;
    this.setState(CameraHealthState.Busy);
    const captureStart = Date.now();
    CameraLogger.log('CAPTURE_START', { captureCount: this.captureCount + 1, intervalMs: this.baseIntervalMs, takePictureAsync_calls: CameraCaptureService.takePictureAsync_calls });

    // Snapshot the camera ref to prevent race with remount
    const capturedCameraRef = this.cameraRef;

    try {
      const capturePromise = capturedCameraRef.takePictureAsync({
        base64: true,
        quality: this.options.quality,
        maxWidth: this.options.maxWidth,
        maxHeight: this.options.maxHeight,
        shutterSound: false,
        skipProcessing: true,
        exif: false,
      });

      // Wrap in 5-second timeout
      const photo: any = await this.withTimeout(capturePromise, 5000);

      const captureDuration = Date.now() - captureStart;
      this.captureCount += 1;
      this.successCount += 1;
      
      // Reset failures on success
      if (this.consecutiveFailures > 0) {
        CameraLogger.log('Recovery completed');
        this.consecutiveFailures = 0;
      }

      CameraLogger.log('CAPTURE_END', { durationMs: captureDuration, captureCount: this.captureCount });
      this.setState(CameraHealthState.Streaming);

      if (this.onCaptureCallback && photo && photo.base64) {
        this.onCaptureCallback({
          base64: photo.base64,
          width: photo.width,
          height: photo.height,
          captureDurationMs: captureDuration,
          timestamp: Date.now(),
        });
      }

      this.isCapturing = false;
      this.scheduleNextCapture(this.baseIntervalMs);
    } catch (e: any) {
      this.isCapturing = false;
      this.failureCount += 1;
      this.consecutiveFailures += 1;
      CameraLogger.log('CAPTURE_FAILURE', { error: e.message || String(e), consecutiveFailures: this.consecutiveFailures });
      this.handleCaptureFailure(e);
    }
  }

  private handleCaptureFailure(error: any): void {
    this.setState(CameraHealthState.CameraError);

    if (this.consecutiveFailures === 3) {
      CameraLogger.log('Recovery started', { reason: 'Consecutive capture failures (applying backoff, preserving CameraView mount)' });
      this.setState(CameraHealthState.Recovering);
    }

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      CameraLogger.log('Streaming paused', { reason: 'Max consecutive capture failures reached' });
      this.pause();
      return;
    }

    // Schedule next capture with exponential backoff on failure without remounting CameraView
    const backoffDelay = Math.min(3000, 1000 * this.consecutiveFailures);
    const nextInterval = this.baseIntervalMs + backoffDelay;
    this.scheduleNextCapture(nextInterval);
  }

  private setState(newState: CameraHealthState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    CameraLogger.log('StateTransition', { from: oldState, to: newState });
    this.notifyListeners();
  }

  public onStateChange(listener: (state: CameraHealthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.state;
    this.listeners.forEach((l) => l(state));
  }
}
