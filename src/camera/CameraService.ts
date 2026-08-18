import { ICameraService } from './ICameraService';
import { CameraSettings, CameraCapabilities, CameraType, VideoQuality } from '../types/camera';
import { DeviceUtils } from '../utils/device';

export class CameraService implements ICameraService {
  private settings: CameraSettings = {
    facing: 'back',
    resolution: '480p',
    targetFps: 30,
    torch: false,
    zoom: 0,
    autoFocus: true,
  };

  public async getCapabilities(): Promise<CameraCapabilities> {
    return DeviceUtils.getCameraCapabilities();
  }

  public getSettings(): CameraSettings {
    return { ...this.settings };
  }

  public setFacing(facing: CameraType): void {
    this.settings.facing = facing;
  }

  public setResolution(resolution: VideoQuality): void {
    this.settings.resolution = resolution;
  }

  public getResolutionConfig(): { quality: number; width: number; height: number } {
    switch (this.settings.resolution) {
      case '480p':
        return { quality: 0.25, width: 640, height: 360 };  // 16:9 native
      case '720p':
        return { quality: 0.15, width: 1280, height: 720 };
      case '1080p':
      default:
        return { quality: 0.25, width: 1920, height: 1080 };
    }
  }

  public setTorch(enabled: boolean): void {
    this.settings.torch = enabled;
  }

  public setZoom(zoom: number): void {
    this.settings.zoom = Math.max(0, Math.min(1, zoom));
  }

  public async requestPermissions(): Promise<boolean> {
    // Permission request handled in CameraView / Expo Camera hooks
    return true;
  }

  public async hasPermissions(): Promise<boolean> {
    return true;
  }
}
