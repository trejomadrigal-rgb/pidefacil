import { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth-store';
import { clearTokens, getItem } from '../../src/lib/secure-storage';
import { logoutApi } from '../../src/api/auth';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  KITCHEN: 'Cocina',
};

export default function PerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { businessName, userName, role, clearAuth } = useAuthStore();

  const handleLogout = useCallback(async () => {
    try {
      const refreshToken = await getItem('refresh_token');
      if (refreshToken) await logoutApi(refreshToken);
      await clearTokens();
      clearAuth();
      router.replace('/login');
    } catch {
      await clearTokens();
      clearAuth();
      router.replace('/login');
    }
  }, [router, clearAuth]);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-brand-900 pb-6 px-4" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-white font-black text-xl">{businessName}</Text>
      </View>

      <View className="px-4 mt-6">
        <View className="bg-white rounded-2xl p-4 mb-6">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-3">Cuenta</Text>
          <Text className="text-gray-900 font-semibold text-base">{userName}</Text>
          <Text className="text-gray-400 text-sm mt-1">{ROLE_LABELS[role] ?? role}</Text>
        </View>

        <TouchableOpacity
          className="border-2 border-red-400 rounded-2xl py-4 items-center"
          onPress={handleLogout}
        >
          <Text className="text-red-400 font-bold text-base">Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
