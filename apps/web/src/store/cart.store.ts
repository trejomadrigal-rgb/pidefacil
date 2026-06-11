import { create } from 'zustand';

export interface CartExtra {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  variantName?: string;
  name: string;
  imageUrl?: string;
  price: number;
  quantity: number;
  extras: CartExtra[];
  notes?: string;
}

interface CartStore {
  slug: string | null;
  items: CartItem[];
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (
    slug: string,
    item: Omit<CartItem, 'quantity'> & { quantity?: number },
  ) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}

function itemKey(productId: string, variantId?: string): string {
  return `${productId}:${variantId ?? ''}`;
}

export const useCartStore = create<CartStore>((set, get) => ({
  slug: null,
  items: [],
  isDrawerOpen: false,

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  addItem: (slug, item) => {
    const { slug: currentSlug, items } = get();
    const base: CartItem = { ...item, quantity: item.quantity ?? 1 };

    // If different business, reset cart
    if (currentSlug !== null && currentSlug !== slug) {
      set({ slug, items: [base] });
      return;
    }

    const key = itemKey(base.productId, base.variantId);
    const existing = items.find(
      (i) => itemKey(i.productId, i.variantId) === key,
    );

    if (existing) {
      set({
        slug,
        items: items.map((i) =>
          itemKey(i.productId, i.variantId) === key
            ? { ...i, quantity: i.quantity + base.quantity }
            : i,
        ),
      });
    } else {
      set({ slug, items: [...items, base] });
    }
  },

  removeItem: (productId, variantId) => {
    const key = itemKey(productId, variantId);
    set((state) => ({
      items: state.items.filter(
        (i) => itemKey(i.productId, i.variantId) !== key,
      ),
    }));
  },

  updateQuantity: (productId, variantId, quantity) => {
    const key = itemKey(productId, variantId);
    if (quantity <= 0) {
      get().removeItem(productId, variantId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        itemKey(i.productId, i.variantId) === key ? { ...i, quantity } : i,
      ),
    }));
  },

  clearCart: () => set({ slug: null, items: [], isDrawerOpen: false }),

  total: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  itemCount: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
