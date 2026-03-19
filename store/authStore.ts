import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { logoutFromFrappe } from '../lib/api';

export interface FrappeUser {
  email: string;
  fullname: string;
  user_image: string | null;
  roles: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: FrappeUser | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string, user?: FrappeUser) => Promise<void>;
  setUser: (user: FrappeUser | null) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  setTokens: async (accessToken: string, refreshToken: string, user?: FrappeUser) => {
    console.log('Saving tokens to storage...');
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      // Also save to AsyncStorage as fallback if SecureStore fails on some Android devices
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      
      if (user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      console.log('Tokens saved successfully');
      set({ accessToken, refreshToken, user: user ?? null, isAuthenticated: true });
    } catch (e) {
      console.error('Failed to save tokens to SecureStore, trying AsyncStorage fallback:', e);
      try {
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        set({ accessToken, refreshToken, user: user ?? null, isAuthenticated: true });
      } catch (err) {
        console.error('Total failure saving tokens:', err);
        // Still set state so current session works
        set({ accessToken, refreshToken, user: user ?? null, isAuthenticated: true });
      }
    }
  },

  setUser: (user: FrappeUser | null) => {
    set({ user });
  },

  logout: async () => {
    console.log('Logging out, clearing storage...');
    try {
      await logoutFromFrappe();
    } catch {}
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
    console.log('Logged out successfully');
  },

  initialize: async () => {
    console.log('Initializing auth store...');
    try {
      let accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      let refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      
      // Try fallback if not found in SecureStore
      if (!accessToken) accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      if (!refreshToken) refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

      const userJson = await AsyncStorage.getItem(USER_KEY);
      const user: FrappeUser | null = userJson ? JSON.parse(userJson) : null;
      
      console.log('Loaded tokens:', { 
        accessToken: accessToken ? 'Present' : 'Missing', 
        refreshToken: refreshToken ? 'Present' : 'Missing' 
      });

      if (accessToken) {
        set({ accessToken, refreshToken, user, isAuthenticated: true });
      } else {
        console.log('No tokens found in storage');
      }
    } catch {
      console.error('Failed to load tokens');
    }
  },
}));
