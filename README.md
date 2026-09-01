# Traffic Camera Node

Android camera client for the sibling Smart Traffic Management backend.
The app uses Expo SDK 54, React Native 0.81, VisionCamera 5 and Nitro Image.
It sends JPEG samples over WebSocket; it is not a full-rate video broadcaster.

VisionCamera 5.2.2 was generated before Nitro added its React Native 0.81
RawProps JSI compatibility parser. This otherwise causes the native
`PreviewView.previewOutput: Cannot cast dynamic to a jsi::Value` failure after
pairing. The project pins Nitro Modules 0.37.1 and applies
`patches/react-native-vision-camera+5.2.2.patch` during `npm ci`. Keep the
`postinstall` script until VisionCamera ships generated view code using Nitro's
compatibility parser, then remove it only after a physical-camera regression test.

## Build and run

Install Node.js 22.12+, JDK 17 and Android Studio with the Android SDK.
Enable USB debugging on the phone, connect it, and check that `adb devices` shows it.

```powershell
npm ci
npm run type-check
npm run android
```

This builds the native Android app locally. Metro supplies JavaScript during debug
development. **Expo Go does not include the VisionCamera/Nitro native modules.**
A JavaScript export is not an APK and does not verify native camera behavior.

For a standalone internal-test APK after the Android environment is configured:

```powershell
cd android
.\gradlew.bat assembleRelease
```

Expected output: `android/app/build/outputs/apk/release/app-release.apk`.
The existing release variant uses the debug signing key: it is suitable only for
local prototype testing, not Play Store publication. Set up proper release signing
before distributing a production application. A local APK was not built because
Java, adb and the Android SDK are unavailable on this machine.

The verified cloud-build path does not require the local Android toolchain:

```powershell
npx eas-cli build --platform android --profile preview --non-interactive
```

The `preview` profile produces an internally distributed, installable release APK
signed with the project's remote Expo credentials. The 1 September validation build
completed as EAS build `643a74eb-9a6d-4228-b6b4-2e99fc0b7571`.

The checked-in preview build targets `arm64-v8a`, which covers modern physical
Android phones while avoiding unused x86 emulator and 32-bit native libraries.
Temporarily extend `reactNativeArchitectures` in `android/gradle.properties` only
when a confirmed target requires another ABI.

Primary setup references:
[React Native environment setup](https://reactnative.dev/docs/next/set-up-your-environment),
[Expo local native builds](https://docs.expo.dev/guides/local-app-overview/),
[custom native libraries and Expo Go](https://docs.expo.dev/workflow/customizing/).

## Pair phones with the backend

Start the sibling backend with `.\start.ps1 -Lan`. Open its web dashboard at
http://localhost:8000, then Live Cameras → Pair Camera Node. Select one direction
for each phone, generate the QR and scan it in the app.

- Combined backend: camera WebSocket and REST both use port **8000**.
- Split backend: camera WebSocket uses **8001**, REST uses **8000**.
- Use the laptop's LAN address, never phone localhost.
- Keep both devices on the same trusted network; do not expose these services publicly.
- A direction supports one connected camera. Disconnect the previous node before
  pairing a different phone to that direction.
- Registration ACK supplies the credential used for later frames and heartbeats.
  The server rejects missing, expired, replayed, wrong-direction and incorrect QR secrets.
  Server acknowledgment controls Start/Stop state; button taps do not fabricate success.
- After disconnection the client reconnects with its registration identity and obtains
  a new issued session token. Direction and socket ownership are checked by the server.

## Capture behavior

The native preview stays mounted while serial snapshots are encoded off the JS
thread. Select **Low power (2 FPS)** or **Balanced (4 FPS)** in Settings. The
client permits one processed frame in flight: a matching server `FRAME_ACK`
releases the next capture, while a 1.5 second timeout permits recovery if an ACK
is lost. This adapts the effective rate to server/network capacity without an
unbounded queue.

Upload size selects a maximum longest edge of 640, 1280 or 1920 pixels while
preserving aspect ratio. Images are never enlarged beyond the preview snapshot.
Start with 640 pixels for four phones on a CPU backend. Higher limits cost network
bandwidth and encoding time; this is separate from native preview resolution.

Backgrounding pauses capture and returning to the foreground resumes an intended
stream. Stopped/cancelled capture generations cannot upload to a later session.
Native image objects are released after encoding. The keep-screen-on setting is
applied while streaming.

Android cleartext WebSocket traffic is enabled for the trusted-LAN prototype.
`plugins/withTrustedLan.js` preserves this setting if native configuration is
regenerated; the checked-in Android manifest is also updated. Do not run
`expo prebuild --clean` without reviewing existing native changes first.

## Checks

```powershell
npm run type-check
node scripts/test-regressions.cjs
npx expo install --check
npx expo export --platform android --output-dir .expo/export-validation
npm audit
```

The regression script checks issued credentials, server-controlled streaming,
frame authentication fields, matching processed-frame ACK backpressure and
latency, heartbeat RTT units, disconnect identity and QR expiry.
It mocks native dependencies; it cannot verify preview flicker, hardware permissions,
thermal behavior or phone-to-server latency.

As of the repair run, npm audit reports **8 high and 6 moderate advisories** in
the Expo 54 dependency graph. Pinned PostCSS and uuid overrides address their reported issues, with CommonJS
tooling checks. Remaining image-size/Metro findings need upstream patches or a
tested SDK/Metro migration. Do not use `npm audit fix --force` blindly: its
proposed Expo upgrade changes the native platform.

## Physical acceptance checklist

- One phone: grant permission, pair North, observe continuous preview and advancing
  frame IDs, stop/start, background/resume, flip camera, and toggle torch.
- Disconnect and reconnect Wi-Fi; verify new session credentials and no preview
  remount loop or duplicate uploads.
- Two, then four phones: unique directions, independent counts/track IDs, one slow
  feed does not freeze another, CPU/memory remain bounded for at least 15 minutes.
- Point one phone at labelled traffic footage and compare detected classes, current
  counts and confirmed tracks to manual annotations. Record misses and ID switches.
- Measure latency with a visible clock in the photographed scene; device/server
  clocks cannot be assumed synchronized.
