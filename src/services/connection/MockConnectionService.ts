import { IConnectionService, MessageListener, StateChangeListener } from './IConnectionService';
import { ConnectionInfo, ConnectionStateEnum, QRPayload } from '../../types/connection';
import { SocketMessage } from '../../types/protocol';
import { DeviceUtils } from '../../utils/device';
import { MessageFactory } from '../../protocol/builders/MessageFactory';

export class MockConnectionService implements IConnectionService {
  private state: ConnectionStateEnum = 'DISCONNECTED';
  private connectionInfo: ConnectionInfo | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private stateListeners: Set<StateChangeListener> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentPing: number = 14;

  public async connect(qrPayload: QRPayload): Promise<ConnectionInfo> {
    this.setState('CONNECTING');

    // Simulate Network Handshake steps (500ms)
    await new Promise((res) => setTimeout(res, 600));

    const deviceInfo = await DeviceUtils.getDeviceInfo();
    const cameraId = `CAM-${Math.floor(100 + Math.random() * 900)}`;

    this.connectionInfo = {
      server: qrPayload.server,
      port: qrPayload.port,
      session: qrPayload.session,
      token: qrPayload.token,
      expires: qrPayload.expires,
      protocol: qrPayload.protocol,
      secure: qrPayload.secure,
      assignedLane: qrPayload.defaultLane || 'North Intersection - Lane 1',
      cameraId: cameraId,
      pingMs: Math.floor(12 + Math.random() * 8),
      connectedAt: Date.now(),
    };

    // Step 2: Registered
    this.setState('REGISTERED');
    await new Promise((res) => setTimeout(res, 400));

    // Emit Registration Ack message to listeners
    const ackMsg = MessageFactory.createMessage('REGISTRATION_ACK', {
      cameraId: cameraId,
      assignedLane: this.connectionInfo.assignedLane,
      status: 'WAITING',
      serverTimestamp: Date.now(),
    }, qrPayload.token);

    this.notifyMessage(ackMsg);

    // Step 3: Waiting for laptop START_STREAM
    this.setState('WAITING');
    this.startHeartbeat();

    return this.connectionInfo;
  }

  public async disconnect(reason: string = 'User initiated disconnect'): Promise<void> {
    this.stopHeartbeat();
    const token = this.connectionInfo?.token || '';
    
    if (this.connectionInfo) {
      const discMsg = MessageFactory.createMessage('DISCONNECT', { reason }, token);
      this.notifyMessage(discMsg);
    }

    this.connectionInfo = null;
    this.setState('DISCONNECTED');
  }

  public async reconnect(): Promise<ConnectionInfo> {
    if (!this.connectionInfo) {
      throw new Error('No previous session to reconnect to.');
    }

    this.setState('RECONNECTING');
    await new Promise((res) => setTimeout(res, 800));

    this.connectionInfo.connectedAt = Date.now();
    this.setState('WAITING');
    this.startHeartbeat();

    return this.connectionInfo;
  }

  public sendMessage(message: SocketMessage): boolean {
    console.log('[MockConnectionService] Outgoing Message:', message.type, message.payload);
    return true;
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public getState(): ConnectionStateEnum {
    return this.state;
  }

  public getConnectionInfo(): ConnectionInfo | null {
    return this.connectionInfo;
  }

  public getPingLatency(): number {
    return this.currentPing;
  }

  public getBufferedAmount(): number {
    return 0;
  }

  public getReconnectAttempts(): number {
    return 0;
  }

  public getLastReconnectDelayMs(): number {
    return 0;
  }

  public getLastDisconnectReason(): string {
    return 'None (Active Session)';
  }

  public requestStartStream(): void {
    if (this.state === 'WAITING' && this.connectionInfo) {
      this.setState('STREAMING');
      const startMsg = MessageFactory.createMessage('START_STREAM', {
        targetFps: 30,
        resolution: '1080p',
        quality: 90,
      }, this.connectionInfo.token);
      this.notifyMessage(startMsg);
    }
  }

  public requestStopStream(): void {
    if (this.state === 'STREAMING' && this.connectionInfo) {
      this.setState('WAITING');
      const stopMsg = MessageFactory.createMessage('STOP_STREAM', {
        reason: 'Laptop requested stream pause',
      }, this.connectionInfo.token);
      this.notifyMessage(stopMsg);
    }
  }

  private setState(newState: ConnectionStateEnum): void {
    this.state = newState;
    this.stateListeners.forEach((listener) => listener(newState));
  }

  private notifyMessage(msg: SocketMessage): void {
    this.messageListeners.forEach((listener) => listener(msg));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionInfo) {
        this.currentPing = Math.floor(11 + Math.random() * 9);
        const hbAck = MessageFactory.createMessage('HEARTBEAT_ACK', {
          serverTimestamp: Date.now(),
          pingMs: this.currentPing,
        }, this.connectionInfo.token);
        this.notifyMessage(hbAck);
      }
    }, 2000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
