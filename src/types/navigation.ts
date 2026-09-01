import { QRPayload } from './connection';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Scanner: undefined;
  Connecting: { payload: QRPayload };
  Waiting: undefined;
  Streaming: undefined;
  Disconnected: { reason?: string };
  Diagnostics: undefined;
  Settings: undefined;
};
