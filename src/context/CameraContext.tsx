import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import { CameraSettings, FrameStats, CameraType, VideoQuality } from '../types/camera';
import { CameraHealthState } from '../types/camera-health';
import { CameraService } from '../camera/CameraService';
import { CameraStreamingService } from '../services/camera/CameraStreamingService';
import { StorageService } from '../utils/storage';
import { STORAGE_KEYS } from '../utils/constants';

// 1. Settings Context (Static, updates rarely)
interface CameraSettingsContextType {
  settings: CameraSettings;
  setFacing: (facing: CameraType) => void;
  setResolution: (resolution: VideoQuality) => void;
  setTargetFps: (targetFps: number) => void;
  toggleTorch: () => void;
  setZoom: (zoom: number) => void;
}

export const CameraSettingsContext = createContext<CameraSettingsContextType | null>(null);

// 2. Stats & Controls Context (Updates frequently)
interface CameraStatsContextType {
  frameStats: FrameStats;
  cameraHealthState: CameraHealthState;
  startRealStream: (cameraRef: any) => void;
  stopRealStream: () => void;
  handleFrameSampled: (frameData: { base64: string; width: number; height: number; timestamp: number; captureDurationMs?: number }) => void;
}

export const CameraStatsContext = createContext<CameraStatsContextType | null>(null);

const defaultStats: FrameStats = {
  currentFps: 0,
  targetFps: 2,
  framesSent: 0,
  droppedFrames: 0,
  overwriteFrames: 0,
  staleFrames: 0,
  capturedFrames: 0,
  captureFailures: 0,
  avgEncodeTimeMs: 0,
  avgSendTimeMs: 0,
  frameRoundTripMs: 0,
  serverProcessingMs: 0,
  serverQueueMs: 0,
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

  const persistSettings = useCallback(() => {
    StorageService.setItem(STORAGE_KEYS.CAMERA_SETTINGS, cameraService.getSettings()).catch(() => {});
  }, [cameraService]);

  useEffect(() => {
    let active = true;
    StorageService.getItem<CameraSettings>(STORAGE_KEYS.CAMERA_SETTINGS, cameraService.getSettings())
      .then((saved) => {
        if (!active) return;
        cameraService.setFacing(saved.facing === 'front' ? 'front' : 'back');
        cameraService.setResolution(['480p', '720p', '1080p'].includes(saved.resolution) ? saved.resolution : '480p');
        cameraService.setTargetFps(saved.targetFps);
        cameraService.setTorch(Boolean(saved.torch));
        cameraService.setZoom(Number.isFinite(saved.zoom) ? saved.zoom : 0);
        setSettingsState(cameraService.getSettings());
      })
      .catch(() => {});
    return () => { active = false; };
  }, [cameraService]);
  
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
      streamingService.stopRealStream();
    };
  }, [streamingService]);

  const setFacing = useCallback((facing: CameraType) => {
    cameraService.setFacing(facing);
    setSettingsState(cameraService.getSettings());
    persistSettings();
  }, [cameraService, persistSettings]);

  const setResolution = useCallback((resolution: VideoQuality) => {
    cameraService.setResolution(resolution);
    setSettingsState(cameraService.getSettings());
    persistSettings();
  }, [cameraService, persistSettings]);

  const setTargetFps = useCallback((targetFps: number) => {
    cameraService.setTargetFps(targetFps);
    setSettingsState(cameraService.getSettings());
    persistSettings();
  }, [cameraService, persistSettings]);

  const toggleTorch = useCallback(() => {
    setSettingsState((prevSettings) => {
      const nextTorch = !prevSettings.torch;
      cameraService.setTorch(nextTorch);
      persistSettings();
      return cameraService.getSettings();
    });
  }, [cameraService, persistSettings]);

  const setZoom = useCallback((zoom: number) => {
    cameraService.setZoom(zoom);
    setSettingsState(cameraService.getSettings());
    persistSettings();
  }, [cameraService, persistSettings]);

  const startRealStream = useCallback((cameraRef: any) => {
    streamingService.startRealStream(cameraRef, cameraService.getSettings());
  }, [streamingService, cameraService]);

  const stopRealStream = useCallback(() => {
    streamingService.stopRealStream();
  }, [streamingService]);

  const handleFrameSampled = useCallback((frameData: { base64: string; width: number; height: number; timestamp: number; captureDurationMs?: number }) => {
    streamingService.handleFrameSampled(frameData);
  }, [streamingService]);

  return (
    <CameraSettingsContext.Provider
      value={useMemo(() => ({ settings, setFacing, setResolution, setTargetFps, toggleTorch, setZoom }),
        [settings, setFacing, setResolution, setTargetFps, toggleTorch, setZoom])}
    >
      <CameraStatsContext.Provider
        value={{
          frameStats,
          cameraHealthState,
          startRealStream,
          stopRealStream,
          handleFrameSampled,
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
