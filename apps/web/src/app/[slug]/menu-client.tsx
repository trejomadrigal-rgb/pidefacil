'use client';

import { useState } from 'react';
import { BranchPicker } from '@/components/menu/branch-picker';
import type { PublicBranch } from '@/lib/api';

interface Props {
  branches: PublicBranch[];
}

export function MenuClient({ branches }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    branches.length === 1 ? branches[0].id : null,
  );

  if (branches.length <= 1) return null;

  return (
    <BranchPicker
      branches={branches}
      selectedId={selectedBranchId}
      onSelect={setSelectedBranchId}
    />
  );
}
