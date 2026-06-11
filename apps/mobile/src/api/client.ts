import axios from 'axios';
import { getItem, saveTokens, clearTokens } from '../lib/secure-storage';
import { useAuthStore } from '../store/auth-store';
import { BASE_URL, refreshAuth } from './auth';

export const apiClient = axios.create({ baseURL: BASE_URL });

let isRefreshing = false;
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const data = await refreshAuth(refreshToken);
      await saveTokens(data.access_token, data.refresh_token);
      useAuthStore.getState().setAuth({
        accessToken: data.access_token,
        businessId: data.business.id,
        businessName: data.business.name,
        userName: data.user.name,
        role: data.user.role,
      });

      processQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await clearTokens();
      useAuthStore.getState().setSessionExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
