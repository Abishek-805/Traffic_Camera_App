import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Surface, Button } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { Header } from '../components/Header';
import { useConnection } from '../hooks/useConnection';
import { AppColors } from '../theme';


type Props = NativeStackScreenProps<RootStackParamList, 'Connecting'>;

export const ConnectingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { connectWithQR, disconnect } = useConnection();
  const mounted = useRef(true);
  const attempt = useRef(0);
  const connected = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const payload = route.params.payload;
  const { server, port, session } = payload;

  const startHandshake = useCallback(async () => {
    const attemptId = ++attempt.current;
    setErrorMsg(null);
    try {
      if (payload.expires <= Date.now()) throw new Error('Pairing QR expired. Scan a new code.');
      await connectWithQR(payload);
      if (mounted.current && attempt.current === attemptId) {
        connected.current = true;
        navigation.replace('Waiting');
      }
    } catch (err: any) {
      if (mounted.current && attempt.current === attemptId) {
        setErrorMsg(err.message || 'Connection to laptop timed out.');
      }
    }
  }, [connectWithQR, navigation, payload]);

  useEffect(() => {
    mounted.current = true;
    startHandshake();
    return () => {
      mounted.current = false;
      attempt.current += 1;
      if (!connected.current) disconnect('Pairing cancelled').catch(() => {});
    };
  }, [disconnect, startHandshake]);

  const cancelPairing = async () => {
    attempt.current += 1;
    await disconnect('Pairing cancelled');
    navigation.replace('Home');
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
          <Text style={styles.sessionText}>Node session: {session}</Text>

          {!errorMsg ? (
            <View style={styles.stepsContainer}>
              <Text style={styles.stepText}>Connecting to {payload.defaultLane || payload.camera_direction}…</Text>
              <Text style={styles.stepText}>Waiting for server registration acknowledgment.</Text>
            </View>
          ) : (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <View style={styles.btnRow}>
                <Button mode="contained" onPress={startHandshake} buttonColor={AppColors.primary} textColor="#000">
                  Retry Handshake
                </Button>
                <Button mode="outlined" onPress={cancelPairing} textColor={AppColors.textPrimary}>
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
