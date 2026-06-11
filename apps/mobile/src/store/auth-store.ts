import { create } from 'zustand';

export interface AuthPayload {
  accessToken: string;
  businessId: string;
  businessName: string;
  userName: string;
  role: string;
}

interface AuthState extends AuthPayload {
  sessionExpired: boolean;
  setAuth: (payload: AuthPayload) => void;
  clearAuth: () => void;
  setSessionExpired: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: '',
  businessId: '',
  businessName: '',
  userName: '',
  role: '',
  sessionExpired: false,
  setAuth: (payload) => set({ ...payload, sessionExpired: false }),
  clearAuth: () =>
    set({ accessToken: '', businessId: '', businessName: '', userName: '', role: '', sessionExpired: false }),
  setSessionExpired: () => set({ sessionExpired: true }),
}));
