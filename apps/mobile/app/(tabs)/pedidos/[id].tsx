import { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrder } from '../../../src/hooks/use-order';
import { useUpdateOrderStatus } from '../../../src/hooks/use-update-status';
import {
  STATUS_CONFIG, NEXT_TRANSITION, CANCEL_TRANSITION, type OrderStatus,
} from '../../../src/constants/order-status';

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: order, isLoading, isError, refetch } = useOrder(id);
  const { mutate: updateStatus, isPending } = useUpdateOrderStatus(id);

  const handleWhatsApp = useCallback(async () => {
    if (!order) return;
    const digits = order.customerPhone.replace(/\D/g, '');
    const phone = digits.length === 10 ? `52${digits}` : digits;
    const text = encodeURIComponent(`Hola, sobre tu pedido #${order.orderNumber} de PideFacil`);
    const url = `https://wa.me/${phone}?text=${text}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('WhatsApp no disponible', 'No se encontró WhatsApp en este dispositivo.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir WhatsApp.');
    }
  }, [order]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-red-500 text-base text-center font-medium mb-4">
          Error al cargar el pedido.
        </Text>
        <TouchableOpacity onPress={() => refetch()} className="bg-brand-500 rounded-2xl px-6 py-3">
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
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

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
    >
      {/* Header */}
      <View className="bg-brand-900 pb-6 px-4" style={{ paddingTop: insets.top + 16 }}>
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-gray-300 text-sm">← Volver</Text>
        </TouchableOpacity>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Text className="text-white text-2xl font-black">Pedido #{order.orderNumber}</Text>
          <View style={{ backgroundColor: statusConfig?.color ?? '#9CA3AF' }} className="rounded-full px-3 py-1">
            <Text className="text-white text-sm font-bold">{statusConfig?.label ?? status}</Text>
          </View>
        </View>
      </View>

      {/* Trust alert banner */}
      {order.customer?.trustLevel === 'BLOCKED' && (
        <View className="bg-red-500 px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
          <Text className="text-white font-bold text-sm flex-1">Cliente bloqueado — revisa antes de preparar</Text>
        </View>
      )}
      {order.customer?.trustLevel === 'RISK' && (
        <View className="bg-amber-500 px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
          <Text className="text-white font-bold text-sm flex-1">Cliente en riesgo — procede con cuidado</Text>
        </View>
      )}

      {/* Customer info */}
      {order.customer && (
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4">
          <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">Cliente</Text>
          <TouchableOpacity onPress={() => router.push(`/(tabs)/clientes/${order.customer!.id}`)}>
            <Text className="text-brand-500 font-semibold text-base">{order.customer.name}</Text>
          </TouchableOpacity>
          <Text className="text-gray-500 text-sm mt-0.5">{order.customer.phone}</Text>
          {order.customer.notes ? (
            <Text className="text-gray-600 text-sm mt-2 italic">
              Indicaciones: {order.customer.notes}
            </Text>
          ) : null}
        </View>
      )}

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
                <Text className="text-gray-500 text-xs">${item.price.toFixed(2)} × {item.quantity}</Text>
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
