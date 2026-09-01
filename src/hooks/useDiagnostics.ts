import { useState, useEffect, useRef } from 'react';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import { useConnection } from './useConnection';
import { useCameraStats } from './useCamera';
import { NodeHealthMetrics } from '../types/settings';
import { APP_METADATA } from '../utils/constants';

export const useDiagnostics = (): NodeHealthMetrics => {
  const { pingMs, reconnectAttempts, lastReconnectDelayMs, lastDisconnectReason } = useConnection();
  const { frameStats, cameraHealthState } = useCameraStats();

  const [metrics, setMetrics] = useState<NodeHealthMetrics>({
    pingMs: 0,
    fps: 0,
    droppedFrames: 0,
    overwriteFrames: 0,
    staleFrames: 0,
    capturedFrames: 0,
    captureFailures: 0,
    framesSent: 0,
    avgEncodeTimeMs: 0,
    avgSendTimeMs: 0,
    frameRoundTripMs: 0,
    serverProcessingMs: 0,
    serverQueueMs: 0,
    resolution: '—',
    socketBufferPeakBytes: 0,
    currentCaptureIntervalMs: 500,
    batteryLevel: 0,
    batteryCharging: false,
    reconnectCount: 0,
    reconnectAttempts: 0,
    lastReconnectDelayMs: 0,
    lastDisconnectReason: 'None (Active Session)',
    wifiIp: '—',
    lastHeartbeat: Date.now(),
    lastFrameTime: Date.now(),
    appVersion: APP_METADATA.version,
    protocolVersion: APP_METADATA.protocolVersion,
    cameraHealthState: 'Idle',
  });

  // Fetch real battery and IP once on mount, then poll every 30s
  useEffect(() => {
    let mounted = true;

    const fetchDeviceData = async () => {
      try {
        const [batteryLevel, batteryState, networkState] = await Promise.all([
          Battery.getBatteryLevelAsync(),
          Battery.getBatteryStateAsync(),
          Network.getIpAddressAsync().catch(() => '—'),
        ]);

        if (!mounted) return;

        setMetrics((prev) => ({
          ...prev,
          batteryLevel: Math.round((batteryLevel ?? 0) * 100),
          batteryCharging: batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL,
          wifiIp: typeof networkState === 'string' ? networkState : '—',
        }));
      } catch {
        // Device data unavailable — leave defaults
      }
    };

    fetchDeviceData();
    const devicePoll = setInterval(fetchDeviceData, 30000);

    return () => {
      mounted = false;
      clearInterval(devicePoll);
    };
  }, []);

  // Sync live streaming / connection stats every 1.5s
  const frameStatsRef = useRef(frameStats);
  const pingMsRef = useRef(pingMs);
  const cameraHealthStateRef = useRef(cameraHealthState);
  const reconnectAttemptsRef = useRef(reconnectAttempts);
  const lastReconnectDelayMsRef = useRef(lastReconnectDelayMs);
  const lastDisconnectReasonRef = useRef(lastDisconnectReason);

  useEffect(() => {
    frameStatsRef.current = frameStats;
    pingMsRef.current = pingMs;
    cameraHealthStateRef.current = cameraHealthState;
    reconnectAttemptsRef.current = reconnectAttempts;
    lastReconnectDelayMsRef.current = lastReconnectDelayMs;
    lastDisconnectReasonRef.current = lastDisconnectReason;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = frameStatsRef.current;
      const ping = pingMsRef.current;
      const health = cameraHealthStateRef.current;
      const recAttempts = reconnectAttemptsRef.current;
      const recDelay = lastReconnectDelayMsRef.current;
      const discReason = lastDisconnectReasonRef.current;

      setMetrics((prev) => ({
        ...prev,
        pingMs: ping || 0,
        fps: stats.currentFps,
        droppedFrames: stats.droppedFrames,
        overwriteFrames: stats.overwriteFrames || 0,
        staleFrames: stats.staleFrames,
        capturedFrames: stats.capturedFrames,
        captureFailures: stats.captureFailures,
        framesSent: stats.framesSent,
        avgEncodeTimeMs: stats.avgEncodeTimeMs || 0,
        avgSendTimeMs: stats.avgSendTimeMs || 0,
        frameRoundTripMs: stats.frameRoundTripMs || 0,
        serverProcessingMs: stats.serverProcessingMs || 0,
        serverQueueMs: stats.serverQueueMs || 0,
        resolution: stats.resolution || '—',
        socketBufferPeakBytes: stats.socketBufferPeakBytes || 0,
        currentCaptureIntervalMs: stats.currentCaptureIntervalMs || 500,
        reconnectAttempts: recAttempts,
        lastReconnectDelayMs: recDelay,
        lastDisconnectReason: discReason,
        lastHeartbeat: Date.now(),
        lastFrameTime: stats.lastFrameTime,
        cameraHealthState: health,
      }));
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return metrics;
};
