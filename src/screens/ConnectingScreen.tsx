import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, ActivityIndicator, Surface, Button } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { Header } from '../components/Header';
import { useConnection } from '../hooks/useConnection';
import { AppColors } from '../theme';
import { QRPayload } from '../types/connection';

type Props = NativeStackScreenProps<RootStackParamList, 'Connecting'>;

export const ConnectingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { connectWithQR } = useConnection();
  const [step, setStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const server = route.params?.server || '192.168.1.3';
  const port = route.params?.port || 8000;
  const session = route.params?.session || 'CAM-SESSION-9F8A';
  const token = route.params?.token || 'auth_token_demo';

  useEffect(() => {
    startHandshake();
  }, []);

  const startHandshake = async () => {
    setErrorMsg(null);
    setStep(1);

    try {
      const payload: QRPayload = {
        version: '1.0',
        server,
        port,
        session,
        token,
        expires: Date.now() + 3600000,
        protocol: 'websocket',
        secure: false,
        defaultLane: 'North Intersection - Lane 1',
      };

      // Step 1: Network socket connection
      await new Promise((res) => setTimeout(res, 600));
      setStep(2); // Step 2: Register device & send camera capabilities

      await new Promise((res) => setTimeout(res, 700));
      setStep(3); // Step 3: Await laptop Registration ACK

      await connectWithQR(payload);
      await new Promise((res) => setTimeout(res, 500));

      navigation.replace('Waiting');
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection to laptop timed out.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Node Registration" />

      <View style={styles.content}>
        <Surface style={styles.box} elevation={3}>
          <View style={styles.iconCircle}>
            {errorMsg ? (
              <MaterialCommunityIcons name="alert-circle" size={44} color={AppColors.disconnected} />
            ) : (
              <ActivityIndicator animating size="large" color={AppColors.primary} />
            )}
          </View>

          <Text style={styles.targetText}>{server}:{port}</Text>
          <Text style={styles.sessionText}>Session Token: {session}</Text>

          {!errorMsg ? (
            <View style={styles.stepsContainer}>
              <View style={styles.stepRow}>
                <MaterialCommunityIcons
                  name={step >= 1 ? 'check-circle' : 'radiobox-blank'}
                  size={20}
                  color={step >= 1 ? AppColors.connected : AppColors.textMuted}
                />
                <Text style={[styles.stepText, step >= 1 && styles.activeStep]}>
                  Establishing WebSocket transport
                </Text>
              </View>

              <View style={styles.stepRow}>
                <MaterialCommunityIcons
                  name={step >= 2 ? 'check-circle' : 'radiobox-blank'}
                  size={20}
                  color={step >= 2 ? AppColors.connected : AppColors.textMuted}
                />
                <Text style={[styles.stepText, step >= 2 && styles.activeStep]}>
                  Exchanging Device Info & Camera Capabilities
                </Text>
              </View>

              <View style={styles.stepRow}>
                <MaterialCommunityIcons
                  name={step >= 3 ? 'check-circle' : 'radiobox-blank'}
                  size={20}
                  color={step >= 3 ? AppColors.connected : AppColors.textMuted}
                />
                <Text style={[styles.stepText, step >= 3 && styles.activeStep]}>
                  Awaiting Laptop Registration ACK
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <View style={styles.btnRow}>
                <Button mode="contained" onPress={startHandshake} buttonColor={AppColors.primary} textColor="#000">
                  Retry Handshake
                </Button>
                <Button mode="outlined" onPress={() => navigation.replace('Home')} textColor={AppColors.textPrimary}>
                  Cancel
                </Button>
              </View>
            </View>
          )}
        </Surface>
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
    padding: 20,
    justifyContent: 'center',
  },
  box: {
    backgroundColor: AppColors.surface,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  targetText: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 4,
  },
  sessionText: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginBottom: 24,
  },
  stepsContainer: {
    width: '100%',
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepText: {
    fontSize: 13,
    color: AppColors.textMuted,
  },
  activeStep: {
    color: AppColors.textPrimary,
    fontWeight: '600',
  },
  errorBox: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: AppColors.disconnected,
    fontSize: 13,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
