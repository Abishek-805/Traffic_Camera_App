import { CameraSettings, CameraCapabilities, CameraType, VideoQuality } from '../types/camera';

export interface ICameraService {
  getCapabilities(): Promise<CameraCapabilities>;
  getSettings(): CameraSettings;
  setFacing(facing: CameraType): void;
  setResolution(resolution: VideoQuality): void;
  setTargetFps(targetFps: number): void;
  setTorch(enabled: boolean): void;
  setZoom(zoom: number): void;
  requestPermissions(): Promise<boolean>;
  hasPermissions(): Promise<boolean>;
}
