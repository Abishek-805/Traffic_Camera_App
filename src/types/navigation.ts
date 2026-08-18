export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Scanner: undefined;
  Connecting: { server?: string; port?: number; session?: string; token?: string };
  Waiting: undefined;
  Streaming: undefined;
  Disconnected: { reason?: string };
  Diagnostics: undefined;
  Settings: undefined;
};
