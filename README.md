# Traffic Camera Node — Smart Traffic Management System

A high-performance React Native / Expo mobile application designed for real-time traffic camera video frame capture and streaming to a central Smart Traffic Management backend over WebSockets and REST APIs.

---

## 1. Project Overview

The **Traffic Camera Node** application transforms mobile devices into edge traffic monitoring nodes. It captures camera frames at controlled intervals, enforces WebSocket backpressure, drops stale frames to preserve low latency, and streams base64 JPEG data to a backend server for downstream computer vision and traffic analysis.

- **Framework**: React Native with Expo SDK 54 & TypeScript
- **UI Library**: React Native Paper dark theme & React Navigation
- **Streaming Pipeline**: Non-blocking `UploadWorker` frame queue, backpressure monitoring, and bounded exponential backoff reconnects

---

## 2. Architecture

```text
[ Physical Camera / Expo CameraView ]
                 │
                 ▼
[ CameraCaptureService ] ─── (base64 JPEG frame generation)
                 │
                 ▼
    [ UploadWorker Buffer ] ─── (Drops frames older than MAX_FRAME_AGE_MS)
                 │
                 ▼ (WebSocket backpressure check < MAX_SOCKET_BUFFER_BYTES)
   [ WebSocketConnectionService ]
                 │
                 ▼
  ┌─────────────────────────────┐
  │  FastAPI Backend Server     │
  │  REST Port: 8000            │
  │  WebSocket Port: 8001       │
  └─────────────────────────────┘
```

---

## 3. Prerequisites

Before installing and running the application, ensure your machine has the following tools installed:

- **Node.js**: v18.x or v20.x (LTS recommended)
- **npm**: v9.x or later
- **Git**: v2.x or later
- **Expo Go App** (Optional, for physical device testing): Available on iOS App Store & Android Google Play Store
- **Android Studio & Android SDK** (Optional, for Android emulator / native builds)
- **Xcode & CocoaPods** (Optional, for iOS simulator / native builds, macOS only)

---

## 4. Clone Repository

Clone the project repository to your local computer:

```powershell
git clone https://github.com/Abishek-805/Traffic_Camera_App.git
cd Traffic_Camera_App
```

On Linux/macOS:
```bash
git clone https://github.com/Abishek-805/Traffic_Camera_App.git
cd Traffic_Camera_App
```

---

## 5. Dependency Installation

This project uses locked dependencies via `package-lock.json`. Install dependencies using `npm ci`:

```powershell
npm ci
```

On Linux/macOS:
```bash
npm ci
```

---

## 6. Python Environment Setup

> **Note**: Not Applicable.
> This repository is purely a React Native / Expo JavaScript/TypeScript application. No Python runtime or virtual environments are required.

---

## 7. Node.js Setup

Verify that Node.js and npm are properly initialized:

```powershell
node -v
npm -v
```

If TypeScript is installed globally or locally, confirm type-checker availability:
```powershell
npm run type-check
```

---

## 8. Environment Configuration

1. Copy the example environment file `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

On Linux/macOS:
```bash
cp .env.example .env
```

2. Edit `.env` to configure your target server:

```env
# Smart Traffic Backend Server Configuration
# IMPORTANT FOR PHYSICAL PHONES & EMULATORS:
# - '127.0.0.1' or 'localhost' inside Expo app refers to the mobile device itself!
# - Set EXPO_PUBLIC_SERVER_HOST to your computer's LAN IP address (e.g. 192.168.1.100) or server domain name.

