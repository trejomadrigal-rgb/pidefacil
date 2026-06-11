import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrder } from '../../../src/hooks/use-order';
import { useUpdateOrderStatus } from '../../../src/hooks/use-update-status';
import {
  STATUS_CONFIG, NEXT_TRANSITION, CANCEL_TRANSITION, type OrderStatus,
} from '../../../src/constants/order-status';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: order, isLoading } = useOrder(id);
  const { mutate: updateStatus, isPending } = useUpdateOrderStatus(id);

  if (isLoading || !order) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    );
  }

  const status = order.status;
  const statusConfig = STATUS_CONFIG[status];
  const nextTransition = NEXT_TRANSITION[status];
  const cancelTransition = CANCEL_TRANSITION[status];

  const handleStatusChange = (newStatus: OrderStatus, label: string) => {
    Alert.alert(label, `¿Confirmas "${label.toLowerCase()}" este pedido?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, confirmar', onPress: () => updateStatus(newStatus) },
    ]);
  };

  const handleWhatsApp = () => {
    const phone = order.customerPhone.replace(/\D/g, '');
    const text = encodeURIComponent(`Hola, sobre tu pedido #${order.orderNumber} de PideFacil`);
    Linking.openURL(`https://wa.me/${phone}?text=${text}`);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-brand-900 pb-6 px-4" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Text className="text-white text-2xl font-black">#{order.orderNumber}</Text>
          <View style={{ backgroundColor: statusConfig?.color ?? '#9CA3AF' }} className="rounded-full px-3 py-1">
            <Text className="text-white text-sm font-bold">{statusConfig?.label ?? status}</Text>
          </View>
        </View>
      </View>

      <View className="px-4 pt-4">
        {/* Cliente */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-3">Cliente</Text>
          <Text className="text-gray-900 font-semibold text-base">{order.customerName}</Text>
          <Text className="text-gray-500 text-sm mt-1">{order.customerPhone}</Text>
          <Text className="text-gray-500 text-sm mt-1">
            {order.deliveryType === 'PICKUP'
              ? '🏪 Para recoger'
              : `🚗 A domicilio: ${order.deliveryAddress ?? ''}`}
          </Text>
          {order.notes ? (
            <Text className="text-amber-600 text-sm mt-2 bg-amber-50 rounded-xl p-2">
              📝 {order.notes}
            </Text>
          ) : null}
        </View>

        {/* Items */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-3">Productos</Text>
          {order.items.map((item, i) => (
            <View key={i} className="flex-row justify-between items-start mb-3">
              <View className="flex-1 mr-2">
                <Text className="text-gray-900 font-medium text-sm">{item.name}</Text>
                {item.notes ? <Text className="text-gray-400 text-xs mt-0.5">{item.notes}</Text> : null}
              </View>
              <View className="items-end">
                <Text className="text-gray-500 text-xs">x{item.quantity}</Text>
                <Text className="text-gray-900 font-semibold text-sm">${item.subtotal.toFixed(2)}</Text>
              </View>
            </View>
          ))}
          <View className="border-t border-gray-100 mt-2 pt-3 flex-row justify-between">
            <Text className="text-gray-900 font-bold">Total</Text>
            <Text className="text-brand-500 font-black text-lg">${order.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Acciones */}
        <View className="mb-8" style={{ gap: 12 }}>
          <TouchableOpacity className="bg-green-500 rounded-2xl py-4 items-center" onPress={handleWhatsApp}>
            <Text className="text-white font-bold text-base">💬 Contactar por WhatsApp</Text>
          </TouchableOpacity>

          {nextTransition && (
            <TouchableOpacity
              className="bg-brand-500 rounded-2xl py-4 items-center"
              onPress={() => handleStatusChange(nextTransition.status, nextTransition.label)}
              disabled={isPending}
            >
              {isPending
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-bold text-base">{nextTransition.label}</Text>}
            </TouchableOpacity>
          )}

          {cancelTransition && (
            <TouchableOpacity
              className="border-2 border-red-400 rounded-2xl py-4 items-center"
              onPress={() => handleStatusChange(cancelTransition.status, cancelTransition.label)}
              disabled={isPending}
            >
              <Text className="text-red-400 font-bold text-base">{cancelTransition.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
