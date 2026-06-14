'use client';

import { useState, useCallback } from 'react';
import { BranchPicker } from '@/components/menu/branch-picker';
import type { PublicBranch } from '@/lib/api';
import { useCartStore } from '@/store/cart.store';

interface Props {
  branches: PublicBranch[];
}

export function MenuClient({ branches }: Props) {
  const setBranchId = useCartStore((s) => s.setBranchId);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    branches.length === 1 ? branches[0].id : null,
  );

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedBranchId(id);
      setBranchId(id);
    },
    [setBranchId],
  );

  if (branches.length <= 1) return null;

  return (
    <BranchPicker
      branches={branches}
      selectedId={selectedBranchId}
      onSelect={handleSelect}
    />
  );
}
