import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter } from 'expo-router';
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
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const { setAuth, clearAuth, sessionExpired } = useAuthStore();

  useEffect(() => {
    (async () => {
      const refreshToken = await getItem('refresh_token');
      if (!refreshToken) {
        setChecking(false);
        router.replace('/login');
        return;
      }
      try {
        const data = await refreshAuth(refreshToken);
        await saveTokens(data.access_token, data.refresh_token);
        setAuth({
          accessToken: data.access_token,
          businessId: data.business.id,
          businessName: data.business.name,
          userName: data.user.name,
          role: data.user.role,
        });
        router.replace('/(tabs)/pedidos');
      } catch {
        await clearTokens();
        clearAuth();
        router.replace('/login');
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (sessionExpired) router.replace('/login');
  }, [sessionExpired, router]);

  if (checking) {
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
