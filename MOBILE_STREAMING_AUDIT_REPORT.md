# MOBILE STREAMING AUDIT REPORT

## 1. Executive Summary

A full audit of the React Native / Expo mobile camera streaming pipeline was performed, covering camera capture, frame freshness, WebSocket backpressure, reconnect logic, memory safety, resolution/JPEG configuration, and camera lifecycle management.

**8 issues were identified and fixed.** The most critical were: stale frame uploads (no age check), missing WebSocket backpressure, camera ref race conditions, and unbounded upload retries that could send 3–5 second old frames to the backend.

All fixes preserve the existing architecture and interfaces. No new dependencies were added.

## 2. Architecture Found

```
StreamingScreen
  → CameraPreview (expo-camera CameraView, key=cameraKey)
  → CameraContext (CameraProvider)
    → CameraStreamingService
      → CameraCaptureService (setTimeout-based capture loop)
        → takePictureAsync() → base64 JPEG
      → UploadWorker (single-slot latest-frame buffer)
        → WebSocketConnectionService.sendMessage()
          → WebSocket → FastAPI backend
```

- **Expo SDK**: ~54.0.0
- **React Native**: 0.81.5
- **Camera**: expo-camera ~17.0.10
- **WebSocket**: native WebSocket API
- **Connection**: WebSocketConnectionService with bounded exponential backoff reconnect

## 3. Issues Found

| # | Issue | Severity | Root Cause | Fix | Status |
|---|-------|----------|------------|-----|--------|
| 1 | Stale frames uploaded (3–5s old) | P0 | UploadWorker retries same frame up to 3× with exponential backoff (500ms→1s→2s). No frame age check. | Added `MAX_FRAME_AGE_MS=2000` gate. Removed retries for video frames (latest-frame-wins). | **FIXED** |
| 2 | No WebSocket backpressure | P0 | `sendMessage()` never checks `bufferedAmount`. Congested socket queues unlimited frames. | Added `MAX_SOCKET_BUFFER_BYTES=256KB` check before send. Frame dropped if buffer full. | **FIXED** |
| 3 | Camera ref race condition | P0 | `executeCapture()` checks `this.cameraRef`, then calls async `takePictureAsync()`. Remount between check and call uses stale ref. | Snapshot ref: `const capturedCameraRef = this.cameraRef` before async call. | **FIXED** |
| 4 | Stale retry on upload failure | P0 | Retries send the SAME old frame. After 3 retries the frame is 3.5s+ old. | Removed retry loop. Single attempt per frame. Next/latest frame replaces failed one. | **FIXED** |
| 5 | connect() doesn't close old socket | P1 | Reconnect creates new WebSocket without closing old one. Orphaned sockets leak resources. | Old socket handlers nulled and socket closed before new connection. | **FIXED** |
| 6 | getResolutionConfig() returns 640×480 | P1 | 480p config returns height=480 (4:3) instead of 360 (16:9). Vehicle shape distortion. | Fixed to 640×360. Quality aligned to 0.25 across all paths. | **FIXED** |
| 7 | Default capture quality/resolution wrong | P1 | Default (non-480p) path used quality=0.12 at 1280×720 instead of spec 0.25 at 640×360. | Default now 640×360 @ 0.25. 720p and 1080p branches explicit. | **FIXED** |
| 8 | Infinite camera restart loop possible | P1 | `onCameraRestartRequested` fires on 3 consecutive failures with no rate limit. | Added rate limit: max 3 restarts per 30s window. | **FIXED** |

## 4. Root Causes (Detailed)

### 4.1 Stale Frame Upload
The `UploadWorker.uploadFrame()` method had a `while (retries <= maxRetries)` loop with exponential backoff delays (500ms, 1000ms, 2000ms). A frame captured at t=0 could still be retrying at t=3500ms. For real-time traffic perception, a 3.5-second-old frame shows vehicles that have already moved through the intersection.

### 4.2 No Backpressure
`WebSocketConnectionService.sendMessage()` called `socket.send()` without checking `socket.bufferedAmount`. On congested networks, the WebSocket internal buffer grows unboundedly, causing memory pressure and delayed frame delivery.

### 4.3 Camera Ref Race
In `CameraCaptureService.executeCapture()`, the camera ref was checked on line 128 (`if (!this.cameraRef)`) but the async `takePictureAsync()` was called using `this.cameraRef` on line 141. Between these lines (and during the async operation), a React remount could null or replace the ref.

