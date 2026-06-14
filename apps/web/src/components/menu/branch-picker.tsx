'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { PublicBranch } from '@/lib/api';
import { sortBranchesByDistance } from '@/lib/api';

interface Props {
  branches: PublicBranch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function BranchPicker({ branches, selectedId, onSelect }: Props) {
  const [sorted, setSorted] = useState<(PublicBranch & { distanceKm?: number })[]>(branches);
  const [gpsLoading, setGpsLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      if (!selectedId && branches.length > 0) onSelect(branches[0].id);
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const result = sortBranchesByDistance(branches, pos.coords.latitude, pos.coords.longitude);
        setSorted(result);
        if (!selectedId && result.length > 0) onSelect(result[0].id);
        setGpsLoading(false);
      },
      () => {
        if (!selectedId && branches.length > 0) onSelect(branches[0].id);
        setGpsLoading(false);
      },
      { timeout: 5000 },
    );
  }, []);

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin className="w-3.5 h-3.5 text-[#FF6B35]" />
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Sucursal</span>
        {gpsLoading && <span className="text-[10px] text-gray-400 ml-1">Detectando ubicación...</span>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {sorted.map((branch, i) => {
          const isNearest = i === 0 && branch.distanceKm !== undefined;
          const isSelected = branch.id === selectedId;
          return (
            <button
              key={branch.id}
              onClick={() => onSelect(branch.id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                isSelected
                  ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#FF6B35]'
              }`}
            >
              {branch.name}
              {isNearest && !isSelected && (
                <span className="bg-[#FF6B35] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  Más cercana
                </span>
              )}
              {branch.distanceKm !== undefined && (
                <span className={`text-[9px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                  {branch.distanceKm < 1
                    ? `${Math.round(branch.distanceKm * 1000)}m`
                    : `${branch.distanceKm.toFixed(1)}km`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
