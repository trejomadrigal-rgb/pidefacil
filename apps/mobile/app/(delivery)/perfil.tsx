import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import { clearTokens } from '../../src/lib/secure-storage';

export default function DeliveryPerfilScreen() {
  const router = useRouter();
  const { userName, businessName, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    await clearTokens();
    clearAuth();
    router.replace('/login');
  };

  return (
    <View className="flex-1 bg-gray-50 pt-14 px-5">
      <Text className="text-xl font-black text-gray-900 mb-1">{userName}</Text>
      <Text className="text-sm text-gray-500 mb-8">{businessName} · Repartidor</Text>
      <TouchableOpacity
        className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center"
        onPress={handleLogout}
      >
        <Text className="text-red-600 font-bold">Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}