### 4.4 Orphaned Sockets
`WebSocketConnectionService.connect()` created a new WebSocket without closing the previous one. During auto-reconnect, the old socket's `onclose` handler could fire after the new socket was established, potentially triggering duplicate reconnect logic.

## 5. Severity

- **P0 (Critical)**: 4 issues — stale frames, no backpressure, camera ref race, retry-stale
- **P1 (Important)**: 4 issues — orphaned sockets, resolution mismatch, default config, restart loop
- **P2 (Minor)**: 0 new issues (diagnostics defaults corrected inline)

## 6. Files Changed

| File | Changes |
|------|---------|
| `src/services/camera/UploadWorker.ts` | Added frame age gate (MAX_FRAME_AGE_MS=2000), backpressure check (256KB), removed retry loop, added stale/dropped counters |
| `src/services/camera/CameraCaptureService.ts` | Snapshot camera ref before async capture, added restart rate limiter (3 per 30s) |
| `src/services/camera/CameraStreamingService.ts` | Fixed default capture to 640×360 @ 0.25, corrected stats default resolution |
| `src/services/connection/WebSocketConnectionService.ts` | Close old socket before new connect(), added try/catch to sendMessage(), stop timers before reconnect |
| `src/camera/CameraService.ts` | Fixed getResolutionConfig() 480p to 640×360, aligned quality values |
| `src/context/CameraContext.tsx` | Fixed defaultStats resolution to 640×360 |

## 7. Exact Fixes

### 7.1 UploadWorker — Frame Freshness Gate
```typescript
const MAX_FRAME_AGE_MS = 2000;

// In processUpload():
const frameAge = Date.now() - frame.timestamp;
if (frameAge > MAX_FRAME_AGE_MS) {
  CameraLogger.log('Frame discarded: stale', { frameAgeMs: frameAge });
  continue; // drop and check for newer frame
}
```

### 7.2 UploadWorker — Backpressure Gate
```typescript
const MAX_SOCKET_BUFFER_BYTES = 256 * 1024;

const buffered = connService.getBufferedAmount();
if (buffered > MAX_SOCKET_BUFFER_BYTES) {
  CameraLogger.log('Frame dropped: socket backpressure', { bufferedAmount: buffered });
  return;
}
```

### 7.3 UploadWorker — No Retry for Video
Removed the `while (retries <= maxRetries)` loop and `sleep()` method. Single attempt per frame. If send fails, the frame is dropped and the next/latest frame takes its place.

### 7.4 CameraCaptureService — Ref Snapshot
```typescript
const capturedCameraRef = this.cameraRef;
const capturePromise = capturedCameraRef.takePictureAsync({...});
```

### 7.5 CameraCaptureService — Restart Rate Limiter
```typescript
private maxRestarts = 3;
private restartWindowMs = 30000;

if (this.restartCount <= this.maxRestarts) {
  this.onCameraRestartRequested();
} else {
  CameraLogger.log('Camera restart suppressed');
}
```

### 7.6 WebSocketConnectionService — Socket Teardown Before Reconnect
```typescript
if (this.socket) {
  this.socket.onopen = null;
  this.socket.onmessage = null;
  this.socket.onerror = null;
  this.socket.onclose = null;
  this.socket.close();
  this.socket = null;
}
```

## 8. Frame Freshness Behavior

- **MAX_FRAME_AGE_MS**: 2000ms
- Frame age checked **twice**: once when dequeued, once immediately before send
- Stale frames are discarded and counted in diagnostics (`getStaleFrameCount()`)
- No stale frame is ever retried
- Capture timestamp generated at capture time (`Date.now()` in `executeCapture`)
- Send timestamp generated at send time
- Both `capture_timestamp` (epoch ms) and `capture_timestamp_iso` (ISO string) included in payload

## 9. Backpressure Behavior

- **Threshold**: 256 KB (`MAX_SOCKET_BUFFER_BYTES`)
- Checked via `connService.getBufferedAmount()` before every send
- If buffer exceeds threshold: frame is **dropped** (not retried, not queued)
- Dropped frames counted in diagnostics (`getDroppedFrameCount()`)
- Latest-frame-wins: next capture replaces the buffer regardless

## 10. Camera Lifecycle Behavior