EXPO_PUBLIC_SERVER_HOST=192.168.1.100
EXPO_PUBLIC_REST_PORT=8000
EXPO_PUBLIC_WEBSOCKET_PORT=8001
```

---

## 9. Database & External Services Setup

The app connects to an external **Smart Traffic Management System Backend** (e.g., FastAPI / Python backend service).

### External Backend Expectations
- **REST Service**: Listens for HTTP requests (health check, node registration) on port `8000` (or `EXPO_PUBLIC_REST_PORT`).
- **WebSocket Service**: Listens for live streaming frames on port `8001` (or `EXPO_PUBLIC_WEBSOCKET_PORT`).

No local database server is required on the mobile client. Local app settings are persisted on the device using `@react-native-async-storage/async-storage`.

---

## 10. Backend Startup

Ensure your external Smart Traffic backend server is running and accessible over your local network or internet before connecting the app.

Example check from your developer workstation:
```powershell
# Verify REST health endpoint accessibility
Invoke-RestMethod -Uri "http://<YOUR_BACKEND_IP>:8000/api/v1/health"
```

---

## 11. Frontend Startup

Start the Expo development server:

```powershell
npm run start
```

### Additional Launch Modes

- **Start on Web Browser**:
  ```powershell
  npm run web
  ```

- **Run on Connected Android Device / Emulator**:
  ```powershell
  npm run android
  ```

- **Run on Connected iOS Simulator** (macOS only):
  ```powershell
  npm run ios
  ```

- **Start with Clean Cache**:
  ```powershell
  npm run start:clear
  ```

---

## 12. Docker Setup

> **Note**: Docker containers are not used for React Native mobile app clients.
> For containerized backend workflows, refer to the Smart Traffic Management System backend repository.

---

## 13. API & Protocol Endpoints

The mobile client communicates using the following endpoints on the backend server:

| Endpoint | Protocol | Purpose | Payload |
|---|---|---|---|
| `/ws/stream` | WebSocket (`ws://` or `wss://`) | Real-time JPEG frame streaming | JSON: `{ frame: base64, timestamp: number, cameraDirection: string }` |
| `/api/v1/health` | HTTP GET | Backend service status check | Response: `{ status: "ok" }` |
| `/api/v1/config` | HTTP GET/POST | Camera node configuration sync | JSON config payload |

---

## 14. Testing & Type Verification

Run TypeScript compilation checks to verify type safety across the entire project:

```powershell
npm run type-check
```

On Linux/macOS:
```bash
npm run type-check
```

---

## 15. Production Build & Bundling

To generate production bundles or standalone binaries:

### Web Export
```powershell
npx expo export --platform web
```

### Native Android / iOS Build via EAS (Expo Application Services)
```powershell
npx eas-cli build --platform android
npx eas-cli build --platform ios
```

---

## 16. Troubleshooting

### Issue 1: "Cannot connect to server at 127.0.0.1"
- **Cause**: On a physical mobile device or emulator, `127.0.0.1` refers to the device itself.
- **Solution**: Set `EXPO_PUBLIC_SERVER_HOST` in `.env` to your host computer's local Wi-Fi IP address (e.g. `192.168.1.X`). Ensure both computer and mobile device are on the same Wi-Fi network.

### Issue 2: `npm ci` fails due to lockfile mismatches
- **Cause**: Incompatible Node.js/npm version or modified `package.json`.
- **Solution**: Use Node.js 18+ or 20+ LTS, then re-run `npm ci`.

### Issue 3: Stale camera frame warnings in console
- **Cause**: Network congestion or slow backend processing.
- **Solution**: The internal `UploadWorker` automatically drops frames older than 2000ms to preserve real-time latency. Verify network signal and backend socket processing speed.

---

## 17. Project Structure

```text
traffic-camera-app/
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignored pattern definitions
├── App.tsx                       # React Native entry point & provider tree
├── app.json                      # Expo app configuration
├── babel.config.js               # Babel preset configuration
├── eas.json                      # Expo Application Services build config
├── package.json                  # Dependencies & npm scripts
├── package-lock.json             # Locked dependency tree
├── tsconfig.json                 # TypeScript configuration
│
└── src/
    ├── camera/                   # Camera configuration & frame handling
    ├── components/               # Reusable UI components
    ├── context/                  # React Context providers (Settings, Connection, Camera)
    ├── hooks/                    # Custom React hooks
    ├── navigation/               # Navigation stack configuration
    ├── protocol/                 # Streaming & network protocol constants
    ├── screens/                  # App screens (Home, Stream, Settings, History)
    ├── services/                 # Capture, WebSocket, and upload services
    ├── theme/                    # Color palette & Paper theme customization
    ├── types/                    # TypeScript interfaces & type definitions
    └── utils/                    # Utility functions, storage, & default constants
```
