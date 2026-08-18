import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageService {
  public static async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? (JSON.parse(jsonValue) as T) : defaultValue;
    } catch (e) {
      console.warn(`Error reading key ${key} from AsyncStorage`, e);
      return defaultValue;
    }
  }

  public static async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
      console.warn(`Error saving key ${key} to AsyncStorage`, e);
    }
  }

  public static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing key ${key} from AsyncStorage`, e);
    }
  }
}
