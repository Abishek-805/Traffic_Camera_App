export const APP_METADATA = {
  appName: 'SMART TRAFFIC MANAGEMENT SYSTEM',
  moduleName: 'Traffic Camera Node',
  version: '1.0.4',
  protocolVersion: '1.0',
};

export const STORAGE_KEYS = {
  APP_SETTINGS: '@traffic_camera_app_settings',
  CAMERA_SETTINGS: '@traffic_camera_camera_settings_v2',
  CONNECTION_HISTORY: '@traffic_camera_connection_history',
  LAST_SESSION: '@traffic_camera_last_session',
};

export const DEFAULT_REST_PORT = Number(process.env.EXPO_PUBLIC_REST_PORT) || 8000;
export const DEFAULT_WEBSOCKET_PORT = Number(process.env.EXPO_PUBLIC_WEBSOCKET_PORT) || 8000;

export const DEFAULT_SETTINGS = {
  autoConnect: false,
  debugMode: false,
  defaultQuality: '720p' as const,
  preferredCamera: 'back' as const,
  serverHistory: [],
  vibrateOnScan: true,
  keepScreenOn: true,
  serverHost: process.env.EXPO_PUBLIC_SERVER_HOST || '',
  serverPort: DEFAULT_WEBSOCKET_PORT,
  apiPort: DEFAULT_REST_PORT,
  serverProtocol: 'ws' as const,
  cameraDirection: 'NORTH' as const,
};
