import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth-store';
import { getItem, saveTokens, clearTokens } from '../src/lib/secure-storage';
import { refreshAuth } from '../src/api/auth';
import '../global.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const { accessToken, setAuth, clearAuth } = useAuthStore();
  const initiated = useRef(false);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    (async () => {
      try {
        const refreshToken = await getItem('refresh_token');
        if (!refreshToken) return;
        const data = await refreshAuth(refreshToken);
        await saveTokens(data.access_token, data.refresh_token);
        setAuth({
          accessToken: data.access_token,
          businessId: data.business.id,
          businessName: data.business.name,
          userName: data.user.name,
          role: data.user.role,
        });
      } catch {
        await clearTokens().catch(() => {});
        clearAuth();
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const inTabs = segments[0] === '(tabs)';
    if (!accessToken && inTabs) {
      router.replace('/login');
    }
  }, [initialized, accessToken, segments[0]]);

  if (!initialized) {
    return (
      <View className="flex-1 bg-brand-900 items-center justify-center">
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AuthGate>
        <Slot />
      </AuthGate>
    </QueryClientProvider>
  );
}
