import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '../theme';
import { useCameraSettings } from '../hooks/useCamera';
import { CameraLogger } from '../utils/logger';

let VisionCamModule: any = null;
try {
  VisionCamModule = require('react-native-vision-camera');
} catch (e) {
  VisionCamModule = null;
}

interface VisionCameraPreviewProps {
  children?: React.ReactNode;
  onFrameSampled?: (frameData: { base64: string; width: number; height: number; timestamp: number }) => void;
  isStreaming?: boolean;
  cameraRef?: React.RefObject<any>;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
  }
  return btoa(binary);
};

export const VisionCameraPreview: React.FC<VisionCameraPreviewProps> = React.memo(({
  children,
  onFrameSampled,
  isStreaming = false,
  cameraRef,
}) => {
  if (!VisionCamModule || !VisionCamModule.Camera) {
    return (
      <View style={styles.darkBackground}>
        <Text style={styles.errorText}>
          Vision Camera (NitroModules) is not supported in Expo Go. Please use Expo Camera mode.
        </Text>
      </View>
    );
  }

  return (
    <VisionCameraInner cameraRef={cameraRef} onFrameSampled={onFrameSampled} isStreaming={isStreaming}>
      {children}
    </VisionCameraInner>
  );
});

const VisionCameraInner: React.FC<VisionCameraPreviewProps> = ({ children, onFrameSampled, cameraRef }) => {
  const { Camera, useCameraDevice, useCameraPermission, useFrameOutput } = VisionCamModule;
  const { hasPermission, requestPermission } = useCameraPermission();
  const { settings } = useCameraSettings();
  const device = useCameraDevice(settings.facing);
  
  const instanceIdRef = useRef(`VISION_CAM_${Math.floor(Math.random() * 10000)}`);
  const lastSampleTimeRef = useRef(0);
  const onFrameSampledRef = useRef(onFrameSampled);
  onFrameSampledRef.current = onFrameSampled;

  useEffect(() => {
    CameraLogger.log('CAMERA_MOUNT', { instanceId: instanceIdRef.current, mode: 'VISION_CAMERA' });
    return () => {
      CameraLogger.log('CAMERA_UNMOUNT', { instanceId: instanceIdRef.current, mode: 'VISION_CAMERA' });
    };
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const frameOutput = useFrameOutput({
    onFrame(frame: any) {
      const now = Date.now();
      if (now - lastSampleTimeRef.current >= 500) {
        lastSampleTimeRef.current = now;
        
        // Execute heavy frame extraction asynchronously off the native frame loop
        setTimeout(() => {
          try {
            let processed = false;
            // Option A: Nitro FrameConverter
            if (VisionCamModule.FrameConverter && typeof VisionCamModule.FrameConverter.convertFrameToImage === 'function') {
              const img = VisionCamModule.FrameConverter.convertFrameToImage(frame);
              if (img) {
                const resized = img.resize(640, 360);
                const encoded = resized.toEncodedImageData('jpg', 25);
                const base64 = arrayBufferToBase64(encoded.buffer);
                if (onFrameSampledRef.current && base64) {
                  onFrameSampledRef.current({
                    base64,
                    width: 640,
                    height: 360,
                    timestamp: now,
                  });
                  processed = true;
                }
              }
            }

            // Option B: Non-interrupting Preview Surface Snapshot Fallback
            if (!processed && cameraRef?.current && typeof cameraRef.current.takeSnapshot === 'function') {
              cameraRef.current.takeSnapshot().then((img: any) => {
                if (img) {
                  const resized = img.resize(640, 360);
                  const encoded = resized.toEncodedImageData('jpg', 25);
                  const base64 = arrayBufferToBase64(encoded.buffer);
                  if (onFrameSampledRef.current && base64) {
                    onFrameSampledRef.current({
                      base64,
                      width: 640,
                      height: 360,
                      timestamp: now,
                    });
                  }
                }
              }).catch((err: any) => {
                CameraLogger.log('SNAPSHOT_PROCESS_ERROR', { error: err?.message || String(err) });
              });
            }
          } catch (err: any) {
            CameraLogger.log('FRAME_PROCESS_ERROR', { error: err?.message || String(err) });
          }
        }, 0);
      }
      frame.dispose();
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={48} color={AppColors.disconnected} />
        <Text style={styles.permissionTitle}>Vision Camera Permission Required</Text>
        <Button mode="contained" onPress={requestPermission} buttonColor={AppColors.primary} textColor="#000">
          Grant Permission
        </Button>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.darkBackground}>
        <Text style={styles.errorText}>No camera device found for facing: {settings.facing}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        torchMode={settings.torch ? 'on' : 'off'}
        resizeMode="cover"
        outputs={[frameOutput]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  darkBackground: {
    flex: 1,
    backgroundColor: AppColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: AppColors.disconnected,
    textAlign: 'center',
  },
});
