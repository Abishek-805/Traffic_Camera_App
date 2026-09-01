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
  private pendingFrame: { id: string; sent: number } | null = null;
  private frameLatency: { roundTripMs: number; serverMs: number; queueMs: number } | null = null;
  public canCaptureFrame(): boolean {
    return this.state === 'STREAMING' && this.getBufferedAmount() < 64 * 1024 &&
      (!this.pendingFrame || Date.now() - this.pendingFrame.sent > 1500);
  }
  public getFrameLatency() { return this.frameLatency; }


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
    const hadEstablishedSession = this.connectionInfo !== null;
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
    this.cancelAutoReconnect();

    this.pendingFrame = null;
    this.frameLatency = null;
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
        let registeredOnSocket = false;
        const currentSocket = this.socket;
        const handshakeTimer = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.setState('ERROR');
            reject(new Error('Registration timed out. Check the server address and port.'));
            currentSocket.close();
          }
        }, 10000);

        this.socket.onopen = async () => {
          try {
            const deviceInfo = await DeviceUtils.getDeviceInfo();
            const capabilities = DeviceUtils.getCameraCapabilities();

            if (this.socket !== currentSocket) return;
            const direction = (qrPayload.camera_direction || qrPayload.defaultLane?.split(' ')[0] ||
              qrPayload.session.match(/north|south|east|west/i)?.[0] || '').toLowerCase();
            if (!['north', 'east', 'south', 'west'].includes(direction)) throw new Error('Choose a valid camera direction.');
            const registerPayload: RegisterCameraPayload = {
              node_id: qrPayload.session,
              camera_direction: direction,
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
            if (!isResolved) {
              isResolved = true;
              reject(err);
            }
            currentSocket.close();
          }
        };

        this.socket.onmessage = (event: WebSocketMessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === 'FRAME_ACK') {
              const payload = data.payload || {};
              if (this.pendingFrame && payload.frame_id === this.pendingFrame.id) {
                const roundTripMs = Math.max(0, Date.now() - this.pendingFrame.sent);
                this.pendingFrame = null;
                this.frameLatency = {
                  roundTripMs,
                  serverMs: Number.isFinite(payload.server_processing_ms) ? payload.server_processing_ms : 0,
                  queueMs: Number.isFinite(payload.queue_wait_ms) ? payload.queue_wait_ms : 0,
                };
              }
              // Frame acknowledgements are transport telemetry, not navigation commands.
              return;
            }
            if (!ProtocolValidator.isValidSocketMessage(data)) {
              return;
            }

            const msg: SocketMessage = data;

            if (msg.type === 'ERROR') {
              clearTimeout(handshakeTimer);
              if (!isResolved) { isResolved = true; reject(new Error(msg.payload?.message || 'Registration rejected')); }
              if (msg.payload?.error_code === 'DIRECTION_OCCUPIED') this.isManualDisconnect = true;
              if (msg.payload?.error_code === 'UNAUTHORIZED_SESSION' || this.state === 'CONNECTING') currentSocket.close();
            } else if (msg.type === 'REGISTRATION_ACK') {
              clearTimeout(handshakeTimer);
              const payload = msg.payload || {};
              registeredOnSocket = true;
              const sessionToken = payload.session_token || qrPayload.token;
              this.connectionInfo = {
                server: qrPayload.server,
                port: qrPayload.port,
                session: qrPayload.session,
                token: sessionToken,
                expires: qrPayload.expires,
                protocol: qrPayload.protocol,
                secure: qrPayload.secure,
                assignedLane: payload.assignedLane || qrPayload.defaultLane || 'Lane 1',
                cameraId: payload.cameraId || `CAM-${Math.floor(100 + Math.random() * 900)}`,
                pingMs: 0,
                connectedAt: Date.now(),
              };
              // Re-registration uses the server-issued token after the one-time QR is consumed.
              this.lastQRPayload = { ...qrPayload, token: sessionToken };

              this.setState('REGISTERED');
              this.setState('WAITING');
              this.startHeartbeat();
              this.startStableConnectionTimer();

              if (!isResolved) {
                isResolved = true;
                resolve(this.connectionInfo);
              }
            } else if (msg.type === 'HEARTBEAT_ACK') {
              if (msg.payload?.client_timestamp) {
                this.currentPing = Math.max(0, Date.now() - msg.payload.client_timestamp);
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
            this.notifyMessage(msg);
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
          clearTimeout(handshakeTimer);
          this.stopHeartbeat();
          this.stopStableConnectionTimer();

          if (event.reason) {
            this.lastDisconnectReason = event.reason;
          } else {
            this.lastDisconnectReason = `Socket closed (code ${event.code})`;
          }

          if (!this.isManualDisconnect && (registeredOnSocket || hadEstablishedSession) &&
              this.lastQRPayload && this.reconnectAttempts < this.maxReconnectAttempts) {
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
        const discMsg = MessageFactory.createMessage('DISCONNECT', { reason, node_id: this.connectionInfo.cameraId }, this.connectionInfo.token);
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

    if (!this.lastQRPayload) throw new Error('Scan a connection QR code first.');
    return this.connect(this.lastQRPayload);
  }

  public requestStartStream(): void {
    this.sendMessage(MessageFactory.createMessage('START_STREAM', {}));
  }

  public requestStopStream(): void {
    this.sendMessage(MessageFactory.createMessage('STOP_STREAM', {}));
  }

  public sendMessage(message: SocketMessage): boolean {
    if (this.connectionInfo && message.type !== 'REGISTER_CAMERA') {
      message = { ...message, token: this.connectionInfo.token,
        payload: { ...message.payload, node_id: this.connectionInfo.cameraId,
          session_token: this.connectionInfo.token } };
    }
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
      if (message.type === 'VIDEO_FRAME') this.pendingFrame = { id: message.payload.frame_id, sent: Date.now() };
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
