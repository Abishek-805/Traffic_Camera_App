import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { QRScanner } from '../components/QRScanner';
import { Header } from '../components/Header';
import { QRCodeService } from '../services/qr/QRCodeService';
import { AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const handleBarCodeScanned = (rawText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const payload = QRCodeService.parseQRPayload(rawText);
      // Unmount Expo Camera before opening VisionCamera. Android releases the
      // physical camera asynchronously, so an immediate screen replacement can
      // otherwise make the second camera session fail with "camera in use".
      transitionTimer.current = setTimeout(() => {
        navigation.replace('Connecting', { payload });
      }, 850);
    } catch (err: any) {
      Alert.alert('Invalid QR Code', err.message || 'The scanned QR code is not a valid Traffic Camera Node token.', [
        { text: 'Try Again', onPress: () => setIsProcessing(false) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Scan Camera Pairing QR" showBack onBack={() => navigation.goBack()} />

      <View style={styles.scannerWrapper}>
        {isProcessing ? (
          <View style={styles.releasingCamera}>
            <ActivityIndicator animating size="large" color={AppColors.primary} />
            <Text style={styles.releasingTitle}>QR accepted</Text>
            <Text style={styles.releasingText}>Releasing the scanner camera before starting the traffic stream…</Text>
          </View>
        ) : (
          <QRScanner onScanned={handleBarCodeScanned} />
        )}
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
  releasingCamera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
  },
  releasingTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  releasingText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
