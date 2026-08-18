import { QRPayload } from '../../types/connection';
import { ProtocolValidator } from '../../protocol/validators/ProtocolValidator';

export class QRCodeService {
  /**
   * Normalize a Python dict repr string into valid JSON.
   * Handles: single quotes → double quotes, True/False/None → true/false/null.
   * This is a compatibility layer; the backend should always emit proper JSON.
   */
  private static normalizePythonDictString(raw: string): string {
    return raw
      .replace(/'/g, '"')           // single → double quotes
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
  }

  public static parseQRPayload(qrRawText: string): QRPayload {
    try {
      let jsonText = qrRawText.trim();
      // Attempt raw parse first; if it fails, try Python dict normalization
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        jsonText = QRCodeService.normalizePythonDictString(jsonText);
        parsed = JSON.parse(jsonText);
      }

      if (!ProtocolValidator.isValidQRPayload(parsed)) {
        throw new Error('Invalid QR payload schema. Missing required fields: server, port, session, or token.');
      }

      return {
        version: parsed.version || '1.0',
        server: parsed.server,
        port: Number(parsed.port),
        session: parsed.session,
        token: parsed.token,
        expires: parsed.expires || Date.now() + 3600000,
        protocol: parsed.protocol || 'websocket',
        secure: Boolean(parsed.secure),
        defaultLane: parsed.defaultLane || 'North Intersection - Lane 1',
      };
    } catch (err: any) {
      if (err.message.includes('Invalid QR payload schema')) {
        throw err;
      }
      throw new Error(`Failed to parse QR code JSON: ${err.message || 'Invalid JSON'}`);
    }
  }
}
