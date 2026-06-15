import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeliveryOrders, useMarkOutForDelivery, useConfirmDelivery, useNotifyReturn } from '../../../src/hooks/use-delivery-orders';
import type { DeliveryOrder } from '../../../src/api/delivery';
export default function DeliveryOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: orders } = useDeliveryOrders();
  const order = orders?.find((o) => o.id === id) as DeliveryOrder | undefined;
  const outForDelivery = useMarkOutForDelivery();
  const confirmDelivery = useConfirmDelivery();
  const notifyReturn = useNotifyReturn();
  const [showSummary, setShowSummary] = useState(false);

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#FF6B35" />
      </View>
    );
  }

  const allDelivered = orders?.every((o) => o.status === 'DELIVERED') ?? false;

  const handleConfirmDelivery = () => {
    Alert.alert(
      'Confirmar entrega',
      `¿Confirmas que entregaste el pedido #${order.orderNumber}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await confirmDelivery.mutateAsync(order.id);
            if (allDelivered) setShowSummary(true);
            else router.back();
          },
        },
      ],
    );
  };

  const handleNotifyReturn = async () => {
    await notifyReturn.mutateAsync();
    Alert.alert('Listo', 'Se notificó al administrador que regresaste.');
    router.back();
  };

  if (showSummary) {
    const delivered = orders?.filter((o) => o.status === 'DELIVERED') ?? [];
    const totalCash = delivered
      .filter((o) => o.paymentMethod === 'CASH')
      .reduce((s, o) => s + Number(o.total), 0);
    const totalCard = delivered
      .filter((o) => o.paymentMethod === 'CARD')
      .reduce((s, o) => s + Number(o.total), 0);

    return (
      <View className="flex-1 bg-gray-50 pt-14 px-5">
        <Text className="text-2xl font-black text-gray-900 mb-1">Resumen de salida</Text>
        <Text className="text-gray-500 text-sm mb-6">{delivered.length} pedidos entregados</Text>
        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-600">Efectivo a entregar</Text>
            <Text className="font-black text-[#FF6B35]">${totalCash.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-600">Cobrado en tarjeta</Text>
            <Text className="font-bold text-gray-900">${totalCard.toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity
          className="bg-[#FF6B35] rounded-2xl py-5 items-center"
          onPress={handleNotifyReturn}
          disabled={notifyReturn.isPending}
        >
          <Text className="text-white font-bold text-base">
            {notifyReturn.isPending ? 'Enviando...' : '✅ Avisar que regresé'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-[#1A1A2E] pt-14 pb-4 px-5">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-2">
          <Text className="text-gray-400 text-sm">← Mis pedidos</Text>
        </TouchableOpacity>
        <Text className="text-white font-black text-xl">Pedido #{order.orderNumber}</Text>
        <Text className="text-gray-400 text-sm mt-1">{order.customerName}</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Address */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Dirección</Text>
          <Text className="text-gray-900 font-medium mb-3">{order.deliveryAddress ?? '—'}</Text>
          {order.deliveryAddress ? (
            <TouchableOpacity
              className="bg-blue-50 rounded-xl py-3 items-center"
              onPress={() =>
                Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress!)}`)
              }
            >
              <Text className="text-blue-600 font-bold text-sm">🗺️ Abrir en Maps</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Phone */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Cliente</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}>
            <Text className="text-[#FF6B35] font-bold">📞 {order.customerPhone}</Text>
          </TouchableOpacity>
        </View>

        {/* Items */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-xs text-gray-500 font-semibold uppercase mb-2">Pedido</Text>
          {order.items.map((item, i) => (
            <View key={i} className="flex-row justify-between py-1">
              <Text className="text-gray-700">{item.product.name} ×{item.quantity}</Text>
              <Text className="font-medium">${Number(item.subtotal).toFixed(2)}</Text>
            </View>
          ))}
          <View className="border-t border-gray-100 mt-2 pt-2 flex-row justify-between">
            <Text className="font-bold text-gray-900">Total</Text>
            <Text className="font-black text-[#FF6B35]">${Number(order.total).toFixed(2)}</Text>
          </View>
          <Text className="text-xs text-gray-500 mt-1">Pago: {order.paymentMethod ?? '—'}</Text>
        </View>

        {order.notes ? (
          <View className="bg-yellow-50 rounded-2xl p-4 mb-3">
            <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Notas</Text>
            <Text className="text-gray-700">{order.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Action buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        {order.status === 'READY' && (
          <TouchableOpacity
            className="bg-[#FF6B35] rounded-2xl py-4 items-center"
            onPress={() => outForDelivery.mutateAsync(order.id)}
            disabled={outForDelivery.isPending}
          >
            <Text className="text-white font-bold text-base">
              {outForDelivery.isPending ? 'Procesando...' : '🛵 Salir a entregar'}
            </Text>
          </TouchableOpacity>
        )}
        {order.status === 'OUT_FOR_DELIVERY' && (
          <TouchableOpacity
            className="bg-green-500 rounded-2xl py-4 items-center"
            onPress={handleConfirmDelivery}
            disabled={confirmDelivery.isPending}
          >
            <Text className="text-white font-bold text-base">
              {confirmDelivery.isPending ? 'Procesando...' : '✅ Confirmar entrega'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
