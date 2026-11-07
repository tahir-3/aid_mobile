import axios from 'axios';

import { API_BASE_URL } from './config';

/**
 * Raw calls to the backend auth endpoints (`aids.api.*`).
 *
 * Uses its own axios instance WITHOUT the auth interceptors of `lib/api.ts`, so a
 * refresh request can never trigger another refresh (no recursion / deadlock).
 */
const authClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

export interface DoctypePermission {
  read: boolean;
  create: boolean;
}

export interface AuthUser {
  email: string;
  fullname: string;
  user_image: string | null;
  roles: string[];
  /** Per-doctype permissions (sent by backends that support it). */
  permissions?: Record<string, DoctypePermission>;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: AuthUser;
}

function toSession(data: TokenResponse): { session: AuthSession; user: AuthUser | null } {
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('Invalid token response from server');
  }
  return {
    session: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Number(data.expires_in || 0) * 1000,
    },
    user: data.user ?? null,
  };
}

export async function requestLogin(usr: string, pwd: string) {
  const res = await authClient.post('/api/method/aids.api.login', { usr, pwd });
  return toSession(res.data?.message ?? res.data);
}

export async function requestRefresh(refreshToken: string) {
  const res = await authClient.post('/api/method/aids.api.refresh_token', {
    refresh_token: refreshToken,
  });
  return toSession(res.data?.message ?? res.data);
}

/** Fresh profile + permissions (needs a valid access token). */
export async function requestUserInfo(accessToken: string): Promise<AuthUser> {
  const res = await authClient.get('/api/method/aids.api.get_user_info', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data?.message;
}

/** Best-effort server-side logout. Never throws. */
export async function requestRevoke(session: AuthSession): Promise<void> {
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  await Promise.allSettled([
    authClient.post(
      '/api/method/aids.api.revoke_token',
      { refresh_token: session.refreshToken },
      { headers, timeout: 8_000 }
    ),
    // Clears any legacy cookie session created by the old backend login.
    authClient.post('/api/method/logout', null, { headers, timeout: 8_000 }),
  ]);
}

/** True when the server rejected the credentials/refresh token (not a network issue). */
export const isAuthRejection = (err: any) => err?.response?.status === 401;
