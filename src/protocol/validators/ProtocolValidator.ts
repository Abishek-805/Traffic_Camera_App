import { SocketMessage, MessageType } from '../../types/protocol';
import { QRPayload } from '../../types/connection';

export class ProtocolValidator {
  public static isValidQRPayload(data: any): data is QRPayload {
    if (!data || typeof data !== 'object') return false;
    const validDirections = ['north', 'east', 'south', 'west'];
    return (
      typeof data.server === 'string' &&
      data.server.trim().length > 0 &&
      !data.server.includes('/') &&
      !/\s/.test(data.server) &&
      typeof data.port === 'number' &&
      Number.isInteger(data.port) &&
      data.port > 0 &&
      data.port <= 65535 &&
      typeof data.session === 'string' &&
      data.session.length > 0 &&
      typeof data.token === 'string' &&
      data.token.length > 0 &&
      typeof data.expires === 'number' &&
      Number.isFinite(data.expires) &&
      (data.protocol === 'ws' || data.protocol === 'wss') &&
      typeof data.camera_direction === 'string' &&
      validDirections.includes(data.camera_direction.toLowerCase())
    );
  }

  public static isValidSocketMessage(data: any): data is SocketMessage {
    if (!data || typeof data !== 'object') return false;
    return (
      typeof data.type === 'string' &&
      typeof data.timestamp === 'number' &&
      data.payload !== undefined &&
      // id is optional: accept messages where server omits it (temporary compatibility)
      (data.id === undefined || typeof data.id === 'string')
    );
  }
}
