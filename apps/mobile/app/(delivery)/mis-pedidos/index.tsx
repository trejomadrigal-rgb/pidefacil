import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useDeliveryOrders } from '../../../src/hooks/use-delivery-orders';

const STATUS_LABEL: Record<string, string> = {
  READY: 'Listo para entregar',
  OUT_FOR_DELIVERY: 'En camino',
};

const STATUS_COLOR: Record<string, string> = {
  READY: 'bg-purple-500',
  OUT_FOR_DELIVERY: 'bg-blue-500',
};

export default function MisPedidosScreen() {
  const router = useRouter();
  const { data: orders = [], isLoading, refetch } = useDeliveryOrders();

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-[#1A1A2E] pt-14 pb-4 px-5">
        <Text className="text-white text-xl font-black">Mis pedidos</Text>
        <Text className="text-gray-400 text-xs mt-1">{orders.length} pedido(s) activo(s)</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Text className="text-4xl mb-3">🛵</Text>
            <Text className="text-gray-500 text-sm">Sin pedidos asignados</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white rounded-2xl p-4 shadow-sm"
            onPress={() => router.push(`/(delivery)/mis-pedidos/${item.id}`)}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-bold text-gray-900">#{item.orderNumber}</Text>
              <View className={`px-2 py-0.5 rounded-full ${STATUS_COLOR[item.status] ?? 'bg-gray-400'}`}>
                <Text className="text-white text-[10px] font-bold">
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-gray-700 font-medium">{item.customerName}</Text>
            <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>{item.deliveryAddress}</Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-xs text-gray-500">{item.paymentMethod}</Text>
              <Text className="text-sm font-bold text-[#FF6B35]">${Number(item.total).toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
