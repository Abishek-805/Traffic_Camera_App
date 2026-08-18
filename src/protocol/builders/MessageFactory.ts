import { SocketMessage, MessageType } from '../../types/protocol';

export class MessageFactory {
  private static generateMessageId(): string {
    return 'msg_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  }

  public static createMessage<T>(
    type: MessageType,
    payload: T,
    token: string = ''
  ): SocketMessage<T> {
    return {
      id: this.generateMessageId(),
      type,
      token,
      timestamp: Date.now(),
      payload,
    };
  }

  public static createHeartbeat(cameraId: string, token: string): SocketMessage<{ cameraId: string }> {
    return this.createMessage('HEARTBEAT', { cameraId }, token);
  }

  public static createHealthReport(
    healthData: any,
    token: string
  ): SocketMessage<any> {
    return this.createMessage('NODE_HEALTH_REPORT', healthData, token);
  }
}
