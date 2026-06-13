interface Props {
  mrr: number;
  activeBusinesses: number;
  trialBusinesses: number;
  totalOrders30d: number;
}

const fmtMxn = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export function SaKpiCards({ mrr, activeBusinesses, trialBusinesses, totalOrders30d }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-[#1A1A2E] rounded-xl p-4">
        <p className="text-2xl font-black text-white">{fmtMxn(mrr)}</p>
        <p className="text-xs text-white/50 mt-1">MRR</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-2xl font-black text-[#FF6B35]">{activeBusinesses}</p>
        <p className="text-xs text-gray-400 mt-1">Negocios activos</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-2xl font-black text-blue-500">{trialBusinesses}</p>
        <p className="text-xs text-gray-400 mt-1">En trial</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-2xl font-black text-gray-800">{totalOrders30d.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">Pedidos (30d)</p>
      </div>
    </div>
  );
}
