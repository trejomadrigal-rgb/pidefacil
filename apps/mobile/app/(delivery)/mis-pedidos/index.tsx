import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useDeliveryOrders } from '../../../src/hooks/use-delivery-orders';
import type { DeliveryOrder } from '../../../src/api/delivery';

const STATUS_LABEL: Record<string, string> = {
  READY: 'Listo para entregar',
  OUT_FOR_DELIVERY: 'En camino',
};

const STATUS_COLOR: Record<string, string> = {
  READY: '#A855F7',
  OUT_FOR_DELIVERY: '#3B82F6',
};

function DeliveryCard({ item, index, onPress }: { item: DeliveryOrder; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 55, 350)).springify().damping(18)}>
      <TouchableOpacity
        className="bg-white rounded-2xl p-4 shadow-sm"
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-bold text-gray-900 text-base">#{item.orderNumber}</Text>
          <View style={{ backgroundColor: STATUS_COLOR[item.status] ?? '#9CA3AF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
        </View>
        <Text className="text-sm text-gray-700 font-medium">{item.customerName}</Text>
        <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>{item.deliveryAddress ?? '—'}</Text>
        <View className="flex-row justify-between mt-2">
          <Text className="text-xs text-gray-500">{item.paymentMethod ?? '—'}</Text>
          <Text className="text-sm font-black text-[#FF6B35]">${Number(item.total).toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MisPedidosScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useDeliveryOrders();

  const tripId = data?.tripId ?? null;
  const totalOrdersInTrip = data?.totalOrdersInTrip ?? 0;
  const orders = data?.orders ?? [];

  if (isLoading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-4xl mb-3">⚠️</Text>
        <Text className="text-gray-500 text-sm text-center">No se pudo cargar los pedidos. Desliza para reintentar.</Text>
      </View>
    );
  }

  const allDelivered = tripId !== null && orders.length === 0;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-[#1A1A2E] pt-14 pb-4 px-5">
        <Text className="text-white text-xl font-black">Mis pedidos</Text>
        {tripId ? (
          <Text className="text-gray-400 text-xs mt-1">
            Salida activa · {orders.length} de {totalOrdersInTrip} pedido(s)
          </Text>
        ) : (
          <Text className="text-gray-400 text-xs mt-1">Sin salida activa</Text>
        )}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#FF6B35" />}
        ListEmptyComponent={
          <View className="items-center py-20">
            {allDelivered ? (
              <>
                <Text className="text-4xl mb-3">✅</Text>
                <Text className="text-gray-700 text-base font-bold text-center">Todos entregados</Text>
                <Text className="text-gray-500 text-sm text-center mt-1">
                  Espera a que el administrador liquide la salida.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-4xl mb-3">🛵</Text>
                <Text className="text-gray-500 text-sm">Sin pedidos asignados</Text>
              </>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <DeliveryCard
            item={item}
            index={index}
            onPress={() => router.push(`/(delivery)/mis-pedidos/${item.id}`)}
          />
        )}
      />
    </View>
  );
}
