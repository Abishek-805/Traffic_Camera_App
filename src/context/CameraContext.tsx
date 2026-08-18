import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { CameraSettings, FrameStats, CameraType, VideoQuality } from '../types/camera';
import { CameraHealthState } from '../types/camera-health';
import { CameraService } from '../camera/CameraService';
import { CameraStreamingService } from '../services/camera/CameraStreamingService';
import { CameraLogger } from '../utils/logger';

// 1. Settings Context (Static, updates rarely)
interface CameraSettingsContextType {
  settings: CameraSettings;
  setFacing: (facing: CameraType) => void;
  setResolution: (resolution: VideoQuality) => void;
  toggleTorch: () => void;
  setZoom: (zoom: number) => void;
}

export const CameraSettingsContext = createContext<CameraSettingsContextType | null>(null);

// 2. Stats & Controls Context (Updates frequently)
interface CameraStatsContextType {
  frameStats: FrameStats;
  cameraHealthState: CameraHealthState;
  cameraKey: number;
  startRealStream: (cameraRef: any) => void;
  stopRealStream: () => void;
  handleFrameSampled: (frameData: { base64: string; width: number; height: number; timestamp: number }) => void;
  startMockStream: (targetFps?: number) => void;
  stopMockStream: () => void;
}

export const CameraStatsContext = createContext<CameraStatsContextType | null>(null);

const defaultStats: FrameStats = {
  currentFps: 0,
  targetFps: 30,
  framesSent: 0,
  droppedFrames: 0,
  overwriteFrames: 0,
  staleFrames: 0,
  capturedFrames: 0,
  captureFailures: 0,
  avgEncodeTimeMs: 0,
  avgSendTimeMs: 0,
  socketBufferPeakBytes: 0,
  currentCaptureIntervalMs: 500,
  lastFrameTime: Date.now(),
  resolution: '640x360',
};

export const CameraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cameraService] = useState(() => new CameraService());
  const [streamingService] = useState(() => new CameraStreamingService());

  const [settings, setSettingsState] = useState<CameraSettings>(cameraService.getSettings());
  const [frameStats, setFrameStats] = useState<FrameStats>(defaultStats);
  const [cameraHealthState, setCameraHealthState] = useState<CameraHealthState>(CameraHealthState.Idle);
  const [cameraKey, setCameraKey] = useState<number>(0);
  
  // Track current cameraRef for AppState resume
  const [activeCameraRef, setActiveCameraRef] = useState<any>(null);

  useEffect(() => {
    const unsubStats = streamingService.onStatsUpdate((stats) => {
      setFrameStats(stats);
    });

    const unsubHealth = streamingService.onHealthStateChange((health) => {
      setCameraHealthState(health);
    });

    return () => {
      unsubStats();
      unsubHealth();
    };
  }, [streamingService]);

  const handleCameraRestart = useCallback(() => {
    // Increment key to force remount of CameraView
    setCameraKey((prev) => prev + 1);
  }, []);

  // AppState handler for automatic pausing and resuming on background / foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const state = streamingService.getHealthState();
      if (state !== CameraHealthState.Idle && state !== CameraHealthState.Stopped) {
        if (nextState === 'background') {
          CameraLogger.log('Recovery started', { reason: 'App backgrounded' });
          streamingService.stopRealStream(); // Pause safely on background
        } else if (nextState === 'active') {
          CameraLogger.log('Recovery completed', { reason: 'App returned to foreground' });
          if (activeCameraRef) {
            streamingService.startRealStream(activeCameraRef, cameraService.getSettings(), handleCameraRestart);
          }
        }
      }
    });

    return () => subscription.remove();
  }, [streamingService, activeCameraRef, cameraService, handleCameraRestart]);

  const setFacing = useCallback((facing: CameraType) => {
    cameraService.setFacing(facing);
    setSettingsState(cameraService.getSettings());
  }, [cameraService]);

  const setResolution = useCallback((resolution: VideoQuality) => {
    cameraService.setResolution(resolution);
    setSettingsState(cameraService.getSettings());
  }, [cameraService]);

  const toggleTorch = useCallback(() => {
    setSettingsState((prevSettings) => {
      const nextTorch = !prevSettings.torch;
      cameraService.setTorch(nextTorch);
      return cameraService.getSettings();
    });
  }, [cameraService]);

  const setZoom = useCallback((zoom: number) => {
    cameraService.setZoom(zoom);
    setSettingsState(cameraService.getSettings());
  }, [cameraService]);

  const startRealStream = useCallback((cameraRef: any) => {
    setActiveCameraRef(cameraRef);
    streamingService.startRealStream(cameraRef, cameraService.getSettings(), handleCameraRestart);
  }, [streamingService, cameraService, handleCameraRestart]);

  const stopRealStream = useCallback(() => {
    setActiveCameraRef(null);
    streamingService.stopRealStream();
  }, [streamingService]);

  const handleFrameSampled = useCallback((frameData: { base64: string; width: number; height: number; timestamp: number }) => {
    streamingService.handleFrameSampled(frameData);
  }, [streamingService]);

  const startMockStream = useCallback((targetFps: number = 30) => {
    streamingService.startMockStream(targetFps);
  }, [streamingService]);

  const stopMockStream = useCallback(() => {
    streamingService.stopMockStream();
  }, [streamingService]);

  return (
    <CameraSettingsContext.Provider
      value={{
        settings,
        setFacing,
        setResolution,
        toggleTorch,
        setZoom,
      }}
    >
      <CameraStatsContext.Provider
        value={{
          frameStats,
          cameraHealthState,
          cameraKey,
          startRealStream,
          stopRealStream,
          handleFrameSampled,
          startMockStream,
          stopMockStream,
        }}
      >
        {children}
      </CameraStatsContext.Provider>
    </CameraSettingsContext.Provider>
  );
};

export const useCameraSettings = () => {
  const context = useContext(CameraSettingsContext);
  if (!context) {
    throw new Error('useCameraSettings must be used within a CameraProvider');
  }
  return context;
};

export const useCameraStats = () => {
  const context = useContext(CameraStatsContext);
  if (!context) {
    throw new Error('useCameraStats must be used within a CameraProvider');
  }
  return context;
};

// Expose legacy hook mapped to Settings Context for backward compatibility
export const useCamera = () => {
  return useCameraSettings();
};