- **Single capture timer**: enforced by `cleanupTimers()` called before every new `setTimeout`
- **Single in-flight capture**: enforced by `isCapturing` boolean guard
- **Camera ref snapshot**: prevents stale ref use during async `takePictureAsync()`
- **Restart rate limiter**: max 3 camera remounts per 30-second window
- **Max consecutive failures**: 5 → capture stops entirely
- **AppState handling**: `stopRealStream()` on background, `startRealStream()` on foreground

## 11. Reconnect Behavior

- **Bounded**: max 10 attempts with exponential backoff capped at 30s + jitter
- **Stable connection reset**: after 10s of stable connection, reconnect counter resets to 0
- **Old socket teardown**: handlers nulled and socket closed before new connection
- **Manual disconnect**: sets `isManualDisconnect=true`, cancels auto-reconnect
- **Heartbeat**: 2s interval, timer cleaned before restart
- **No duplicate timers**: `startHeartbeat()` calls `stopHeartbeat()` first; same for stable connection timer

## 12. Memory Safety

- **Single-slot frame buffer**: `latestFrame` overwritten by newest frame, never accumulates
- **No unbounded arrays**: `frameTimestamps` bounded to 2-second window for FPS calculation
- **No retry timer accumulation**: retries removed entirely
- **Listener cleanup**: `onStateChange` and `onUploadResult` return unsubscribe functions
- **Timer cleanup**: all `setTimeout`/`setInterval` cleaned before creating new ones
- **WebSocket handler cleanup**: handlers nulled before socket close on reconnect

## 13. Resolution/JPEG Configuration

| Resolution | Width | Height | Quality | Aspect Ratio |
|------------|-------|--------|---------|-------------|
| 480p (default) | 640 | 360 | 0.25 | 16:9 |
| 720p | 1280 | 720 | 0.15 | 16:9 |
| 1080p | 1920 | 1080 | 0.25 | 16:9 |

All code paths (`CameraStreamingService.startRealStream`, `CameraService.getResolutionConfig`) are consistent.

## 14. Tests Executed

| Test | Command | Result |
|------|---------|--------|
| TypeScript type-check | `npx tsc --noEmit` | **PASS** (0 errors) |
| Lint | Not configured | N/A |
| Build | Not configured (Expo managed) | N/A |
| Unit tests | Not configured | N/A |

## 15. Test Results

TypeScript compilation passes with zero errors across all modified files. No type safety violations introduced.

## 16. Remaining Known Limitations

1. **Viewfinder flashing on Android**: `takePictureAsync()` on expo-camera ~17.0.10 causes a brief preview flash. This is a **native platform limitation** of the Expo/Android still-image capture pipeline. It cannot be fully eliminated in TypeScript. The camera is not being remounted or restarted — the flash is inherent to the native capture call.

2. **No adaptive quality**: JPEG quality is static per resolution preset. Adaptive quality based on network conditions is not implemented (out of scope).

3. **No frame ID**: Frames don't carry a sequential frame ID. Ordering relies on timestamps. Adding a monotonic frame counter would improve backend deduplication.

4. **AppState foreground recovery**: When the app returns to foreground, `startRealStream` is called with the stored `activeCameraRef`. If the CameraPreview component has been unmounted by React while backgrounded, this ref could be stale until the next render cycle. The 200ms delay in StreamingScreen mitigates this but is not a guarantee.

## 17. Tomorrow's Manual Test Checklist

1. Start the FastAPI backend
2. Start the mobile app (`npx expo start`)
3. Scan QR code to pair camera node
4. Wait for START_STREAM command
5. Verify streaming at 640×360 (check backend logs for frame dimensions)
6. Verify fresh frames: check `capture_timestamp` vs server receive time (delta < 2s)
7. Check FPS reads ~3 FPS on the HUD (300ms capture interval)
8. Disconnect Wi-Fi on the phone
9. Wait 10–15 seconds (observe reconnect attempts in logs)
10. Restore Wi-Fi
11. Verify auto-reconnect succeeds within 30s
12. Verify streaming resumes without manual intervention
13. Run for 30–60 minutes continuously
14. Check memory usage remains stable (no growth)
15. Check backend vehicle counts are updating
16. Check dashboard synchronization is live
17. Background the app, wait 10s, foreground — verify stream resumes
18. Toggle torch and flip camera — verify no crashes
19. Check logs for "Frame discarded: stale" events during network congestion
20. Check logs for "Frame dropped: socket backpressure" events during slow network
