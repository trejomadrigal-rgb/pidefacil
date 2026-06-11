import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomers } from '../../../src/hooks/use-customers';
import { type CustomerListItem, type TrustLevel } from '../../../src/api/customers';

const TRUST_CONFIG: Record<TrustLevel, { label: string; color: string; textColor: string }> = {
  NEW:      { label: 'Nuevo',     color: '#6B7280', textColor: '#fff' },
  FREQUENT: { label: 'Frecuente', color: '#3B82F6', textColor: '#fff' },
  TRUSTED:  { label: 'Confiable', color: '#10B981', textColor: '#fff' },
  RISK:     { label: 'Riesgo',    color: '#F59E0B', textColor: '#fff' },
  BLOCKED:  { label: 'Bloqueado', color: '#EF4444', textColor: '#fff' },
};

const FILTERS: { label: string; value: TrustLevel | null }[] = [
  { label: 'Todos', value: null },
  { label: 'Nuevos', value: 'NEW' },
  { label: 'Frecuentes', value: 'FREQUENT' },
  { label: 'Confiables', value: 'TRUSTED' },
  { label: 'Riesgo', value: 'RISK' },
  { label: 'Bloqueados', value: 'BLOCKED' },
];

function TrustBadge({ level }: { level: TrustLevel }) {
  const config = TRUST_CONFIG[level];
  return (
    <View style={{ backgroundColor: config.color }} className="rounded-full px-2 py-0.5">
      <Text style={{ color: config.textColor }} className="text-xs font-bold">{config.label}</Text>
    </View>
  );
}

function CustomerCard({ customer, onPress }: { customer: CustomerListItem; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mb-3 mx-4"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start mb-1">
        <Text className="text-gray-900 font-semibold text-base flex-1 mr-2">{customer.name}</Text>
        <TrustBadge level={customer.trustLevel} />
      </View>
      <Text className="text-gray-500 text-sm">{customer.phone}</Text>
      <Text className="text-gray-400 text-xs mt-1">{customer.totalOrders} pedidos completados</Text>
    </TouchableOpacity>
  );
}

export default function ClientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<TrustLevel | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useCustomers();
  const customers = data?.data ?? [];

  const filtered = useMemo(() => {
    let result = customers;
    if (activeFilter) result = result.filter((c) => c.trustLevel === activeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
      );
    }
    return result;
  }, [customers, activeFilter, search]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-brand-900 px-4 pb-4" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-white text-2xl font-black mb-3">Clientes</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o teléfono..."
          placeholderTextColor="#9CA3AF"
          className="bg-white/10 text-white rounded-xl px-4 py-2 text-sm"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-brand-900 pb-3"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            onPress={() => setActiveFilter(f.value)}
            className={`rounded-full px-4 py-1.5 ${activeFilter === f.value ? 'bg-brand-500' : 'bg-white/15'}`}
          >
            <Text className={`text-xs font-semibold ${activeFilter === f.value ? 'text-white' : 'text-gray-300'}`}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6B35" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-base text-center mb-4">Error al cargar clientes.</Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-brand-500 rounded-2xl px-6 py-3">
            <Text className="text-white font-bold">Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CustomerCard customer={item} onPress={() => router.push(`/(tabs)/clientes/${item.id}`)} />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6B35" />}
          ListEmptyComponent={
            <Text className="text-gray-400 text-center mt-12 text-sm">
              {search || activeFilter ? 'No hay clientes con esos filtros.' : 'Aún no hay clientes registrados.'}
            </Text>
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 16 }}
        />
      )}
    </View>
  );
}
