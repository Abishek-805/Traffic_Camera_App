export const APP_METADATA = {
  appName: 'SMART TRAFFIC MANAGEMENT SYSTEM',
  moduleName: 'Traffic Camera Node',
  version: '1.0.0-phase1',
  protocolVersion: '1.0',
};

export const STORAGE_KEYS = {
  APP_SETTINGS: '@traffic_camera_app_settings',
  CONNECTION_HISTORY: '@traffic_camera_connection_history',
  LAST_SESSION: '@traffic_camera_last_session',
};

export const DEFAULT_SETTINGS = {
  autoConnect: false,
  debugMode: false,
  defaultQuality: '480p' as const,
  preferredCamera: 'back' as const,
  serverHistory: [],
  vibrateOnScan: true,
  keepScreenOn: true,
};
