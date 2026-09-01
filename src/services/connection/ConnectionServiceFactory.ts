import { IConnectionService } from './IConnectionService';
import { WebSocketConnectionService } from './WebSocketConnectionService';

export class ConnectionServiceFactory {
  private static instance: IConnectionService | null = null;

  public static getInstance(): IConnectionService {
    if (!this.instance) {
      this.instance = new WebSocketConnectionService();
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }
}
