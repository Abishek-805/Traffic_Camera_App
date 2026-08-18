import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { Header } from '../components/Header';
import { useConnection } from '../hooks/useConnection';
import { AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Disconnected'>;

export const DisconnectedScreen: React.FC<Props> = ({ route, navigation }) => {
  const { reconnect } = useConnection();
  const reason = route.params?.reason || 'The wireless camera node session has ended.';

  const handleQuickReconnect = async () => {
    try {
      await reconnect();
      navigation.replace('Waiting');
    } catch {
      navigation.replace('Scanner');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Node Disconnected" />

      <View style={styles.content}>
        <Surface style={styles.box} elevation={3}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="power-plug-off" size={48} color={AppColors.disconnected} />
          </View>

          <Text style={styles.title}>Camera Node Disconnected</Text>
          <Text style={styles.reasonText}>{reason}</Text>

          <View style={styles.btnStack}>
            <Button
              mode="contained"
              onPress={handleQuickReconnect}
              buttonColor={AppColors.primary}
              textColor="#000"
              icon="refresh"
            >
              Quick Reconnect
            </Button>

            <Button
              mode="outlined"
              onPress={() => navigation.replace('Scanner')}
              textColor={AppColors.textPrimary}
              icon="qrcode-scan"
            >
              Scan New Authorization QR
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.replace('Home')}
              textColor={AppColors.textSecondary}
            >
              Return to Dashboard
            </Button>
          </View>
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
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  btnStack: {
    width: '100%',
    gap: 12,
  },
});
