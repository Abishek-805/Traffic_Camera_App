import React, { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ConnectionServiceFactory } from '../services/connection/ConnectionServiceFactory';
import { AppState, View, StyleSheet, Text } from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '../theme';
import { useCameraSettings } from '../hooks/useCamera';
import { CameraLogger } from '../utils/logger';
import { getStreamEncodingProfile } from '../camera/CameraService';
import { getCanonicalRotation } from '../camera/orientation';

let VisionCamModule: any = null;
try {
  VisionCamModule = require('react-native-vision-camera');
} catch (e) {
  VisionCamModule = null;
}

interface VisionCameraPreviewProps {
  children?: React.ReactNode;
  onFrameSampled?: (frameData: { base64: string; width: number; height: number; timestamp: number; captureDurationMs?: number; rotation?: number; orientation?: string }) => void;
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
          Vision Camera (NitroModules) is not supported in Expo Go. Install a development build or the standalone APK to stream.
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

const VisionCameraInner: React.FC<VisionCameraPreviewProps> = ({ children, onFrameSampled, isStreaming = false, cameraRef }) => {
  const { Camera, useCameraDevice, useCameraPermission, useOrientation } = VisionCamModule;
  const { hasPermission, requestPermission } = useCameraPermission();
  const { settings } = useCameraSettings();
  const focused = useIsFocused();
  const previewReady = useRef(false);
  const previewStartedAt = useRef(0);
  const device = useCameraDevice(settings.facing);
  const deviceOrientation = useOrientation('device');
  const deviceOrientationRef = useRef(deviceOrientation);
  deviceOrientationRef.current = deviceOrientation;
  const [cameraMounted, setCameraMounted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [restartNonce, setRestartNonce] = useState(0);
  const automaticRetries = useRef(0);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const instanceIdRef = useRef(`VISION_CAM_${Math.floor(Math.random() * 10000)}`);
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

  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const sampling = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  // Do not configure VisionCamera during the Android camera-release window
  // left by the Expo QR scanner. Delaying the component mount (rather than
  // merely isActive) prevents both engines from opening the same device.
  useEffect(() => {
    previewReady.current = false;
    previewStartedAt.current = 0;
    setCameraActive(false);
    setCameraMounted(false);
    if (!foreground || !focused || !hasPermission || !device) return;
    const timer = setTimeout(() => setCameraMounted(true), 450);
    return () => clearTimeout(timer);
  }, [foreground, focused, hasPermission, device, settings.facing, restartNonce]);

  useEffect(() => () => {
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
  }, []);

  const retryCamera = () => {
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    recoveryTimer.current = null;
    automaticRetries.current = 0;
    setCameraError(null);
    setRestartNonce(value => value + 1);
  };

  const handleCameraError = (error: any) => {
    const message = error?.message || String(error) || 'Unable to start the camera.';
    CameraLogger.log('VISION_CAMERA_ERROR', { message, retry: automaticRetries.current });
    previewReady.current = false;
    previewStartedAt.current = 0;
    setCameraActive(false);
    setCameraError(message);
    setCameraMounted(false);

    if (automaticRetries.current < 2) {
      automaticRetries.current += 1;
      const retryDelay = 900 * automaticRetries.current;
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
      recoveryTimer.current = setTimeout(() => {
        setCameraError(null);
        setRestartNonce(value => value + 1);
      }, retryDelay);
    }
  };

  // One snapshot at a time. A cancelled capture can never upload into a later session.
  // Use native async resize/encoding to avoid blocking the JS/UI thread.
  useEffect(() => {
    if (!isStreaming || !foreground || !focused || !hasPermission || !cameraMounted) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const sample = async () => {
      let owned = false;
      let image: any;
      let resized: any;
      const started = Date.now();
      try {
        if (previewReady.current && Date.now() - previewStartedAt.current >= 800 &&
            !sampling.current && cameraRef?.current?.takeSnapshot &&
            (ConnectionServiceFactory.getInstance().canCaptureFrame?.() ?? true)) {
          sampling.current = true;
          owned = true;
          image = await cameraRef.current.takeSnapshot();
          if (!cancelled && image) {
            const profile = getStreamEncodingProfile(settings.resolution);
            const scale = Math.min(1, profile.maxEdge / Math.max(image.width, image.height));
            const width = Math.max(1, Math.round(image.width * scale));
            const height = Math.max(1, Math.round(image.height * scale));
            resized = await image.resizeAsync(width, height);
            const encoded = await resized.toEncodedImageDataAsync('jpg', profile.jpegQuality);
            if (!cancelled) onFrameSampledRef.current?.({
              base64: arrayBufferToBase64(encoded.buffer), width, height, timestamp: started,
              captureDurationMs: Date.now() - started,
              rotation: getCanonicalRotation(deviceOrientationRef.current),
              orientation: deviceOrientationRef.current || 'unknown',
            });
          }
        }
      } catch (err: any) {
        if (!cancelled) CameraLogger.log('SNAPSHOT_PROCESS_ERROR', { error: err?.message || String(err) });
      } finally {
        resized?.dispose?.();
        image?.dispose?.();
        if (owned) sampling.current = false;
        const requestedFps = ConnectionServiceFactory.getInstance().getRequestedTargetFps?.();
        const intervalMs = Math.round(1000 / Math.max(1, requestedFps ?? settings.targetFps));
        if (!cancelled) timer = setTimeout(sample, Math.max(50, intervalMs - (Date.now() - started)));
      }
    };
    timer = setTimeout(sample, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cameraRef, isStreaming, foreground, focused, hasPermission, cameraMounted, settings.facing, settings.resolution, settings.targetFps]);

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

  if (!cameraMounted) {
    return (
      <View style={styles.darkBackground}>
        {cameraError ? (
          <>
            <MaterialCommunityIcons name="camera-off" size={48} color={AppColors.disconnected} />
            <Text style={styles.permissionTitle}>Camera could not start</Text>
            <Text style={styles.errorText}>{cameraError}</Text>
            <Button mode="contained" onPress={retryCamera} buttonColor={AppColors.primary} textColor="#000">
              Retry Camera
            </Button>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="timer-sand" size={48} color={AppColors.primary} />
            <Text style={styles.permissionTitle}>Preparing camera…</Text>
          </>
        )}
      </View>
    );
  }

  // A defined torchMode is applied immediately. On Android, even "off" can
  // call CameraX enableTorch() before the camera is active, so omit it until
  // preview startup completes and for devices without a flash unit.
  const torchMode = cameraActive && device.hasFlash
    ? (settings.torch ? 'on' : 'off')
    : undefined;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={foreground && focused}
        implementationMode="compatible"
        onStarted={() => CameraLogger.log('VISION_CAMERA_STARTED', { instanceId: instanceIdRef.current })}
        onError={handleCameraError}
        onPreviewStarted={() => {
          automaticRetries.current = 0;
          setCameraError(null);
          previewStartedAt.current = Date.now();
          previewReady.current = true;
          setCameraActive(true);
        }}
        onPreviewStopped={() => {
          previewReady.current = false;
          previewStartedAt.current = 0;
          setCameraActive(false);
        }}
        torchMode={torchMode}
        resizeMode="cover"
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
