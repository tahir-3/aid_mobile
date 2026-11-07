import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Key prefix of the wounded/martyrs/prisoners AsyncStorage cache (see lib/records.ts).
 * Kept in its own dependency-free module so the auth store can clear it on logout
 * without importing the API client (which itself depends on the auth store).
 */
export const RECORDS_CACHE_PREFIX = 'records_cache:';

/** Removes every cached record. */
export async function clearRecordsCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(RECORDS_CACHE_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (e) {
    console.warn('Failed to clear records cache:', e);
  }
}
