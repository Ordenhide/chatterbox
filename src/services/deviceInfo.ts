import {Platform} from 'react-native';

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'unknown';
  deviceId: string;
  deviceName: string;
  appVersion: string;
}

let cachedDeviceInfo: DeviceInfo | null = null;

/**
 * Get device information for session tracking
 * Uses native device info if available, otherwise generates a stable ID
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  if (cachedDeviceInfo) {
    return cachedDeviceInfo;
  }

  try {
    // Try to use react-native-device-info if available
    let deviceId = 'unknown';
    let deviceName = 'Unknown Device';
    let appVersion = '1.0.0';

    try {
      const Device = require('react-native-device-info');
      [deviceId, deviceName, appVersion] = await Promise.all([
        Device.getUniqueId().catch(() => 'unknown'),
        Device.getDeviceName().catch(() => 'Unknown Device'),
        Device.getVersion().catch(() => '1.0.0'),
      ]);
    } catch {
      // Fallback: generate a stable device ID from available info
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const storedId = await AsyncStorage.getItem('@chatterbox:deviceId');
      if (storedId) {
        deviceId = storedId;
      } else {
        // Generate a stable ID based on device characteristics
        deviceId = `device_${Platform.OS}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await AsyncStorage.setItem('@chatterbox:deviceId', deviceId);
      }
      deviceName = `${Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)} Device`;
    }

    cachedDeviceInfo = {
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
      deviceId,
      deviceName,
      appVersion,
    };

    return cachedDeviceInfo;
  } catch (error) {
    // Ultimate fallback
    return {
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
      deviceId: `fallback_${Platform.OS}_${Date.now()}`,
      deviceName: `${Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)} Device`,
      appVersion: '1.0.0',
    };
  }
}

/**
 * Reset cached device info (for testing)
 */
export function resetDeviceInfoCache() {
  cachedDeviceInfo = null;
}
