export type CameraType = 'back' | 'front';
export type VideoQuality = '480p' | '720p' | '1080p';

export enum CameraMode {
  PREVIEW_ONLY = 'PREVIEW_ONLY',
  LEGACY_SNAPSHOT = 'LEGACY_SNAPSHOT',
  VISION_CAMERA = 'VISION_CAMERA',
}

export interface CameraSettings {
  facing: CameraType;
  resolution: VideoQuality;
  targetFps: number;
  torch: boolean;
  zoom: number;
  autoFocus: boolean;
}

export interface CameraCapabilities {
  frontCameraAvailable: boolean;
  backCameraAvailable: boolean;
  maxResolution: VideoQuality;
  supportedFPS: number[];
  torchSupported: boolean;
  zoomSupported: boolean;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  platform: 'android' | 'ios' | 'web';
  appVersion: string;
  batteryLevel: number;
  isCharging: boolean;
}

export interface FrameStats {
  currentFps: number;
  targetFps: number;
  framesSent: number;
  droppedFrames: number;
  overwriteFrames: number;
  staleFrames: number;
  capturedFrames: number;
  captureFailures: number;
  avgEncodeTimeMs: number;
  avgSendTimeMs: number;
  socketBufferPeakBytes: number;
  currentCaptureIntervalMs: number;
  lastFrameTime: number;
  resolution: string;
}
