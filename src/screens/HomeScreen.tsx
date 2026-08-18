import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { Header } from '../components/Header';
import { StatusCard } from '../components/StatusCard';
import { useConnection } from '../hooks/useConnection';
import { useCameraStats } from '../hooks/useCamera';
import { AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { connectionState, connectionInfo, pingMs } = useConnection();
  const { frameStats } = useCameraStats();

  const handleStartConnection = () => {
    if (connectionState === 'WAITING') {
      navigation.navigate('Waiting');
    } else if (connectionState === 'STREAMING') {
      navigation.navigate('Streaming');
    } else {
      navigation.navigate('Scanner');
    }
  };

  return (
    <View style={styles.container}>
      <Header onOpenSettings={() => navigation.navigate('Settings')} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <Text style={styles.subTitle}>DISTRIBUTED CAMERA NODE</Text>
          <Text style={styles.mainTitle}>Wireless Traffic Feed</Text>
          <Text style={styles.desc}>
            Pair this mobile device with the laptop running the Smart Traffic Management System to begin streaming camera data.
          </Text>
        </View>

        <StatusCard
          server={connectionInfo?.server || 'Not Connected'}
          port={connectionInfo?.port || 8000}
          cameraId={connectionInfo?.cameraId || 'CAM-001'}
          assignedLane={connectionInfo?.assignedLane || 'Unassigned'}
          pingMs={pingMs}
          fps={frameStats.currentFps}
          connectionState={connectionState}
        />

        <Surface style={styles.actionCard} elevation={2}>
          <Button
            mode="contained"
            onPress={handleStartConnection}
            buttonColor={AppColors.primary}
            textColor="#000"
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
            icon={() => <MaterialCommunityIcons name="qrcode-scan" size={22} color="#000" />}
          >
            {connectionState === 'STREAMING'
              ? 'View Live Streaming Feed'
              : connectionState === 'WAITING'
                ? 'View Waiting Node Screen'
                : 'Scan QR to Pair Node'}
          </Button>

          <View style={styles.rowBtns}>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Diagnostics')}
              style={styles.halfBtn}
              textColor={AppColors.textPrimary}
              icon="pulse"
            >
              Diagnostics
            </Button>

            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Settings')}
              style={styles.halfBtn}
              textColor={AppColors.textPrimary}
              icon="cog"
            >
              Settings
            </Button>
          </View>
        </Surface>

        {/* Demo Fast-Connect Mock Trigger for Testing */}
        <View style={styles.devNoticeBox}>
          <MaterialCommunityIcons name="information" size={18} color={AppColors.primary} />
          <Text style={styles.devNoticeText}>
            Phase 1 Mode: Scanning QR code simulates laptop handshake, device registration, and capability exchange.
          </Text>
        </View>
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
  },
  heroSection: {
    marginTop: 8,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
  actionCard: {
    backgroundColor: AppColors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 12,
  },
  btnContent: {
    height: 48,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  halfBtn: {
    flex: 1,
    borderColor: AppColors.border,
  },
  devNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    gap: 10,
  },
  devNoticeText: {
    flex: 1,
    fontSize: 11,
    color: AppColors.textSecondary,
    lineHeight: 15,
  },
});
