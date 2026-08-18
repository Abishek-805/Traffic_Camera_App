import { CameraHealthState } from '../../types/camera-health';

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

export interface ICameraCaptureService {
  start(cameraRef: any, options: CaptureOptions): void;
  stop(): void;
  pause(): void;
  resume(cameraRef: any, options: CaptureOptions): void;
  getState(): CameraHealthState;
  getCaptureCount(): number;
  getSuccessCount(): number;
  getFailureCount(): number;
  setCaptureCallback(callback: (result: CaptureResult) => void): void;
  setBaseInterval(ms: number): void;
  onStateChange(listener: (state: CameraHealthState) => void): () => void;
}

export interface CaptureOptions {
  quality: number;
  maxWidth: number;
  maxHeight: number;
}