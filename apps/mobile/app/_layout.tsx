import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, Slot, useSegments } from 'expo-router';
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
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { setAuth, clearAuth, sessionExpired } = useAuthStore();
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
        setIsAuthenticated(true);
      } catch {
        await clearTokens().catch(() => {});
        clearAuth();
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (sessionExpired) setIsAuthenticated(false);
  }, [sessionExpired]);

  if (checking) {
    return (
      <View className="flex-1 bg-brand-900 items-center justify-center">
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    );
  }

  const inAuthGroup = segments[0] === '(tabs)';

  if (!isAuthenticated && inAuthGroup) {
    return <Redirect href="/login" />;
  }

  if (isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(tabs)/pedidos" />;
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
