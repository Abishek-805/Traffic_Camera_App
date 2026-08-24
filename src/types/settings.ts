export interface AppSettings {
  autoConnect: boolean;
  debugMode: boolean;
  defaultQuality: '480p' | '720p' | '1080p';
  preferredCamera: 'front' | 'back';
  serverHistory: string[];
  vibrateOnScan: boolean;
  keepScreenOn: boolean;
  serverHost: string;
  serverPort: number;
  serverProtocol: 'ws' | 'wss';
  cameraDirection: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
}

export interface NodeHealthMetrics {
  pingMs: number;
  fps: number;
  droppedFrames: number;
  overwriteFrames: number;
  staleFrames: number;
  capturedFrames: number;
  captureFailures: number;
  framesSent: number;
  avgEncodeTimeMs: number;
  avgSendTimeMs: number;
  socketBufferPeakBytes: number;
  currentCaptureIntervalMs: number;
  batteryLevel: number;
  batteryCharging: boolean;
  reconnectCount: number;
  reconnectAttempts: number;
  lastReconnectDelayMs: number;
  lastDisconnectReason: string;
  wifiIp: string;
  lastHeartbeat: number;
  lastFrameTime: number;
  appVersion: string;
  protocolVersion: string;
  cameraHealthState: string;
}
