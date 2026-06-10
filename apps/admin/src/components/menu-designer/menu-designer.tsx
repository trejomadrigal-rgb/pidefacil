'use client';

import { TreePanel } from './tree-panel';
import { DetailPanel } from './detail-panel';
import { QRPreviewSheet } from './qr-preview-sheet';

export function MenuDesigner() {
  return (
    <div className="flex h-full overflow-hidden">
      <TreePanel />
      <DetailPanel />
      <QRPreviewSheet />
    </div>
  );
}
