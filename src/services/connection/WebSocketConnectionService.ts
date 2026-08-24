import { IConnectionService, MessageListener, StateChangeListener } from './IConnectionService';
import { ConnectionInfo, ConnectionStateEnum, QRPayload } from '../../types/connection';
import { SocketMessage, RegisterCameraPayload } from '../../types/protocol';
import { DeviceUtils } from '../../utils/device';
import { MessageFactory } from '../../protocol/builders/MessageFactory';
import { ProtocolValidator } from '../../protocol/validators/ProtocolValidator';

export class WebSocketConnectionService implements IConnectionService {
  private state: ConnectionStateEnum = 'DISCONNECTED';
  private connectionInfo: ConnectionInfo | null = null;
  private socket: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private stateListeners: Set<StateChangeListener> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentPing: number = 0;

  // Bounded Exponential Auto-Reconnect State
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stableConnectionTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect: boolean = false;
  private lastQRPayload: QRPayload | null = null;
  private lastReconnectDelayMs: number = 0;
  private lastDisconnectReason: string = 'None (Active Session)';

  public async connect(qrPayload: QRPayload): Promise<ConnectionInfo> {
    this.lastQRPayload = qrPayload;
    this.isManualDisconnect = false;

    // Close any existing socket before creating a new one (prevents orphaned sockets)
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close();
        }
      } catch {
        // Ignore errors while tearing down old socket
      }
      this.socket = null;
    }
    this.stopHeartbeat();
    this.stopStableConnectionTimer();

    this.setState('CONNECTING');

    return new Promise((resolve, reject) => {
      try {
        const protocol = (qrPayload.protocol === 'wss' || qrPayload.secure) ? 'wss' : 'ws';
        const portStr = (qrPayload.port === 443 || qrPayload.port === 80) ? '' : `:${qrPayload.port}`;
        const wsUrl = `${protocol}://${qrPayload.server}${portStr}/ws/camera`;

        console.log(`[WS_CONNECT_ATTEMPT] ${wsUrl}`, {
          host: qrPayload.server,
          port: qrPayload.port,
          protocol,
          url: wsUrl,
        });

        this.socket = new WebSocket(wsUrl);

        let isResolved = false;

        this.socket.onopen = async () => {
          try {
            const deviceInfo = await DeviceUtils.getDeviceInfo();
            const capabilities = DeviceUtils.getCameraCapabilities();

            const registerPayload: RegisterCameraPayload = {
              device: deviceInfo,
              capabilities: capabilities,
              session: qrPayload.session,
            };

            const regMsg = MessageFactory.createMessage(
              'REGISTER_CAMERA',
              registerPayload,
              qrPayload.token
            );

            this.sendMessage(regMsg);
          } catch (err) {
            this.setState('ERROR');
            reject(err);
          }
        };

        this.socket.onmessage = (event: WebSocketMessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (!ProtocolValidator.isValidSocketMessage(data)) {
              return;
            }

            const msg: SocketMessage = data;
            this.notifyMessage(msg);

            if (msg.type === 'REGISTRATION_ACK') {
              const payload = msg.payload || {};
              this.connectionInfo = {
                server: qrPayload.server,
                port: qrPayload.port,
                session: qrPayload.session,
                token: qrPayload.token,
                expires: qrPayload.expires,
                protocol: qrPayload.protocol,
                secure: qrPayload.secure,
                assignedLane: payload.assignedLane || qrPayload.defaultLane || 'Lane 1',
                cameraId: payload.cameraId || `CAM-${Math.floor(100 + Math.random() * 900)}`,
                pingMs: 0,
                connectedAt: Date.now(),
              };

              this.setState('REGISTERED');
              this.setState('WAITING');
              this.startHeartbeat();
              this.startStableConnectionTimer();

              if (!isResolved) {
                isResolved = true;
                resolve(this.connectionInfo);
              }
            } else if (msg.type === 'HEARTBEAT_ACK') {
              if (msg.timestamp) {
                this.currentPing = Math.max(1, Date.now() - msg.timestamp);
              } else if (msg.payload?.pingMs) {
                this.currentPing = msg.payload.pingMs;
              }
            } else if (msg.type === 'START_STREAM') {
              this.setState('STREAMING');
            } else if (msg.type === 'STOP_STREAM') {
              this.setState('WAITING');
            } else if (msg.type === 'RECONNECT_ACK') {
              if (msg.payload?.success) {
                this.setState('WAITING');
                this.startHeartbeat();
                this.startStableConnectionTimer();
                if (!isResolved && this.connectionInfo) {
                  isResolved = true;
                  resolve(this.connectionInfo);
                }
              }
            }
          } catch (e) {
            console.warn('[WebSocketConnectionService] Message parsing error:', e);
          }
        };

        this.socket.onerror = (error: Event) => {
          console.warn('[WebSocketConnectionService] Connection Error:', error);
          if (!isResolved) {
            this.setState('ERROR');
            isResolved = true;
            reject(new Error(`WebSocket connection to ${wsUrl} failed.`));
          }
        };

        this.socket.onclose = (event: WebSocketCloseEvent) => {
          this.stopHeartbeat();
          this.stopStableConnectionTimer();

          if (event.reason) {
            this.lastDisconnectReason = event.reason;
          } else {
            this.lastDisconnectReason = `Socket closed (code ${event.code})`;
          }

          if (!this.isManualDisconnect && this.lastQRPayload && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleAutoReconnect();
          } else {
            if (this.state !== 'DISCONNECTED') {
              this.setState('DISCONNECTED');
            }
          }

          if (!isResolved) {
            isResolved = true;
            reject(new Error(`WebSocket connection closed (${event.code}): ${event.reason || 'Server disconnected'}`));
          }
        };
      } catch (err) {
        this.setState('ERROR');
        reject(err);
      }
    });
  }

  public async disconnect(reason: string = 'User disconnected'): Promise<void> {
    this.isManualDisconnect = true;
    this.lastDisconnectReason = reason;
    this.cancelAutoReconnect();
    this.stopHeartbeat();
    this.stopStableConnectionTimer();

    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.connectionInfo) {
      try {
        const discMsg = MessageFactory.createMessage('DISCONNECT', { reason }, this.connectionInfo.token);
        this.sendMessage(discMsg);
      } catch {
        // Ignore send errors during shutdown
      }
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connectionInfo = null;
    this.setState('DISCONNECTED');
  }

  public async reconnect(): Promise<ConnectionInfo> {
    if (!this.connectionInfo) {
      throw new Error('No previous session available for reconnection.');
    }

    this.setState('RECONNECTING');

    const qrPayload: QRPayload = {
      version: '1.0',
      server: this.connectionInfo.server,
      port: this.connectionInfo.port,
      session: this.connectionInfo.session,
      token: this.connectionInfo.token,
      expires: this.connectionInfo.expires,
      protocol: (this.connectionInfo.protocol as any) || 'websocket',
      secure: this.connectionInfo.secure,
      defaultLane: this.connectionInfo.assignedLane,
    };

    return this.connect(qrPayload);
  }

  public triggerMockStartStream(): void {
    this.setState('STREAMING');
    this.notifyMessage({
      type: 'START_STREAM',
      timestamp: Date.now(),
      payload: { target_fps: 30, resolution: '1080p' },
    });
  }

  public triggerMockStopStream(): void {
    this.setState('WAITING');
    this.notifyMessage({
      type: 'STOP_STREAM',
      timestamp: Date.now(),
      payload: { reason: 'User paused' },
    });
  }

  public sendMessage(message: SocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocketConnectionService] Socket is not OPEN. Message dropped:', message.type);
      return false;
    }

    if (message.type === 'VIDEO_FRAME') {
      const MAX_SOCKET_BUFFER_BYTES = 256 * 1024;
      if (this.socket.bufferedAmount > MAX_SOCKET_BUFFER_BYTES) {
        console.warn('[WebSocketConnectionService] VIDEO_FRAME dropped due to socket backpressure:', this.socket.bufferedAmount);
        return false;
      }
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.warn('[WebSocketConnectionService] Send failed:', e);
      return false;
    }
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
    return this.socket?.bufferedAmount || 0;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getLastReconnectDelayMs(): number {
    return this.lastReconnectDelayMs;
  }

  public getLastDisconnectReason(): string {
    return this.lastDisconnectReason;
  }

  private scheduleAutoReconnect(): void {
    this.cancelAutoReconnect();
    this.reconnectAttempts += 1;
    this.setState('RECONNECTING');

    // Exponential backoff capped at 30,000ms with jitter
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts) + Math.random() * 500,
      30000
    );

    this.lastReconnectDelayMs = Math.round(delay);

    console.log(
      `[WebSocketConnectionService] Scheduling auto-reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.lastReconnectDelayMs}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      if (this.lastQRPayload && !this.isManualDisconnect) {
        try {
          await this.connect(this.lastQRPayload);
        } catch {
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('[WebSocketConnectionService] Max auto-reconnect attempts reached.');
            this.setState('ERROR');
          }
        }
      }
    }, delay);
  }

  private cancelAutoReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startStableConnectionTimer(): void {
    this.stopStableConnectionTimer();
    // After 10s of unbroken connection, reset reconnect counter
    this.stableConnectionTimer = setTimeout(() => {
      this.reconnectAttempts = 0;
    }, 10000);
  }

  private stopStableConnectionTimer(): void {
    if (this.stableConnectionTimer) {
      clearTimeout(this.stableConnectionTimer);
      this.stableConnectionTimer = null;
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
      if (this.socket && this.socket.readyState === WebSocket.OPEN && this.connectionInfo) {
        const hb = MessageFactory.createHeartbeat(
          this.connectionInfo.cameraId || 'CAM-001',
          this.connectionInfo.token
        );
        this.sendMessage(hb);
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
