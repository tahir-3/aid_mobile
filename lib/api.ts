import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// The base URL will be updated later by the user
export const API_BASE_URL = 'https://www.mashro3-amer.com/'; //'https://www.mashro3-amer.com/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add the access token to every request
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken;
  
  // Explicitly check if we're on a login route to avoid sending old/expired tokens
  if (config.url?.includes('aids.api.login')) {
    console.log('Sending login request (no token)');
    return config;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url} [Token attached]`);
  } else {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url} [No token]`);
  }
  return config;
});

export const logoutFromFrappe = async () => {
  try {
    await api.get('/api/method/logout');
  } catch (e) {
    console.warn('Server-side logout failed (might be offline):', e);
  }
};

export const loginToFrappe = async (usr: string, pwd: string) => {
  try {
    // Replace 'your_app' with the actual module name where the login function is defined
    const response = await api.post('/api/method/aids.api.login', {
      usr,
      pwd,
    });
    return response.data.message || response.data;
  } catch (error) {
    throw error;
  }
};

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
    };
    let response = null
    if (doctype === 'Recipient') {
      response = await api.get('/api/method/aids.api.get_recipients');
        console.log({response})
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
