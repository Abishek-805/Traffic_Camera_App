import { DeviceInfo, CameraCapabilities } from './camera';

export type MessageType =
  | 'REGISTER_CAMERA'
  | 'REGISTRATION_ACK'
  | 'CAPABILITY_EXCHANGE'
  | 'LANE_ASSIGNED'
  | 'START_STREAM'
  | 'STOP_STREAM'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'NODE_HEALTH_REPORT'
  | 'RECONNECT_REQUEST'
  | 'RECONNECT_ACK'
  | 'ERROR'
  | 'DISCONNECT'
  | 'VIDEO_FRAME';

export interface SocketMessage<T = any> {
  id?: string;
  type: MessageType;
  token?: string;
  timestamp: number;
  payload: T;
}

export interface RegisterCameraPayload {
  camera_direction: string;
  node_id: string;
  device: DeviceInfo;
  capabilities: CameraCapabilities;
  session: string;
}

export interface RegistrationAckPayload {
  cameraId: string;
  assignedLane: string;
  status: 'REGISTERED' | 'WAITING' | 'ACCEPTED';
  serverTimestamp: number;
}

export interface StartStreamPayload {
  targetFps: number;
  resolution: string;
  quality: number;
}

export interface StopStreamPayload {
  reason: string;
}

export interface ReconnectRequestPayload {
  session: string;
  token: string;
  cameraId: string;
}

export interface ReconnectAckPayload {
  success: boolean;
  resumedSession: boolean;
  assignedLane: string;
}

export interface NodeHealthPayload {
  cameraId: string;
  fps: number;
  batteryLevel: number;
  temperatureCelsius: number;
  pingMs: number;
  droppedFrames: number;
  lastFrameTimestamp: number;
}
