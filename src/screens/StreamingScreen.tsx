import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { CameraPreview } from '../components/CameraPreview';
import { useConnection } from '../hooks/useConnection';
import { useCameraSettings, useCameraStats } from '../hooks/useCamera';
import { AppColors } from '../theme';
import { CameraLogger } from '../utils/logger';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSettings } from '../hooks/useSettings';

import { CameraMode } from '../types/camera';
import { CameraCaptureService } from '../services/camera/CameraCaptureService';

type Props = NativeStackScreenProps<RootStackParamList, 'Streaming'>;

export const StreamingScreen: React.FC<Props> = ({ navigation }) => {
  const { settings: appSettings } = useSettings();
  const { connectionState, connectionInfo, pingMs, requestStopStream, disconnect } = useConnection();
  
  // Settings context (updates rarely, won't cause stats-driven re-renders)
  const { settings, setFacing, toggleTorch } = useCameraSettings();
  
  // Stats and Controls context (updates frequently)
  const { frameStats, cameraHealthState, startRealStream, stopRealStream, handleFrameSampled } = useCameraStats();
  
  const cameraRef = useRef<any>(null);
  useEffect(() => {
    if (appSettings.keepScreenOn && connectionState === 'STREAMING') {
      activateKeepAwakeAsync('traffic-stream').catch(() => {});
    }
    return () => { deactivateKeepAwake('traffic-stream'); };
  }, [appSettings.keepScreenOn, connectionState]);

  // The native preview owns sampling; the service owns uploads. No forced remounts.
  useEffect(() => {
    if (connectionState === 'STREAMING') startRealStream(cameraRef.current);
    else stopRealStream();
    if (connectionState === 'WAITING') navigation.replace('Waiting');
    if (connectionState === 'DISCONNECTED' || connectionState === 'ERROR') {
      navigation.replace('Disconnected', { reason: 'Connection ended. Reconnect to resume streaming.' });
    }
    return stopRealStream;
  }, [connectionState, startRealStream, stopRealStream, navigation]);

  const handleStopStreaming = () => {
    requestStopStream(); // Navigation changes only when the server acknowledges STOP.
  };

  const handleDisconnectNode = async () => {
    stopRealStream();
    await disconnect('User stopped camera node stream');
    navigation.replace('Disconnected', { reason: 'Camera node streaming session ended.' });
  };

  const getHealthBadgeStyle = (state: string) => {
    switch (state) {
      case 'CameraError':
        return { borderColor: 'rgba(255, 82, 82, 0.4)' };
      case 'Recovering':
        return { borderColor: 'rgba(255, 171, 0, 0.4)' };
      case 'Busy':
        return { borderColor: 'rgba(0, 229, 255, 0.4)' };
      case 'Streaming':
        return { borderColor: 'rgba(76, 175, 80, 0.4)' };
      default:
        return { borderColor: 'rgba(255, 255, 255, 0.2)' };
    }
  };

  const getHealthDotStyle = (state: string) => {
    switch (state) {
      case 'CameraError':
        return { backgroundColor: '#FF5252' };
      case 'Recovering':
        return { backgroundColor: '#FFAB00' };
      case 'Busy':
        return { backgroundColor: '#00E5FF' };
      case 'Streaming':
        return { backgroundColor: '#4CAF50' };
      case 'Ready':
        return { backgroundColor: '#8BC34A' };
      case 'Starting':
        return { backgroundColor: '#FFEB3B' };
      default:
        return { backgroundColor: '#9E9E9E' };
    }
  };

  const getHealthText = (state: string) => {
    switch (state) {
      case 'CameraError':
        return 'CAMERA ERROR';
      case 'Recovering':
        return 'RECOVERING';
      case 'Busy':
        return 'CAPTURE BUSY';
      case 'Streaming':
        return 'LIVE STREAMING';
      case 'Ready':
        return 'CAMERA READY';
      case 'Starting':
        return 'STARTING';
      default:
        return 'CAMERA IDLE';
    }
  };

  return (
    <View style={styles.container}>
      {/* CameraPreview is a sibling. Explicitly pass mode={CameraMode.VISION_CAMERA} and onFrameSampled */}
      <CameraPreview
        cameraRef={cameraRef}
        mode={CameraMode.VISION_CAMERA}
        isStreaming={connectionState === 'STREAMING'}
        onFrameSampled={handleFrameSampled}
        showOverlayControls={false}
        autofocus="off"
      />

      {/* Sibling HUD Overlays */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        {/* Top HUD Overlay */}
        <View style={styles.topHud}>
          <Surface style={[styles.hudBadge, getHealthBadgeStyle(cameraHealthState)]} elevation={4}>
            <View style={[styles.liveDot, getHealthDotStyle(cameraHealthState)]} />
            <Text style={styles.liveText}>{getHealthText(cameraHealthState)}</Text>
          </Surface>

          <View style={styles.laneBadge}>
            <Text style={styles.laneText}>{connectionInfo?.assignedLane || 'Lane 1'}</Text>
          </View>
        </View>

        {/* Center Stats HUD */}
        <View style={styles.statsHud}>
          <View style={styles.statPill}>
            <MaterialCommunityIcons name="speedometer" size={14} color={AppColors.primary} />
            <Text style={styles.statVal}>{frameStats.currentFps} FPS</Text>
          </View>

          <View style={styles.statPill}>
            <MaterialCommunityIcons name="signal" size={14} color={AppColors.connected} />
            <Text style={styles.statVal}>
              {frameStats.frameRoundTripMs > 0 ? `${frameStats.frameRoundTripMs} ms frame RTT` : pingMs > 0 ? `${pingMs} ms network` : 'Measuring RTT'}
            </Text>
          </View>

          <View style={styles.statPill}>
            <MaterialCommunityIcons name="video-input-hdmi" size={14} color={AppColors.textSecondary} />
            <Text style={styles.statVal}>{frameStats.resolution || settings.resolution}</Text>
          </View>
        </View>

        {/* Bottom Control Dock */}
        <View style={styles.bottomDock}>
          <Surface style={styles.dockBar} elevation={5}>
            <TouchableOpacity style={styles.dockBtn} onPress={toggleTorch}>
              <MaterialCommunityIcons
                name={settings.torch ? 'flash' : 'flash-off'}
                size={24}
                color={settings.torch ? AppColors.primary : AppColors.textPrimary}
              />
              <Text style={styles.dockBtnText}>Torch</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dockBtn} onPress={() => setFacing(settings.facing === 'back' ? 'front' : 'back')}>
              <MaterialCommunityIcons name="camera-flip" size={24} color={AppColors.textPrimary} />
              <Text style={styles.dockBtnText}>Flip</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dockBtn} onPress={handleStopStreaming}>
              <MaterialCommunityIcons name="pause-circle" size={24} color={AppColors.waiting} />
              <Text style={styles.dockBtnText}>Pause</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dockBtn} onPress={handleDisconnectNode}>
              <MaterialCommunityIcons name="power" size={24} color={AppColors.disconnected} />
              <Text style={styles.dockBtnText}>Disconnect</Text>
            </TouchableOpacity>
          </Surface>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topHud: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textPrimary,
    letterSpacing: 1,
  },
  laneBadge: {
    backgroundColor: 'rgba(21, 28, 44, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  laneText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  statsHud: {
    position: 'absolute',
    top: 100,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statVal: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  bottomDock: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
  },
  dockBar: {
    backgroundColor: 'rgba(21, 28, 44, 0.9)',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  dockBtn: {
    alignItems: 'center',
    gap: 4,
  },
  dockBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
});
