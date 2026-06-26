import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReportsDashboard, type ReportPeriod } from '../../src/hooks/use-reports';
import type { TopProduct } from '../../src/api/reports';

const PERIODS: { label: string; value: ReportPeriod }[] = [
  { label: 'Hoy', value: 'today' },
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
];

function PeriodChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-1.5 rounded-full mr-2 ${active ? 'bg-brand-500' : 'bg-gray-800'}`}
    >
      <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-400'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ProductRow({ product, rank, maxQty }: { product: TopProduct; rank: number; maxQty: number }) {
  const pct = maxQty > 0 ? (product.totalQuantity / maxQty) * 100 : 0;
  return (
    <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
      <Text className="text-brand-500 font-black text-sm w-5">{rank}</Text>
      <Text className="text-white text-sm flex-1" numberOfLines={1}>{product.productName}</Text>
      <View className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <View className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
      </View>
      <Text className="text-gray-400 text-sm w-6 text-right">{product.totalQuantity}</Text>
    </View>
  );
}

export default function ReportesScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const { data, isLoading, isError, refetch, isRefetching } = useReportsDashboard(period);

  const summary = data?.summary;
  const topProducts = (data?.topProducts ?? []).slice(0, 5);
  const maxQty = Math.max(...topProducts.map((p) => p.totalQuantity), 1);

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6B35" />
      }
    >
      {/* Header */}
      <Text className="text-white text-xl font-black font-jakarta mb-4">Reportes</Text>

      {/* Period chips */}
      <View className="flex-row mb-6">
        {PERIODS.map((p) => (
          <PeriodChip
            key={p.value}
            label={p.label}
            active={period === p.value}
            onPress={() => setPeriod(p.value)}
          />
        ))}
      </View>

      {isError && (
        <View className="bg-red-900/30 border border-red-700 rounded-2xl p-4 mb-4">
          <Text className="text-red-400 text-sm">Error al cargar reportes.</Text>
        </View>
      )}

      {isLoading ? (
        <View className="items-center py-12">
          <ActivityIndicator color="#FF6B35" />
        </View>
      ) : (
        <>
          {/* KPI cards 2x2 */}
          <View className="flex-row mb-4" style={{ gap: 12 }}>
            <View className="flex-1 bg-brand-500 rounded-2xl p-4">
              <Text className="text-white text-2xl font-black">
                ${(summary?.totalRevenue ?? 0).toLocaleString('es-MX')}
              </Text>
              <Text className="text-white/70 text-xs mt-1">Ventas totales</Text>
            </View>
            <View className="flex-1 bg-gray-800 rounded-2xl p-4">
              <Text className="text-white text-2xl font-black">{summary?.totalOrders ?? 0}</Text>
              <Text className="text-gray-400 text-xs mt-1">Pedidos</Text>
            </View>
          </View>

          {/* Status pills */}
          <View className="flex-row mb-6" style={{ gap: 12 }}>
            <View className="flex-1 bg-gray-800 rounded-xl p-3">
              <Text className="text-green-400 text-lg font-black">{summary?.deliveredOrders ?? 0}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Entregados</Text>
            </View>
            <View className="flex-1 bg-gray-800 rounded-xl p-3">
              <Text className="text-brand-500 text-lg font-black">{summary?.confirmedOrders ?? 0}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">En progreso</Text>
            </View>
            <View className="flex-1 bg-gray-800 rounded-xl p-3">
              <Text className="text-red-400 text-lg font-black">{summary?.cancelledOrders ?? 0}</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Cancelados</Text>
            </View>
          </View>

          {/* Top products */}
          {topProducts.length > 0 && (
            <View className="bg-gray-800 rounded-2xl p-4 mb-4">
              <Text className="text-white font-bold text-sm mb-4">Top productos</Text>
              {topProducts.map((p, i) => (
                <ProductRow key={p.productId} product={p} rank={i + 1} maxQty={maxQty} />
              ))}
            </View>
          )}

          {/* Frequent customers */}
          {(summary?.frequentCustomers ?? 0) > 0 && (
            <View className="bg-gray-800 rounded-2xl p-4 flex-row items-center" style={{ gap: 12 }}>
              <Text className="text-brand-500 text-2xl font-black">{summary?.frequentCustomers}</Text>
              <Text className="text-gray-400 text-sm flex-1">
                cliente{(summary?.frequentCustomers ?? 0) !== 1 ? 's' : ''} frecuente{(summary?.frequentCustomers ?? 0) !== 1 ? 's' : ''} en este período
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
