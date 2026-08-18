import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { ConnectionInfo, ConnectionStateEnum, QRPayload } from '../types/connection';
import { SocketMessage } from '../types/protocol';
import { ConnectionServiceFactory } from '../services/connection/ConnectionServiceFactory';
import { IConnectionService } from '../services/connection/IConnectionService';

interface ConnectionContextType {
  connectionState: ConnectionStateEnum;
  connectionInfo: ConnectionInfo | null;
  pingMs: number;
  lastMessage: SocketMessage | null;
  reconnectAttempts: number;
  lastReconnectDelayMs: number;
  lastDisconnectReason: string;
  connectWithQR: (qrPayload: QRPayload) => Promise<ConnectionInfo>;
  disconnect: (reason?: string) => Promise<void>;
  reconnect: () => Promise<ConnectionInfo>;
  triggerMockStartStream: () => void;
  triggerMockStopStream: () => void;
}

export const ConnectionContext = createContext<ConnectionContextType>({
  connectionState: 'DISCONNECTED',
  connectionInfo: null,
  pingMs: 0,
  lastMessage: null,
  reconnectAttempts: 0,
  lastReconnectDelayMs: 0,
  lastDisconnectReason: 'None (Active Session)',
  connectWithQR: async () => { throw new Error('Not initialized'); },
  disconnect: async () => {},
  reconnect: async () => { throw new Error('Not initialized'); },
  triggerMockStartStream: () => {},
  triggerMockStopStream: () => {},
});

export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [service] = useState<IConnectionService>(() => ConnectionServiceFactory.getInstance());
  const [connectionState, setConnectionState] = useState<ConnectionStateEnum>('DISCONNECTED');
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [pingMs, setPingMs] = useState<number>(0);
  const [lastMessage, setLastMessage] = useState<SocketMessage | null>(null);

  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [lastReconnectDelayMs, setLastReconnectDelayMs] = useState<number>(0);
  const [lastDisconnectReason, setLastDisconnectReason] = useState<string>('None (Active Session)');

  useEffect(() => {
    const unsubState = service.onStateChange((state) => {
      setConnectionState(state);
      setConnectionInfo(service.getConnectionInfo());
      setPingMs(service.getPingLatency());
      setReconnectAttempts(service.getReconnectAttempts());
      setLastReconnectDelayMs(service.getLastReconnectDelayMs());
      setLastDisconnectReason(service.getLastDisconnectReason());
    });

    const unsubMsg = service.onMessage((msg) => {
      setLastMessage(msg);
      setPingMs(service.getPingLatency());
      setReconnectAttempts(service.getReconnectAttempts());
      setLastReconnectDelayMs(service.getLastReconnectDelayMs());
      setLastDisconnectReason(service.getLastDisconnectReason());

      if (msg.type === 'START_STREAM') {
        setConnectionState('STREAMING');
      } else if (msg.type === 'STOP_STREAM') {
        setConnectionState('WAITING');
      }
    });

    return () => {
      unsubState();
      unsubMsg();
    };
  }, [service]);

  const connectWithQR = async (qrPayload: QRPayload): Promise<ConnectionInfo> => {
    const info = await service.connect(qrPayload);
    setConnectionInfo(info);
    return info;
  };

  const disconnect = async (reason: string = 'User disconnect'): Promise<void> => {
    await service.disconnect(reason);
    setConnectionInfo(null);
    setLastDisconnectReason(service.getLastDisconnectReason());
  };

  const reconnect = async (): Promise<ConnectionInfo> => {
    const info = await service.reconnect();
    setConnectionInfo(info);
    return info;
  };

  const triggerMockStartStream = () => {
    if ('triggerMockStartStream' in service) {
      (service as any).triggerMockStartStream();
    }
  };

  const triggerMockStopStream = () => {
    if ('triggerMockStopStream' in service) {
      (service as any).triggerMockStopStream();
    }
  };

  return (
    <ConnectionContext.Provider
      value={{
        connectionState,
        connectionInfo,
        pingMs,
        lastMessage,
        reconnectAttempts,
        lastReconnectDelayMs,
        lastDisconnectReason,
        connectWithQR,
        disconnect,
        reconnect,
        triggerMockStartStream,
        triggerMockStopStream,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};
