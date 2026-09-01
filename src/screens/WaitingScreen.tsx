import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { Header } from '../components/Header';
import { StatusCard } from '../components/StatusCard';
import { useConnection } from '../hooks/useConnection';
import { useCameraStats } from '../hooks/useCamera';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Waiting'>;

export const WaitingScreen: React.FC<Props> = ({ navigation }) => {
  const { connectionState, connectionInfo, pingMs, requestStartStream, disconnect } = useConnection();
  const { frameStats } = useCameraStats();

  useEffect(() => {
    if (connectionState === 'STREAMING') {
      navigation.replace('Streaming');
    }
  }, [connectionState, navigation]);

  const handleRequestStartStream = () => {
    requestStartStream();
  };

  const handleDisconnect = async () => {
    await disconnect('User cancelled waiting state');
    navigation.replace('Disconnected', { reason: 'Registration cancelled by user.' });
  };

  return (
    <View style={styles.container}>
      <Header title="Camera Node Ready" />

      <View style={styles.content}>
        <Surface style={styles.statusBox} elevation={3}>
          <View style={styles.pulseBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.badgeLabel}>REGISTERED & READY</Text>
          </View>

          <MaterialCommunityIcons name="clock-outline" size={48} color={AppColors.waiting} style={styles.icon} />

          <Text style={styles.mainTitle}>Waiting for Laptop</Text>
          <Text style={styles.subTitle}>
            Connected to laptop server. The camera node is waiting for the laptop AI controller to send the <Text style={styles.highlight}>START_STREAM</Text> signal.
          </Text>
        </Surface>

        <StatusCard
          server={connectionInfo?.server || DEFAULT_SETTINGS.serverHost}
          port={connectionInfo?.port || DEFAULT_SETTINGS.serverPort}
          cameraId={connectionInfo?.cameraId || 'CAM-001'}
          assignedLane={connectionInfo?.assignedLane || 'North Intersection - Lane 1'}
          pingMs={pingMs}
          fps={frameStats.currentFps}
          connectionState={connectionState}
        />

        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={handleRequestStartStream}
            buttonColor={AppColors.primary}
            textColor="#000"
            style={styles.primaryBtn}
            icon="play-circle"
          >
            Request streaming
          </Button>

          <Button
            mode="outlined"
            onPress={handleDisconnect}
            textColor={AppColors.disconnected}
            style={styles.discBtn}
          >
            Disconnect Node
          </Button>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 16,
    justifyContent: 'center',
  },
  statusBox: {
    backgroundColor: AppColors.surface,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 171, 0, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.waiting,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.waiting,
    letterSpacing: 1,
  },
  icon: {
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 13,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  highlight: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  actionContainer: {
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 12,
  },
  discBtn: {
    borderColor: 'rgba(255, 82, 82, 0.3)',
    borderRadius: 12,
  },
});
