import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { QRScanner } from '../components/QRScanner';
import { Header } from '../components/Header';
import { QRCodeService } from '../services/qr/QRCodeService';
import { AppColors } from '../theme';
import { DEFAULT_SETTINGS } from '../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBarCodeScanned = (rawText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const payload = QRCodeService.parseQRPayload(rawText);
      navigation.replace('Connecting', {
        server: payload.server,
        port: payload.port,
        session: payload.session,
        token: payload.token,
      });
    } catch (err: any) {
      Alert.alert('Invalid QR Code', err.message || 'The scanned QR code is not a valid Traffic Camera Node token.', [
        { text: 'Try Again', onPress: () => setIsProcessing(false) },
      ]);
    }
  };

  const handleSimulateScan = () => {
    const mockPayloadJSON = JSON.stringify({
      version: '1.0',
      server: DEFAULT_SETTINGS.serverHost,
      port: DEFAULT_SETTINGS.serverPort,
      session: 'CAM-LANE1-9F8A',
      token: 'auth_token_demo_9df7c6ab',
      expires: Date.now() + 3600000,
      protocol: 'websocket',
      secure: false,
      defaultLane: 'North Intersection - Lane 1',
    });
    handleBarCodeScanned(mockPayloadJSON);
  };

  return (
    <View style={styles.container}>
      <Header title="Scan Authorization QR" showBack onBack={() => navigation.goBack()} />

      <View style={styles.scannerWrapper}>
        <QRScanner onScanned={handleBarCodeScanned} />
      </View>

      <View style={styles.bottomBar}>
        <Button
          mode="contained-tonal"
          onPress={handleSimulateScan}
          buttonColor={AppColors.surface}
          textColor={AppColors.primary}
          style={styles.simBtn}
        >
          Simulate Laptop QR Scan (Phase 1)
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scannerWrapper: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  simBtn: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 20,
  },
});
