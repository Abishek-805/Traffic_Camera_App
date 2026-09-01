import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import { DeviceInfo, CameraCapabilities } from '../types/camera';

export class DeviceUtils {
  public static async getDeviceInfo(): Promise<DeviceInfo> {
    let batteryLevel = 1.0;
    let isCharging = false;

    try {
      batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      isCharging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;
    } catch {
      // Fallback for emulator or unsupported devices
      batteryLevel = 0.88;
      isCharging = true;
    }

    const deviceId = Device.osBuildId || `${Platform.OS}-${Math.random().toString(36).substring(2, 8)}`;
    const deviceName = Device.deviceName || `${Device.manufacturer || 'Android'} ${Device.modelName || 'Device'}`;

    return {
      deviceId,
      deviceName,
      manufacturer: Device.manufacturer || (Platform.OS === 'ios' ? 'Apple' : 'Android Manufacturer'),
      model: Device.modelName || 'Node Camera Device',
      platform: Platform.OS as 'android' | 'ios' | 'web',
      appVersion: '1.0.2',
      batteryLevel: Math.round(batteryLevel * 100),
      isCharging,
    };
  }

  public static getCameraCapabilities(): CameraCapabilities {
    return {
      frontCameraAvailable: true,
      backCameraAvailable: true,
      maxResolution: '1080p',
      supportedFPS: [15, 24, 30, 60],
      torchSupported: true,
      zoomSupported: true,
    };
  }
}
