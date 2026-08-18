import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { CameraPreview } from './CameraPreview';
import { AppColors } from '../theme';
import { CameraMode } from '../types/camera';

interface QRScannerProps {
  onScanned: (data: string) => void;
}

const { width } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7;

export const QRScanner: React.FC<QRScannerProps> = ({ onScanned }) => {
  return (
    <CameraPreview onBarcodeScanned={onScanned} mode={CameraMode.PREVIEW_ONLY} showOverlayControls autofocus="on">
      <View style={styles.overlay}>
        <View style={styles.targetFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <View style={styles.promptBox}>
          <Text style={styles.promptTitle}>Align QR Code</Text>
          <Text style={styles.promptSub}>
            Scan the authorization QR code displayed on the Smart Traffic Management laptop dashboard
          </Text>
        </View>
      </View>
    </CameraPreview>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetFrame: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: AppColors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  promptBox: {
    marginTop: 32,
    backgroundColor: 'rgba(21, 28, 44, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: SCAN_SIZE + 40,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  promptTitle: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  promptSub: {
    color: AppColors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
