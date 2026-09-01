import { QRPayload } from '../../types/connection';
import { ProtocolValidator } from '../../protocol/validators/ProtocolValidator';

export class QRCodeService {
  public static parseQRPayload(qrRawText: string): QRPayload {
    try {
      const parsed: any = JSON.parse(qrRawText.trim());

      if (!ProtocolValidator.isValidQRPayload(parsed)) {
        throw new Error('Invalid Traffic Camera pairing QR. Generate a fresh code on the dashboard.');
      }

      if (parsed.expires && Number(parsed.expires) <= Date.now()) {
        throw new Error('This QR code expired. Generate a new code on the dashboard.');
      }
      const direction = String(parsed.camera_direction).toLowerCase();
      return {
        version: parsed.version || '1.0',
        server: parsed.server,
        port: Number(parsed.port),
        session: parsed.session,
        token: parsed.token,
        expires: parsed.expires,
        protocol: parsed.protocol,
        secure: Boolean(parsed.secure),
        camera_direction: direction,
        defaultLane: parsed.defaultLane || `${direction[0].toUpperCase()}${direction.slice(1)} Approach`,
      };
    } catch (err: any) {
      if (err.message.includes('Invalid Traffic Camera pairing QR') || err.message.includes('expired')) {
        throw err;
      }
      throw new Error(`Failed to parse QR code JSON: ${err.message || 'Invalid JSON'}`);
    }
  }
}
