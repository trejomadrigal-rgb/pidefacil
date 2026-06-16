import { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Linking, Alert, Pressable } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrder } from '../../../src/hooks/use-order';
import { useUpdateOrderStatus } from '../../../src/hooks/use-update-status';
import {
  STATUS_CONFIG, NEXT_TRANSITION, CANCEL_TRANSITION, type OrderStatus,
} from '../../../src/constants/order-status';

function SpringButton({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style: object;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 20, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
        onPress={onPress}
        disabled={disabled}
        style={[style, disabled && { opacity: 0.5 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

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
        <SpringButton
          onPress={() => refetch()}
          style={{ backgroundColor: '#FF6B35', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar</Text>
        </SpringButton>
      </View>
    );
  }

  const status = order.status;
  const statusConfig = STATUS_CONFIG[status];
  const nextTransition = NEXT_TRANSITION[status];
  const cancelTransition = CANCEL_TRANSITION[status];

  const handleStatusChange = (newStatus: OrderStatus, label: string) => {
    const isConfirming = order?.status === 'NEW' && newStatus === 'CONFIRMED';
    Alert.alert(
      label,
      isConfirming
        ? '¿Confirmas este pedido? Se abrirá WhatsApp para notificar al cliente.'
        : `¿Confirmas "${label.toLowerCase()}" este pedido?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, confirmar',
          onPress: () => updateStatus(newStatus, {
            onSuccess: () => { if (isConfirming) handleWhatsApp(); },
          }),
        },
      ],
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* Header */}
      <View className="bg-brand-900 pb-6 px-4" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => router.back()} className="mb-3">
          <Text className="text-gray-300 text-sm">← Volver</Text>
        </Pressable>
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

      <View className="px-4 pt-4">
        {/* Cliente */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(18)} className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-3">Cliente</Text>
          {order.customer ? (
            <Pressable onPress={() => router.push(`/(tabs)/clientes/${order.customer!.id}`)}>
              <Text className="text-brand-500 font-semibold text-base">{order.customerName}</Text>
            </Pressable>
          ) : (
            <Text className="text-gray-900 font-semibold text-base">{order.customerName}</Text>
          )}
          <Text className="text-gray-500 text-sm mt-1">{order.customerPhone}</Text>
          <Text className="text-gray-500 text-sm mt-1">
            {order.deliveryType === 'PICKUP'
              ? '🏪 Para recoger'
              : `🚗 A domicilio: ${order.deliveryAddress ?? ''}`}
          </Text>
          {order.customer?.notes ? (
            <Text className="text-gray-600 text-sm mt-1 italic">📌 {order.customer.notes}</Text>
          ) : null}
          {order.notes ? (
            <Text className="text-amber-600 text-sm mt-2 bg-amber-50 rounded-xl p-2">
              📝 {order.notes}
            </Text>
          ) : null}
        </Animated.View>

        {/* Items */}
        <Animated.View entering={FadeInDown.delay(140).springify().damping(18)} className="bg-white rounded-2xl p-4 mb-3">
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
        </Animated.View>

        {/* Acciones */}
        <Animated.View entering={FadeInDown.delay(220).springify().damping(18)} style={{ gap: 12, marginBottom: 8 }}>
          <SpringButton
            onPress={handleWhatsApp}
            style={{ backgroundColor: '#22C55E', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>💬 Contactar por WhatsApp</Text>
          </SpringButton>

          {nextTransition && (
            <SpringButton
              onPress={() => handleStatusChange(nextTransition.status, nextTransition.label)}
              disabled={isPending}
              style={{ backgroundColor: '#FF6B35', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
            >
              {isPending
                ? <ActivityIndicator color="white" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{nextTransition.label}</Text>}
            </SpringButton>
          )}

          {cancelTransition && (
            <SpringButton
              onPress={() => handleStatusChange(cancelTransition.status, cancelTransition.label)}
              disabled={isPending}
              style={{ borderWidth: 2, borderColor: '#F87171', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 16 }}>{cancelTransition.label}</Text>
            </SpringButton>
          )}
        </Animated.View>
      </View>
    </ScrollView>
  );
}
