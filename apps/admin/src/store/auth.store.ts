import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  businessId: string | null;
  businessSlug: string | null;
  userName: string | null;
  setAuth: (params: {
    accessToken: string;
    businessId: string;
    businessSlug: string;
    userName: string;
  }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  businessId: null,
  businessSlug: null,
  userName: null,
  setAuth: ({ accessToken, businessId, businessSlug, userName }) =>
    set({ accessToken, businessId, businessSlug, userName }),
  clearAuth: () =>
    set({ accessToken: null, businessId: null, businessSlug: null, userName: null }),
}));
