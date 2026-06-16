import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Alert, ActivityIndicator } from 'react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeliveryOrders, useMarkOutForDelivery, useConfirmDelivery, useNotifyReturn } from '../../../src/hooks/use-delivery-orders';
import type { DeliveryOrder } from '../../../src/api/delivery';
import { DeliveryChatPanel } from '../../../src/components/DeliveryChatPanel';

const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

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

export default function DeliveryOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: orders } = useDeliveryOrders();
  const order = orders?.find((o) => o.id === id) as DeliveryOrder | undefined;
  const outForDelivery = useMarkOutForDelivery();
  const confirmDelivery = useConfirmDelivery();
  const notifyReturn = useNotifyReturn();
  const [showSummary, setShowSummary] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'chat'>('detail');

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#FF6B35" />
      </View>
    );
  }

  const isTerminal = TERMINAL_STATUSES.includes(order.status);
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
            try {
              await confirmDelivery.mutateAsync(order.id);
              if (allDelivered) setShowSummary(true);
              else router.back();
            } catch {
              Alert.alert('Error', 'No se pudo confirmar la entrega. Intenta de nuevo.');
            }
          },
        },
      ],
    );
  };

  const handleNotifyReturn = async () => {
    try {
      await notifyReturn.mutateAsync();
      Alert.alert('Listo', 'Se notificó al administrador que regresaste.');
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo enviar el aviso. Intenta de nuevo.');
    }
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
        <Animated.View entering={FadeInDown.delay(0).springify().damping(18)}>
          <Text className="text-2xl font-black text-gray-900 mb-1">Resumen de salida</Text>
          <Text className="text-gray-500 text-sm mb-6">{delivered.length} pedidos entregados</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-600">Efectivo a entregar</Text>
            <Text className="font-black text-[#FF6B35]">${totalCash.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-600">Cobrado en tarjeta</Text>
            <Text className="font-bold text-gray-900">${totalCard.toFixed(2)}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>
          <SpringButton
            onPress={handleNotifyReturn}
            disabled={notifyReturn.isPending}
            style={{ backgroundColor: '#FF6B35', borderRadius: 16, paddingVertical: 20, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {notifyReturn.isPending ? 'Enviando...' : '✅ Avisar que regresé'}
            </Text>
          </SpringButton>
        </Animated.View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-[#1A1A2E] pt-14 pb-4 px-5">
        <Pressable onPress={() => router.back()} className="flex-row items-center mb-2">
          <Text className="text-gray-400 text-sm">← Mis pedidos</Text>
        </Pressable>
        <Text className="text-white font-black text-xl">Pedido #{order.orderNumber}</Text>
        <Text className="text-gray-400 text-sm mt-1">{order.customerName}</Text>
      </View>

      {/* Tab switcher */}
      {!isTerminal && (
        <View className="flex-row bg-gray-100 rounded-xl mx-5 mt-3 p-1">
          {(['detail', 'chat'] as const).map((tab) => (
            <Pressable
              key={tab}
              className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-white' : ''}`}
              onPress={() => setActiveTab(tab)}
            >
              <Text className={`text-sm font-bold ${activeTab === tab ? 'text-[#FF6B35]' : 'text-gray-500'}`}>
                {tab === 'detail' ? '📦 Detalle' : '💬 Chat'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Content */}
      {activeTab === 'chat' && !isTerminal ? (
        <Animated.View entering={FadeIn.duration(200)} className="flex-1 bg-gray-50 mt-2">
          <DeliveryChatPanel orderId={order.id} />
        </Animated.View>
      ) : (
        <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Address */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18)} className="bg-white rounded-2xl p-4 mb-3">
            <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Dirección</Text>
            <Text className="text-gray-900 font-medium mb-3">{order.deliveryAddress ?? '—'}</Text>
            {order.deliveryAddress ? (
              <Pressable
                className="bg-blue-50 rounded-xl py-3 items-center"
                onPress={() =>
                  Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress!)}`)
                }
              >
                <Text className="text-blue-600 font-bold text-sm">🗺️ Abrir en Maps</Text>
              </Pressable>
            ) : null}
          </Animated.View>

          {/* Phone */}
          <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} className="bg-white rounded-2xl p-4 mb-3">
            <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Cliente</Text>
            <Pressable onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}>
              <Text className="text-[#FF6B35] font-bold">📞 {order.customerPhone}</Text>
            </Pressable>
          </Animated.View>

          {/* Items */}
          <Animated.View entering={FadeInDown.delay(180).springify().damping(18)} className="bg-white rounded-2xl p-4 mb-3">
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
          </Animated.View>

          {order.notes ? (
            <Animated.View entering={FadeInDown.delay(240).springify().damping(18)} className="bg-yellow-50 rounded-2xl p-4 mb-3">
              <Text className="text-xs text-gray-500 font-semibold uppercase mb-1">Notas</Text>
              <Text className="text-gray-700">{order.notes}</Text>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}

      {/* Action buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        {order.status === 'READY' && (
          <SpringButton
            onPress={async () => {
              try {
                await outForDelivery.mutateAsync(order.id);
              } catch {
                Alert.alert('Error', 'No se pudo actualizar el pedido. Intenta de nuevo.');
              }
            }}
            disabled={outForDelivery.isPending}
            style={{ backgroundColor: '#FF6B35', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {outForDelivery.isPending ? 'Procesando...' : '🛵 Salir a entregar'}
            </Text>
          </SpringButton>
        )}
        {order.status === 'OUT_FOR_DELIVERY' && (
          <SpringButton
            onPress={handleConfirmDelivery}
            disabled={confirmDelivery.isPending}
            style={{ backgroundColor: '#22C55E', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {confirmDelivery.isPending ? 'Procesando...' : '✅ Confirmar entrega'}
            </Text>
          </SpringButton>
        )}
      </View>
    </View>
  );
}
