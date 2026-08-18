import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '../theme';
import { useCamera } from '../hooks/useCamera';
import { CameraMode } from '../types/camera';
import { VisionCameraPreview } from './VisionCameraPreview';
import { CameraLogger } from '../utils/logger';

interface CameraPreviewProps {
  children?: React.ReactNode;
  onBarcodeScanned?: (data: string) => void;
  showOverlayControls?: boolean;
  cameraRef?: React.RefObject<any>;
  autofocus?: 'on' | 'off';
  mode?: CameraMode;
  onFrameSampled?: (frameData: { base64: string; width: number; height: number; timestamp: number }) => void;
}

export const CameraPreview: React.FC<CameraPreviewProps> = React.memo(({
  children,
  onBarcodeScanned,
  showOverlayControls = true,
  cameraRef,
  autofocus = 'on',
  mode = CameraMode.PREVIEW_ONLY,
  onFrameSampled,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const { settings, setFacing, toggleTorch } = useCamera();
  const instanceIdRef = useRef(`CAM_PREVIEW_${Math.floor(Math.random() * 10000)}`);
  const renderCountRef = useRef(0);
  const prevPropsRef = useRef({ facing: settings.facing, torch: settings.torch, autofocus });

  useEffect(() => {
    CameraLogger.log('CAMERA_MOUNT', { instanceId: instanceIdRef.current, cameraRefAttached: Boolean(cameraRef), mode });
    return () => {
      CameraLogger.log('CAMERA_UNMOUNT', { instanceId: instanceIdRef.current });
    };
  }, []);

  useEffect(() => {
    renderCountRef.current += 1;
    CameraLogger.log('CAMERA_RENDER', {
      instanceId: instanceIdRef.current,
      renderCount: renderCountRef.current,
      mode,
      facing: settings.facing,
      torch: settings.torch,
      autofocus,
      hasRef: Boolean(cameraRef?.current),
    });

    const prev = prevPropsRef.current;
    if (prev.facing !== settings.facing || prev.torch !== settings.torch || prev.autofocus !== autofocus) {
      CameraLogger.log('CAMERA_PROPS_CHANGED', {
        instanceId: instanceIdRef.current,
        prev,
        next: { facing: settings.facing, torch: settings.torch, autofocus },
      });
      prevPropsRef.current = { facing: settings.facing, torch: settings.torch, autofocus };
    }
  });

  useEffect(() => {
    CameraLogger.log('CAMERA_PERMISSION_CHANGE', { granted: permission?.granted });
  }, [permission?.granted]);

  if (!permission) {
    return <View style={styles.darkBackground} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={48} color={AppColors.disconnected} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionSub}>
          Traffic Camera Node needs access to your device camera to capture traffic feeds and scan QR connection codes.
        </Text>
        <Button mode="contained" onPress={requestPermission} buttonColor={AppColors.primary} textColor="#000">
          Grant Camera Permission
        </Button>
      </View>
    );
  }

  // HARD INVARIANT: VISION_CAMERA mode MUST render VisionCameraPreview and NEVER fall through to Expo CameraView
  if (mode === CameraMode.VISION_CAMERA && !onBarcodeScanned) {
    return (
      <View style={styles.container}>
        <VisionCameraPreview cameraRef={cameraRef} onFrameSampled={onFrameSampled}>
          {children}
        </VisionCameraPreview>
        {showOverlayControls && (
          <View style={styles.controlsBar}>
            <TouchableOpacity
              style={[styles.controlBtn, settings.torch && styles.activeBtn]}
              onPress={toggleTorch}
            >
              <MaterialCommunityIcons
                name={settings.torch ? 'flash' : 'flash-off'}
                size={22}
                color={settings.torch ? '#000' : AppColors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => setFacing(settings.facing === 'back' ? 'front' : 'back')}
            >
              <MaterialCommunityIcons name="camera-flip" size={22} color={AppColors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={settings.facing}
        enableTorch={settings.torch}
        flash="off"
        autofocus={autofocus}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          onBarcodeScanned
            ? (result) => {
                if (result.data) {
                  onBarcodeScanned(result.data);
                }
              }
            : undefined
        }
      />
      {children}

      {showOverlayControls && (
        <View style={styles.controlsBar}>
          <TouchableOpacity
            style={[styles.controlBtn, settings.torch && styles.activeBtn]}
            onPress={toggleTorch}
          >
            <MaterialCommunityIcons
              name={settings.torch ? 'flash' : 'flash-off'}
              size={22}
              color={settings.torch ? '#000' : AppColors.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFacing(settings.facing === 'back' ? 'front' : 'back')}
          >
            <MaterialCommunityIcons name="camera-flip" size={22} color={AppColors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  darkBackground: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  controlsBar: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'column',
    gap: 12,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(21, 28, 44, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  activeBtn: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
});
