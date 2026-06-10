import { create } from 'zustand';

interface MenuDesignerState {
  selectedMenuId: string | null;
  selectedCategoryId: string | null;
  selectedProductId: string | null; // 'new' to create
  previewOpen: boolean;
  selectMenu: (id: string) => void;
  selectCategory: (id: string) => void;
  selectProduct: (id: string | 'new') => void;
  clearSelection: () => void;
  togglePreview: () => void;
}

export const useMenuDesignerStore = create<MenuDesignerState>((set) => ({
  selectedMenuId: null,
  selectedCategoryId: null,
  selectedProductId: null,
  previewOpen: false,
  selectMenu: (id) =>
    set({ selectedMenuId: id, selectedCategoryId: null, selectedProductId: null }),
  selectCategory: (id) =>
    set({ selectedCategoryId: id, selectedProductId: null }),
  selectProduct: (id) => set({ selectedProductId: id }),
  clearSelection: () =>
    set({ selectedMenuId: null, selectedCategoryId: null, selectedProductId: null }),
  togglePreview: () => set((s) => ({ previewOpen: !s.previewOpen })),
}));
