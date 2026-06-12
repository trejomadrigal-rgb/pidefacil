import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useOrders } from '../../../src/hooks/use-orders';
import { getSocket, disconnectSocket } from '../../../src/lib/socket';
import { useAuthStore } from '../../../src/store/auth-store';
import { clearTokens, getItem } from '../../../src/lib/secure-storage';
import { logoutApi } from '../../../src/api/auth';
import { STATUS_CONFIG, type OrderStatus } from '../../../src/constants/order-status';
import type { OrderListItem, TrustLevel } from '../../../src/api/orders';

const TRUST_BADGE: Partial<Record<TrustLevel, { label: string; bg: string }>> = {
  BLOCKED: { label: '🚫 Bloqueado', bg: '#EF4444' },
  RISK:    { label: '⚠️ En riesgo', bg: '#F59E0B' },
  TRUSTED: { label: '⭐ Frecuente', bg: '#10B981' },
};

const FILTER_CHIPS = [
  { label: 'Todos',       value: null },
  { label: 'Nuevos',      value: 'NEW' },
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
        <Text className="text-brand-500 text-lg font-black">Pedido #{order.orderNumber}</Text>
        <View style={{ backgroundColor: config?.color ?? '#9CA3AF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 }}>{config?.label ?? order.status}</Text>
        </View>
      </View>
      <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
        <Text className="text-gray-900 font-semibold text-base flex-1">{order.customerName}</Text>
        {order.customerTrustLevel && TRUST_BADGE[order.customerTrustLevel] && (
          <View style={{ backgroundColor: TRUST_BADGE[order.customerTrustLevel]!.bg }} className="rounded-full px-2 py-0.5">
            <Text className="text-white text-[10px] font-bold">{TRUST_BADGE[order.customerTrustLevel]!.label}</Text>
          </View>
        )}
      </View>
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
  const { data: orders = [], isLoading, isRefetching, refetch, isError } = useOrders();
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    s.on('new_order', handler);
    return () => {
      s.off('new_order', handler);
    };
  }, [queryClient]);

  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  );
  const filtered = useMemo(
    () => (activeFilter ? sorted.filter((o) => o.status === activeFilter) : sorted),
    [sorted, activeFilter],
  );

  const insets = useSafeAreaInsets();

  const renderItem = useCallback(
    ({ item }: { item: OrderListItem }) => (
      <OrderCard order={item} onPress={() => router.push(`/(tabs)/pedidos/${item.id}`)} />
    ),
    [router],
  );

  const handleLogout = useCallback(async () => {
    try {
      const refreshToken = await getItem('refresh_token');
      if (refreshToken) await logoutApi(refreshToken);
    } catch { /* best-effort */ }
    await clearTokens();
    clearAuth();
    disconnectSocket();
    router.replace('/login');
  }, [router, clearAuth]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        className="bg-brand-900 pb-4 px-4 flex-row items-center justify-between"
        style={{ paddingTop: insets.top + 8 }}
      >
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' }}
      >
        {FILTER_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.label}
            onPress={() => setActiveFilter(chip.value)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1.5,
              backgroundColor: activeFilter === chip.value ? '#FF6B35' : '#FFFFFF',
              borderColor: activeFilter === chip.value ? '#FF6B35' : '#E5E7EB',
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: '600',
              color: activeFilter === chip.value ? '#FFFFFF' : '#4B5563',
            }}>
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
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-base text-center font-medium">
            Error al cargar pedidos. Desliza hacia abajo para reintentar.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
