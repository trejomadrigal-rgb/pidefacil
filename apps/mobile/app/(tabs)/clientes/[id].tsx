import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomer } from '../../../src/hooks/use-customer';
import { useUpdateCustomer } from '../../../src/hooks/use-update-customer';
import { type TrustLevel } from '../../../src/api/customers';

const TRUST_CONFIG: Record<TrustLevel, { label: string; color: string }> = {
  NEW:      { label: 'Nuevo',     color: '#6B7280' },
  FREQUENT: { label: 'Frecuente', color: '#3B82F6' },
  TRUSTED:  { label: 'Confiable', color: '#10B981' },
  RISK:     { label: 'Riesgo',    color: '#F59E0B' },
  BLOCKED:  { label: 'Bloqueado', color: '#EF4444' },
};

const ALL_LEVELS: TrustLevel[] = ['NEW', 'FREQUENT', 'TRUSTED', 'RISK', 'BLOCKED'];

export default function CustomerDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: customer, isLoading, isError, refetch } = useCustomer(id);
  const { mutate: updateCustomer, isPending } = useUpdateCustomer(id);

  const [notes, setNotes] = useState<string>('');
  const [notesInitialized, setNotesInitialized] = useState(false);

  // Initialize notes input once data loads
  if (customer && !notesInitialized) {
    setNotes(customer.notes ?? '');
    setNotesInitialized(true);
  }

  const handleNotesBlur = () => {
    if (customer && notes !== (customer.notes ?? '')) {
      updateCustomer({ notes });
    }
  };

  const handleTrustLevel = (level: TrustLevel) => {
    Alert.alert(
      'Cambiar nivel de confianza',
      `¿Cambiar a "${TRUST_CONFIG[level].label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => updateCustomer({ trustLevel: level }) },
      ],
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#FF6B35" size="large" />
      </View>
    );
  }

  if (isError || !customer) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-red-500 text-base text-center mb-4">Error al cargar el cliente.</Text>
        <TouchableOpacity onPress={() => refetch()} className="bg-brand-500 rounded-2xl px-6 py-3">
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const trustConfig = TRUST_CONFIG[customer.trustLevel];

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
        <Text className="text-white text-2xl font-black">{customer.name}</Text>
        <Text className="text-gray-400 text-sm mt-1">{customer.phone}</Text>
      </View>

      <View className="px-4 mt-4 space-y-4">
        {/* Trust level */}
        <View className="bg-white rounded-2xl p-4">
          <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">Nivel de confianza</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALL_LEVELS.map((level) => {
              const config = TRUST_CONFIG[level];
              const active = customer.trustLevel === level;
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => handleTrustLevel(level)}
                  disabled={active || isPending}
                  style={{
                    backgroundColor: active ? config.color : '#F3F4F6',
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: active ? '#fff' : '#6B7280', fontSize: 12, fontWeight: '600' }}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stats */}
        <View className="bg-white rounded-2xl p-4">
          <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">Estadísticas</Text>
          <Text className="text-gray-900 text-base font-semibold">
            {customer.totalOrders} pedidos completados
          </Text>
        </View>

        {/* Notes */}
        <View className="bg-white rounded-2xl p-4">
          <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">Indicaciones de entrega</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={handleNotesBlur}
            placeholder="Ej: Edificio azul, preguntar en recepción del 3er piso"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="text-gray-900 text-sm"
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
          {isPending && <Text className="text-brand-500 text-xs mt-1">Guardando...</Text>}
        </View>

        {/* Order history */}
        {customer.orders.length > 0 && (
          <View className="bg-white rounded-2xl p-4">
            <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">Últimos pedidos</Text>
            {customer.orders.map((order) => (
              <View key={order.id} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                <View>
                  <Text className="text-gray-900 font-semibold text-sm">#{order.orderNumber}</Text>
                  <Text className="text-gray-400 text-xs">
                    {new Date(order.createdAt).toLocaleDateString('es-MX')}
                  </Text>
                </View>
                <Text className="text-brand-900 font-bold text-sm">${order.total.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
