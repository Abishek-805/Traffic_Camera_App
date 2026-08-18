import { FrameStats, CameraSettings } from '../../types/camera';
import { CameraHealthState } from '../../types/camera-health';

export interface ICameraStreamingService {
  startMockStream(targetFps?: number): void;
  stopMockStream(): void;
  
  startRealStream(cameraRef: any, settings: CameraSettings, onCameraRestartRequested: () => void): void;
  stopRealStream(): void;
  handleFrameSampled?(frameData: { base64: string; width: number; height: number; timestamp: number }): void;
  
  getFrameStats(): FrameStats;
  onStatsUpdate(listener: (stats: FrameStats) => void): () => void;
  
  getHealthState(): CameraHealthState;
  onHealthStateChange(listener: (state: CameraHealthState) => void): () => void;
}
