# Traffic Camera Node (Mobile Camera Application)

An edge vision sensor client for the **[Smart Traffic Management System](https://github.com/Abishek-805/Smart-Traffic-Management)**. This Android application turns a physical smartphone into an intelligent traffic camera node, streaming synchronized frames and telemetry to the backend inference coordinator over a trusted local area network (LAN).

---

## Technical Stack & Architecture

- **Framework**: React Native 0.81.5 with Expo SDK ~54.0.0 (Custom Native Runtime)
- **Camera Engine**: React Native VisionCamera ^5.2.2 with Nitro Modules 0.37.1 and Nitro Image 0.15.2
- **Streaming Protocols**:
  - WebRTC video streaming via `react-native-webrtc` 124.0.8 (H.264 / VP8)
  - Resilient WebSocket JPEG snapshots with strict processed-frame backpressure
- **Language & UI**: TypeScript ~5.9.2, React 19.1.0, React Native Paper ^5.12.5, React Navigation 6
- **Architecture Target**: Android `arm64-v8a` (Android 10+ / API 29+)

> [!IMPORTANT]
> **Expo Go is NOT supported.**
> Because this application relies on custom C++/JSI native modules (`react-native-vision-camera`, `react-native-nitro-modules`, and `react-native-webrtc`), it cannot run in the generic Expo Go sandbox. You must compile the native Android runtime using `npm run android` or install a pre-built APK.

> [!NOTE]
> **VisionCamera 5.2.2 Native Patch**:
> VisionCamera 5.2.2 was generated before Nitro added its React Native 0.81 `RawProps` JSI compatibility parser, which causes a native JSI cast crash (`PreviewView.previewOutput: Cannot cast dynamic to a jsi::Value`). This repository pins Nitro Modules 0.37.1 and applies `patches/react-native-vision-camera+5.2.2.patch` automatically during `npm ci` via the `postinstall` script.

---

## Prerequisites

Before setting up on a fresh machine, ensure the following tools are installed:

| Tool | Recommended Version | Purpose |
|---|---|---|
| **Node.js** | `v22.12.0+` (LTS) | JavaScript runtime |
| **npm** | `10.9.0+` | Dependency manager |
| **Java Development Kit (JDK)** | OpenJDK `17` | Android Gradle build toolchain |
| **Android Studio / SDK** | SDK Platform 34/35, Build-Tools | Native Android compilation and ADB |
| **ADB (Android Debug Bridge)** | In system `PATH` | Device discovery and USB sideloading |
| **Physical Android Device** | Android 10+ (`arm64-v8a`) | Real-world camera capture with USB debugging enabled |

*(Optional)* If local Android Studio / JDK is not available on your workstation, you can build an installable APK using **EAS CLI** cloud builds (documented below).

---

## Fresh Machine Quickstart

Follow these steps on a completely clean clone:

### 1. Clone the Repository
```powershell
git clone https://github.com/Abishek-805/Traffic_Camera_App.git
cd Traffic_Camera_App
```

### 2. Install Dependencies
```powershell
npm ci
```
*Note: `npm ci` automatically runs the `postinstall` hook (`patch-package`), ensuring `patches/react-native-vision-camera+5.2.2.patch` is applied to `node_modules`.*

### 3. Configure Environment Variables
Copy the example environment template:
```powershell
cp .env.example .env
```
Edit `.env` to configure your backend connection:
```ini
# Sibling Backend LAN IP address (do NOT use localhost or 127.0.0.1 on Android)
EXPO_PUBLIC_SERVER_HOST=192.168.1.100

# Backend REST API Port (default: 8000)
EXPO_PUBLIC_REST_PORT=8000

# Backend Camera WebSocket Port
# 8000 for Combined Server (default) or 8001 for Split Docker Architecture
EXPO_PUBLIC_WEBSOCKET_PORT=8000
```
> [!WARNING]
> Never set `EXPO_PUBLIC_SERVER_HOST` to `127.0.0.1` or `localhost`. On Android, `localhost` points to the mobile device itself, not your backend computer. Always use your workstation's local network IP (e.g. `192.168.1.50`).

### 4. Run Automated Verification
Verify TypeScript types and streaming protocols:
```powershell
npm run type-check
npm test
```
Both checks must pass cleanly before building or running.

---

## Build & Run Options

### Option A: Local USB Development (Recommended)

1. Connect your Android phone to your PC via USB.
2. Enable **Developer Options** and **USB Debugging** on the phone.
3. Verify ADB detects the device:
   ```powershell
   adb devices
   ```
4. Build and deploy the native debug application:
   ```powershell
   npm run android
   ```
5. Metro Bundler will launch and the app will install on your phone automatically.

### Option B: Standalone Release APK (Local Gradle Build)

To build a standalone APK directly without Metro bundler:
```powershell
cd android
.\gradlew.bat assembleRelease
```
*(On macOS/Linux, run `./gradlew assembleRelease`)*

- **Generated APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **Install on connected phone**:
  ```powershell
  adb install -r android/app/build/outputs/apk/release/app-release.apk
  ```
*Note: The built-in release configuration uses debug signing keys, suitable for rapid prototype and field testing.*

### Option C: Standalone Cloud Build via EAS (No Local Android SDK Required)

If your machine does not have the Android SDK or JDK 17 installed:
1. Install EAS CLI globally:
   ```powershell
   npm install -g eas-cli
   ```
2. Authenticate with your Expo account:
   ```powershell
   npx eas-cli login
   ```
3. Trigger a preview APK cloud build:
   ```powershell
   npx eas-cli build --platform android --profile preview --non-interactive
   ```
4. Download the resulting `.apk` link directly onto your physical Android phone.

---

## Companion Backend Pairing & Network Setup

The camera node works in tandem with the **[Smart Traffic Management Backend](https://github.com/Abishek-805/Smart-Traffic-Management)**.

```
+---------------------------+      LAN Wi-Fi       +------------------------------------+
|    Android Camera Node    | -------------------> | Smart Traffic Management Backend   |
| (arm64 Physical Phone)    | <------------------- |  FastAPI + YOLOv8 + Coordinator    |
+---------------------------+  WS / WebRTC Stream  +------------------------------------+
```

### 1. Start the Backend
On your host laptop, navigate to the backend repository and start the server bound to the LAN interface:
```powershell
.\start.ps1 -Lan
```
*(Or manually: `python run.py --host 0.0.0.0 --port 8000`)*

### 2. Network Connectivity Rules
- Both the laptop and the smartphone **must be connected to the exact same Wi-Fi network / subnet**.
- Ensure Windows Defender Firewall allows incoming connections on port `8000` (and `8001` if using split Docker mode).
- Android cleartext HTTP/WS communication is enabled for trusted private subnets via `plugins/withTrustedLan.js`.

### 3. Pair via QR Code
1. Open the Web Dashboard on your PC: `http://localhost:8000` (or `http://<LAN_IP>:8000`).
2. Go to **Live Cameras** -> **Pair Camera Node**.
3. Select an intersection direction: `North`, `South`, `East`, or `West`.
4. Click **Generate QR Code**.
5. In the mobile app, tap **Scan QR Code** and scan the screen.
6. The app automatically extracts the host, port, secret token, and assigned direction, establishing an authenticated session.

---

## Capture & Streaming Behavior

- **Live Preview**: The native preview remains smooth and active while serial snapshots or WebRTC video tracks are encoded off the JS thread.
- **Backpressure & Flow Control**:
  - In WebSocket mode, the app allows exactly **1 processed frame in flight**.
  - A server `FRAME_ACK` message releases the next frame capture.
  - A 1.5-second fallback timeout recovers the capture loop if an acknowledgment is dropped.
- **Cadence Presets**:
  - **Low Power (2 FPS)**: Optimized for thermal limits and minimal battery drain during prolonged operation.
  - **Balanced (4 FPS)**: Recommended standard for responsive traffic flow tracking.
- **Upload Resolution Limits**:
  - Configurable in Settings: `640px`, `1280px`, or `1920px` (longest edge).
  - Preserves aspect ratio without artificial enlargement.
  - `640px` is recommended for 4 concurrent camera nodes on a CPU backend.
- **Lifecycle & Sleep Management**:
  - App keeps screen awake during active streaming (`expo-keep-awake`).
  - Backgrounding automatically pauses capture; returning to foreground resumes the session cleanly.

---

## Available NPM Scripts

| Command | Action |
|---|---|
| `npm ci` | Clean install dependencies and run `patch-package` |
| `npm start` | Start Expo dev server with LAN IP resolution (`expo start --lan`) |
| `npm run android` | Compile native Android app and run on connected device |
| `npm run type-check` | Validate TypeScript code without emitting JS (`tsc --noEmit`) |
| `npm test` | Run regression and WebRTC protocol validation suites |
| `npm run start:clear` | Start Expo dev server with a cleared cache |

---

## Troubleshooting & FAQ

### `PreviewView.previewOutput: Cannot cast dynamic to a jsi::Value`
- **Cause**: React Native 0.81 JSI props mismatch with VisionCamera 5.2.2.
- **Solution**: Run `npm ci` to ensure `patches/react-native-vision-camera+5.2.2.patch` is applied via `patch-package`. Do not delete the `patches` directory.

### `Connection Refused` or `WebSocket connection failed`
- **Cause**: Phone cannot reach the backend server IP or port.
- **Solution**:
  1. Check your PC's LAN IP address (`ipconfig`) and verify it matches `.env` or the QR code payload.
  2. Confirm the backend is listening on `0.0.0.0`, not `127.0.0.1`.
  3. Ensure both devices are on the same Wi-Fi router (avoid guest networks with client isolation).
  4. Temporarily check Windows Firewall rules for port 8000/8001.

### `QR Code Expired` or `Unauthorized`
- **Cause**: QR code registration tokens are time-sensitive and expire after 5 minutes.
- **Solution**: Click **Generate QR Code** again on the dashboard and scan the fresh QR.

### `No cameras found` / Permissions Denied
- **Cause**: Android camera runtime permission was rejected.
- **Solution**: Go to Android Settings -> Apps -> Traffic Camera Node -> Permissions -> Camera -> Allow "While using the app".

---

## Physical Field Acceptance Checklist

When evaluating physical phone camera nodes:
1. **Single Node Test**: Grant permissions, pair `North`, verify continuous preview, advancing frame IDs, stop/start, background/resume, and flip camera/torch toggles.
2. **Network Interruption**: Disconnect and reconnect Wi-Fi; confirm the app reconnects with session credentials without preview loops or duplicate uploads.
3. **Four Node Stress Test**: Connect 4 phones to `North`, `South`, `East`, and `West` simultaneously; ensure distinct track IDs, independent frame counters, and stable CPU/memory on the host backend for >= 15 minutes.
