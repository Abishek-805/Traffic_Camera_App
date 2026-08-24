export type ConnectionStateEnum =
  | 'INITIALIZING'
  | 'DISCONNECTED'
  | 'SCANNING'
  | 'CONNECTING'
  | 'REGISTERED'
  | 'WAITING'
  | 'STREAMING'
  | 'RECONNECTING'
  | 'ERROR';

export interface QRPayload {
  version: string;
  server: string;
  port: number;
  session: string;
  token: string;
  expires: number;
  protocol: 'websocket' | 'http' | 'ws' | 'wss';
  secure: boolean;
  defaultLane?: string;
}

export interface ConnectionInfo {
  server: string;
  port: number;
  session: string;
  token: string;
  expires: number;
  protocol: string;
  secure: boolean;
  assignedLane?: string;
  cameraId?: string;
  pingMs?: number;
  connectedAt?: number;
}
