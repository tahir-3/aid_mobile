import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage utility for saving data offline.
 * This can be used to store aid requests, recipient data, etc.
 */
export const storage = {
  async saveItem(key: string, value: any) {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
      console.error('Error saving data', e);
    }
  },

  async getItem(key: string) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error('Error reading data', e);
      return null;
    }
  },

  async removeItem(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error('Error removing data', e);
    }
  },

  async getAllKeys() {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (e) {
      console.error('Error getting all keys', e);
      return [];
    }
  },
};

// Note: syncWithFrappe and pushUnsyncedToServer are in lib/sync.ts
// (not re-exported here to avoid circular dependency with storage)
