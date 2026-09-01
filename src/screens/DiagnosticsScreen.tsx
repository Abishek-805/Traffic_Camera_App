import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { Header } from '../components/Header';
import { useDiagnostics } from '../hooks/useDiagnostics';
import { AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Diagnostics'>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const Row = ({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.val, valueColor ? { color: valueColor } : null]}>{value}</Text>
  </View>
);

const Panel = ({
  title,
  icon,
  iconColor,
  children,
}: {
  title: string;
  icon: string;
  iconColor: string;
  children: React.ReactNode;
}) => (
  <Surface style={styles.card} elevation={2}>
    <View style={styles.cardHeaderRow}>
      <MaterialCommunityIcons name={icon as any} size={14} color={iconColor} />
      <Text style={[styles.cardHeader, { color: iconColor }]}>{title}</Text>
    </View>
    {children}
  </Surface>
);

// ─── Screen ─────────────────────────────────────────────────────────────────

export const DiagnosticsScreen: React.FC<Props> = ({ navigation }) => {
  const d = useDiagnostics();

  const fpsColor =
    d.fps >= 1.5 ? AppColors.connected : d.fps > 0 ? AppColors.waiting : AppColors.disconnected;
  const pingColor =
    d.pingMs < 50 ? AppColors.connected : d.pingMs < 150 ? AppColors.waiting : AppColors.disconnected;
  const bufferKb = (d.socketBufferPeakBytes / 1024).toFixed(1);
  const batteryColor =
    d.batteryLevel > 30 ? AppColors.connected : d.batteryLevel > 15 ? AppColors.waiting : AppColors.disconnected;

  return (
    <View style={styles.container}>
      <Header title="Node Telemetry & Diagnostics" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Panel 1: Mobile Camera ───────────────────────────────────────── */}
        <Panel title="MOBILE CAMERA" icon="camera" iconColor={AppColors.primary}>
          <Row label="Capture FPS" value={`${d.fps} FPS`} valueColor={fpsColor} />
          <Row label="Capture Interval" value={`${d.currentCaptureIntervalMs} ms`} />
          <Row label="Frames Captured" value={`${d.capturedFrames}`} valueColor={AppColors.textPrimary} />
          <Row label="Capture Failures" value={`${d.captureFailures}`} valueColor={d.captureFailures > 0 ? AppColors.disconnected : AppColors.textPrimary} />
          <Row label="Stale Frames Discarded" value={`${d.staleFrames}`} valueColor={d.staleFrames > 0 ? AppColors.waiting : AppColors.textPrimary} />
          <Row label="Camera State" value={d.cameraHealthState} valueColor={AppColors.primary} />
        </Panel>

        {/* ── Panel 2: Network ─────────────────────────────────────────────── */}
        <Panel title="NETWORK" icon="wifi" iconColor="#4FC3F7">
          <Row label="WebSocket Ping" value={d.pingMs > 0 ? `${d.pingMs} ms` : '— ms'} valueColor={d.pingMs > 0 ? pingColor : AppColors.textSecondary} />
          <Row label="Socket Buffer Peak" value={`${bufferKb} KB`} valueColor={d.socketBufferPeakBytes > 128 * 1024 ? AppColors.waiting : AppColors.textPrimary} />
          <Row label="Backpressure Drops" value={`${d.droppedFrames}`} valueColor={d.droppedFrames > 0 ? AppColors.waiting : AppColors.textPrimary} />
          <Row label="Queue Overwrites" value={`${d.overwriteFrames}`} valueColor={d.overwriteFrames > 0 ? AppColors.waiting : AppColors.textPrimary} />
          <Row label="Reconnect Attempts" value={`${d.reconnectAttempts} / 10`} />
          <Row label="Last Reconnect Backoff" value={d.lastReconnectDelayMs > 0 ? `${d.lastReconnectDelayMs} ms` : '—'} />
          <Row label="Last Disconnect Reason" value={d.lastDisconnectReason} />
        </Panel>

        {/* ── Panel 3: Stream Pipeline ─────────────────────────────────────── */}
        <Panel title="STREAM PIPELINE" icon="video-wireless" iconColor="#A5D6A7">
          <Row label="Frames Uploaded" value={`${d.framesSent}`} valueColor={AppColors.connected} />
          <Row label="Avg Upload Latency" value={`${d.avgSendTimeMs} ms`} />
          <Row label="Processed Frame RTT" value={d.frameRoundTripMs > 0 ? `${d.frameRoundTripMs} ms` : 'Measuring'} />
          <Row label="Server Processing" value={d.serverProcessingMs > 0 ? `${d.serverProcessingMs} ms` : '—'} />
          <Row label="Server Queue Wait" value={d.serverQueueMs > 0 ? `${d.serverQueueMs} ms` : '—'} />
          <Row label="Avg Capture Duration" value={`${d.avgEncodeTimeMs} ms`} />
          <Row label="Encoded Resolution" value={d.fps > 0 ? d.resolution : '—'} />
          <Row label="Last Frame" value={d.lastFrameTime ? new Date(d.lastFrameTime).toLocaleTimeString() : '—'} />
        </Panel>

        {/* ── Panel 4: Device ──────────────────────────────────────────────── */}
        <Panel title="DEVICE" icon="cellphone" iconColor="#CE93D8">
          <Row label="Battery" value={d.batteryLevel > 0 ? `${d.batteryLevel}%${d.batteryCharging ? ' ⚡' : ''}` : '—'} valueColor={d.batteryLevel > 0 ? batteryColor : AppColors.textSecondary} />
          <Row label="Device IP" value={d.wifiIp} />
          <Row label="Last Heartbeat" value={new Date(d.lastHeartbeat).toLocaleTimeString()} />
          <Row label="App Version" value={d.appVersion} />
          <Row label="Protocol Version" value={`v${d.protocolVersion}`} />
          <Row label="Node Class" value="Wireless Camera Node" />
        </Panel>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    fontSize: 13,
    color: AppColors.textSecondary,
    flex: 1,
  },
  val: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'right',
  },
});
