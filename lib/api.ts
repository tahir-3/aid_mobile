import axios, { type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from './config';

export { API_BASE_URL };

/**
 * Authenticated API client. Login/refresh/logout calls live in `lib/authApi.ts`
 * (separate axios instance without these interceptors).
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

// Attach a valid access token; refreshes it first when it is about to expire.
api.interceptors.request.use(async (config) => {
  const token = await useAuthStore.getState().getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 (token expired/revoked server-side): refresh once and replay the request.
// If the refresh token is rejected too, the store logs out → app shows the login screen.
api.interceptors.response.use(undefined, async (error) => {
  const original = error.config as RetriableConfig | undefined;
  const store = useAuthStore.getState();

  if (error.response?.status !== 401 || !original || original._authRetried || !store.session) {
    throw error;
  }
  original._authRetried = true;

  try {
    const sentToken = String(original.headers.Authorization ?? '').replace(/^Bearer /, '');
    const current = useAuthStore.getState().session?.accessToken;
    // Another request may already have refreshed while this one was in flight.
    const token = current && current !== sentToken ? current : await store.refreshSession();
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  } catch {
    throw error;
  }
});

const DEFAULT_PAGE_SIZE = 2000;

export const getDoctypeList = async (
  doctype: string,
  fields: string[] = ['*'],
  filters: any = {},
  options?: { limit?: number; limit_start?: number }
) => {
  try {
    const limit = options?.limit ?? 999999;
    const limit_start = options?.limit_start ?? 0;
    const params = {
      doctype,
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_page_length: limit,
      limit_start,
      // Stable newest-first order so chunks don't skip rows.
      order_by: 'creation desc, name desc',
    };
    let response = null;
    if (doctype === 'Recipient') {
      // Custom endpoint (includes family members). Older backends ignore these params
      // and return everything; callers stop paging when a page is larger than asked.
      const creation = filters?.creation;
      response = await api.get('/api/method/aids.api.get_recipients', {
        params: {
          limit_start,
          limit_page_length: options?.limit ?? 0,
          creation_after: Array.isArray(creation) ? creation[1] : undefined,
        },
      });
    } else {
      response = await api.get('/api/method/frappe.client.get_list', {
        params,
      });
    }

    return response.data.message || response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetches all records matching filters in pages. Use for large datasets.
 * Filters can include creation date for incremental sync, e.g. { creation: ['>=', '2024-01-01'] }
 */
export const getDoctypeListPaginated = async (
  doctype: string,
  fields: string[],
  filters: any = {},
  pageSize: number = DEFAULT_PAGE_SIZE,
  onPage?: (page: number, count: number) => void
): Promise<any[]> => {
  const all: any[] = [];
  let limit_start = 0;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    const batch = await getDoctypeList(doctype, fields, filters, {
      limit: pageSize,
      limit_start,
    });
    const records = Array.isArray(batch) ? batch : [];
    all.push(...records);
    onPage?.(page, records.length);
    hasMore = records.length === pageSize;
    limit_start += pageSize;
    page++;
  }

  return all;
};

export interface BulkAidResult {
  client_id: string;
  name?: string;
  error?: string;
}

/** Insert many AIDs in one request (backend `aids.api.bulk_insert_aids`, max 200). */
export const bulkInsertAids = async (aids: Record<string, any>[]): Promise<BulkAidResult[]> => {
  const response = await api.post('/api/method/aids.api.bulk_insert_aids', { aids });
  const data = response.data?.message;
  return Array.isArray(data) ? data : [];
};

/** Number of records matching filters (respects the user's permissions). */
export const getDoctypeCount = async (doctype: string, filters: any = {}): Promise<number> => {
  const response = await api.get('/api/method/frappe.client.get_count', {
    params: { doctype, filters: JSON.stringify(filters) },
  });
  return Number(response.data?.message ?? 0);
};

/**
 * Creates a new document in Frappe via REST API.
 * POST /api/resource/{doctype} with JSON body.
 * @returns The created document (includes server-assigned `name`)
 */
export const insertDoc = async (doctype: string, doc: Record<string, any>) => {
  try {
    const response = await api.post(`/api/resource/${doctype}`, doc);
    return response.data?.data || response.data;
  } catch (error: any) {
    if (error.response?.data) {
      console.warn('API Error Details:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.warn('API Error:', error.message);
    }
    throw error;
  }
};

export default api;
