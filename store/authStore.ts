import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  isAuthRejection,
  requestLogin,
  requestRefresh,
  requestRevoke,
  requestUserInfo,
  type AuthSession,
  type AuthUser,
} from '../lib/authApi';
import { clearRecordsCache } from '../lib/recordsCache';

export type FrappeUser = AuthUser;

/** Thrown when the session can no longer be renewed and the user must log in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  /** Kept for existing consumers; equals `status === 'signedIn'`. */
  isAuthenticated: boolean;
  session: AuthSession | null;
  user: FrappeUser | null;

  /** Restore the session from secure storage (no network needed). */
  initialize: () => Promise<void>;
  /**
   * Log in with credentials. `beforeActivate` runs with the new tokens already usable
   * by the API client but before the app switches to the signed-in screens
   * (used for the initial data sync). Its errors are re-thrown after activation.
   */
  signIn: (usr: string, pwd: string, beforeActivate?: () => Promise<void>) => Promise<void>;
  /** Clear the local session; `remote` also revokes the tokens on the server. */
  logout: (opts?: { remote?: boolean }) => Promise<void>;
  /** Current access token, refreshed first when it is (about to be) expired. */
  getAccessToken: () => Promise<string | null>;
  /** Rotate tokens now. Concurrent callers share one request. */
  refreshSession: () => Promise<string>;
  /** Reload profile + permissions from the server (best effort, silent). */
  refreshProfile: () => Promise<void>;
}

// ─── Persistence ──────────────────────────────────────────────────────────────
// Tokens live ONLY in the OS keystore (SecureStore). The non-secret user profile
// goes to AsyncStorage because SecureStore values are size-limited (~2KB).
const SESSION_KEY = 'auth_session';
const USER_KEY = 'auth_user';
// Pre-refactor keys: tokens were also mirrored in plain-text AsyncStorage.
const LEGACY_ACCESS_KEY = 'auth_access_token';
const LEGACY_REFRESH_KEY = 'auth_refresh_token';

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/** Refresh this long before the access token actually expires. */
const EXPIRY_SKEW_MS = 2 * 60 * 1000;

async function saveSession(session: AuthSession, user: FrappeUser | null) {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), SECURE_OPTS);
  } catch (e) {
    // Never fall back to plain-text storage: the session stays in memory only and
    // the user will have to log in again after the app restarts.
    console.warn('SecureStore unavailable; session will not survive a restart.', e);
  }
  if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
}

async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY, SECURE_OPTS);
    if (raw) return JSON.parse(raw) as AuthSession;
  } catch (e) {
    console.warn('Failed to read session from SecureStore:', e);
  }

  // One-time migration from the old key layout.
  const accessToken =
    (await SecureStore.getItemAsync(LEGACY_ACCESS_KEY).catch(() => null)) ??
    (await AsyncStorage.getItem(LEGACY_ACCESS_KEY).catch(() => null));
  const refreshToken =
    (await SecureStore.getItemAsync(LEGACY_REFRESH_KEY).catch(() => null)) ??
    (await AsyncStorage.getItem(LEGACY_REFRESH_KEY).catch(() => null));
  await removeLegacyKeys();
  if (!accessToken || !refreshToken) return null;

  // Expiry unknown → treat as expired so the first request refreshes it.
  const migrated: AuthSession = { accessToken, refreshToken, expiresAt: 0 };
  await saveSession(migrated, null);
  return migrated;
}

async function removeLegacyKeys() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(LEGACY_ACCESS_KEY),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY),
    AsyncStorage.multiRemove([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY]),
  ]);
}

async function clearStoredSession() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(SESSION_KEY, SECURE_OPTS),
    AsyncStorage.removeItem(USER_KEY),
    removeLegacyKeys(),
    // Cached wounded/martyr/prisoner records hold personal data — never leave them for the next user.
    clearRecordsCache(),
  ]);
}

// ─── Store ────────────────────────────────────────────────────────────────────
let refreshInFlight: Promise<string> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  isAuthenticated: false,
  session: null,
  user: null,

  initialize: async () => {
    const [session, userJson] = await Promise.all([
      loadSession(),
      AsyncStorage.getItem(USER_KEY).catch(() => null),
    ]);
    let user: FrappeUser | null = null;
    try {
      user = userJson ? JSON.parse(userJson) : null;
    } catch {}

    // An expired access token is fine here: it is refreshed on the first request,
    // so the app still opens offline with local data.
    set(
      session
        ? { session, user, status: 'signedIn', isAuthenticated: true }
        : { session: null, user: null, status: 'signedOut', isAuthenticated: false }
    );
  },

  signIn: async (usr, pwd, beforeActivate) => {
    const { session, user } = await requestLogin(usr.trim(), pwd);
    await saveSession(session, user);
    // Tokens usable by the API client, but screens still show the login page.
    set({ session, user });

    let hookError: unknown = null;
    try {
      await beforeActivate?.();
    } catch (e) {
      hookError = e;
    }

    // The hook may have hit an auth failure and logged out meanwhile.
    if (!get().session) throw hookError ?? new SessionExpiredError();
    set({ status: 'signedIn', isAuthenticated: true });
    if (hookError) throw hookError;
  },

  logout: async ({ remote = true } = {}) => {
    const { session } = get();
    // Update UI immediately; network + storage cleanup must not block navigation.
    set({ session: null, user: null, status: 'signedOut', isAuthenticated: false });
    if (remote && session) requestRevoke(session);
    await clearStoredSession();
  },

  getAccessToken: async () => {
    const { session } = get();
    if (!session) return null;
    if (Date.now() < session.expiresAt - EXPIRY_SKEW_MS) return session.accessToken;
    try {
      return await get().refreshSession();
    } catch (e) {
      if (e instanceof SessionExpiredError) return null;
      // Offline / server down: try the old token anyway (the request will fail or
      // succeed on its own; the 401 handler retries the refresh later).
      return session.accessToken;
    }
  },

  refreshProfile: async () => {
    try {
      const token = await get().getAccessToken();
      if (!token) return;
      const user = await requestUserInfo(token);
      if (!user?.email || !get().session) return;
      set({ user });
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Offline or older backend without get_user_info: keep the cached profile.
    }
  },

  refreshSession: () => {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const current = get().session;
      if (!current) throw new SessionExpiredError();
      try {
        const { session, user } = await requestRefresh(current.refreshToken);
        // Logged out (or logged in again) while the request was running → discard.
        if (get().session?.refreshToken !== current.refreshToken) {
          throw new SessionExpiredError();
        }
        await saveSession(session, user);
        set(user ? { session, user } : { session });
        return session.accessToken;
      } catch (e) {
        if (isAuthRejection(e)) {
          // Refresh token expired, revoked or reused → must log in again.
          await get().logout({ remote: false });
          throw new SessionExpiredError();
        }
        throw e; // network / server error: keep the session and try again later
      }
    })().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  },
}));

/**
 * Whether the signed-in user has `ptype` permission on `doctype`.
 * Unknown (older backend / profile cached before permissions existed) → allowed;
 * the server still enforces permissions on every request.
 */
export function hasPermission(
  user: FrappeUser | null,
  doctype: string,
  ptype: 'read' | 'create'
): boolean {
  const perm = user?.permissions?.[doctype];
  return perm ? perm[ptype] : true;
}

export function usePermission(doctype: string, ptype: 'read' | 'create'): boolean {
  return useAuthStore((s) => hasPermission(s.user, doctype, ptype));
}
