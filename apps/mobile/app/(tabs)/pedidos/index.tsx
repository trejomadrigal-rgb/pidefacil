import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOrders } from '../../../src/hooks/use-orders';
import { useAuthStore } from '../../../src/store/auth-store';
import { clearTokens, getItem } from '../../../src/lib/secure-storage';
import { logoutApi } from '../../../src/api/auth';
import { STATUS_CONFIG, type OrderStatus } from '../../../src/constants/order-status';
import type { OrderListItem } from '../../../src/api/orders';

const FILTER_CHIPS = [
  { label: 'Todos',       value: null },
  { label: 'Nuevos',      value: 'NEW' },
  { label: 'En revisión', value: 'UNDER_REVIEW' },
  { label: 'Confirmados', value: 'CONFIRMED' },
  { label: 'Preparando',  value: 'IN_PREPARATION' },
  { label: 'Listos',      value: 'READY' },
];

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)}h`;
}

function OrderCard({ order, onPress }: { order: OrderListItem; onPress: () => void }) {
  const config = STATUS_CONFIG[order.status as OrderStatus];
  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mb-3 mx-4"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-brand-500 text-lg font-black">#{order.orderNumber}</Text>
        <View style={{ backgroundColor: config?.color ?? '#9CA3AF' }} className="rounded-full px-3 py-1">
          <Text className="text-white text-xs font-bold">{config?.label ?? order.status}</Text>
        </View>
      </View>
      <Text className="text-gray-900 font-semibold text-base mb-1">{order.customerName}</Text>
      <View className="flex-row justify-between items-center">
        <Text className="text-gray-500 text-sm">
          {order.deliveryType === 'PICKUP' ? '🏪 Para recoger' : '🚗 A domicilio'}
          {' · '}{order.itemCount} {order.itemCount === 1 ? 'producto' : 'productos'}
        </Text>
        <Text className="text-gray-400 text-xs">{formatRelativeTime(order.createdAt)}</Text>
      </View>
      <Text className="text-brand-900 font-bold text-base mt-2">${order.total.toFixed(2)}</Text>
    </TouchableOpacity>
  );
}

export default function PedidosScreen() {
  const router = useRouter();
  const { businessName, clearAuth } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const { data: orders = [], isLoading, isRefetching, refetch } = useOrders();

  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const filtered = activeFilter ? sorted.filter((o) => o.status === activeFilter) : sorted;

  const handleLogout = useCallback(async () => {
    try {
      const refreshToken = await getItem('refresh_token');
      if (refreshToken) await logoutApi(refreshToken);
    } catch { /* best-effort */ }
    await clearTokens();
    clearAuth();
    router.replace('/login');
  }, [router, clearAuth]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-brand-900 pt-14 pb-4 px-4 flex-row items-center justify-between">
        <Text className="text-white font-bold text-lg" numberOfLines={1}>
          {businessName || 'Pedidos'}
        </Text>
        <TouchableOpacity onPress={handleLogout} className="p-2">
          <Text style={{ fontSize: 20 }}>↩️</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="py-3"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTER_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.label}
            onPress={() => setActiveFilter(chip.value)}
            className={`px-4 py-2 rounded-full border ${
              activeFilter === chip.value
                ? 'bg-brand-500 border-brand-500'
                : 'bg-white border-gray-200'
            }`}
          >
            <Text className={`text-sm font-semibold ${activeFilter === chip.value ? 'text-white' : 'text-gray-600'}`}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6B35" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => router.push(`/(tabs)/pedidos/${item.id}`)} />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6B35" />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-24">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-gray-400 text-base font-medium">No hay pedidos activos hoy</Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}
