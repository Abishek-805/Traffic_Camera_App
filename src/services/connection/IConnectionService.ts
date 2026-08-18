import { ConnectionInfo, ConnectionStateEnum, QRPayload } from '../../types/connection';
import { SocketMessage } from '../../types/protocol';

export type MessageListener = (message: SocketMessage) => void;
export type StateChangeListener = (state: ConnectionStateEnum) => void;

export interface IConnectionService {
  connect(qrPayload: QRPayload): Promise<ConnectionInfo>;
  disconnect(reason?: string): Promise<void>;
  reconnect(): Promise<ConnectionInfo>;
  sendMessage(message: SocketMessage): boolean;
  onMessage(listener: MessageListener): () => void;
  onStateChange(listener: StateChangeListener): () => void;
  getState(): ConnectionStateEnum;
  getConnectionInfo(): ConnectionInfo | null;
  getPingLatency(): number;
  getBufferedAmount(): number;
  getReconnectAttempts(): number;
  getLastReconnectDelayMs(): number;
  getLastDisconnectReason(): string;
  triggerMockStartStream?: () => void;
  triggerMockStopStream?: () => void;
}
