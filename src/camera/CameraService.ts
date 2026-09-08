import { ICameraService } from './ICameraService';
import { CameraSettings, CameraCapabilities, CameraType, VideoQuality } from '../types/camera';
import { DeviceUtils } from '../utils/device';

export interface StreamEncodingProfile {
  maxEdge: number;
  jpegQuality: number;
  legacyQuality: number;
  width: number;
  height: number;
}

export const getStreamEncodingProfile = (resolution: VideoQuality): StreamEncodingProfile => {
  switch (resolution) {
    case '480p':
      return { maxEdge: 640, jpegQuality: 65, legacyQuality: 0.65, width: 640, height: 360 };
    case '1080p':
      return { maxEdge: 1920, jpegQuality: 80, legacyQuality: 0.8, width: 1920, height: 1080 };
    case '720p':
    default:
      return { maxEdge: 1280, jpegQuality: 75, legacyQuality: 0.75, width: 1280, height: 720 };
  }
};

export class CameraService implements ICameraService {
  private settings: CameraSettings = {
    facing: 'back',
    resolution: '720p',
    targetFps: 4,
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

  public setTargetFps(targetFps: number): void {
    this.settings.targetFps = targetFps === 4 ? 4 : 2;
  }

  public getResolutionConfig(): { quality: number; width: number; height: number } {
    const profile = getStreamEncodingProfile(this.settings.resolution);
    return { quality: profile.legacyQuality, width: profile.width, height: profile.height };
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
