import { IConnectionService } from './IConnectionService';
import { MockConnectionService } from './MockConnectionService';
import { WebSocketConnectionService } from './WebSocketConnectionService';

export class ConnectionServiceFactory {
  private static instance: IConnectionService | null = null;
  private static useMockMode: boolean = false; // Default to WebSocket for Phase 2

  public static getInstance(useMock?: boolean): IConnectionService {
    if (useMock !== undefined) {
      if (this.instance && this.useMockMode !== useMock) {
        this.instance = null;
      }
      this.useMockMode = useMock;
    }

    if (!this.instance) {
      this.instance = this.useMockMode
        ? new MockConnectionService()
        : new WebSocketConnectionService();
    }
    return this.instance;
  }

  public static setMockMode(useMock: boolean): void {
    if (this.useMockMode !== useMock) {
      this.useMockMode = useMock;
      this.instance = null;
    }
  }

  public static isMockMode(): boolean {
    return this.useMockMode;
  }

  public static resetInstance(): void {
    this.instance = null;
  }
}
