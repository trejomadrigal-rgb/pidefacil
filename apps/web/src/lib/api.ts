const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface BusinessPublic {
  id: string;
  name: string;
  slug: string;
  description?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
}

export interface ProductExtra {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isFeatured: boolean;
  isAvailable: boolean;
  variants: ProductVariant[];
  extras: ProductExtra[];
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  products: Product[];
}

export interface MenuPublic {
  business: BusinessPublic;
  categories: Category[];
}

export interface CreateOrderItem {
  productId: string;
  variantId?: string;
  extraIds?: string[];
  quantity: number;
  notes?: string;
}

export interface CreateOrderPayload {
  businessId: string;
  branchId?: string | null;
  customer: { name: string; phone: string };
  deliveryType: 'PICKUP' | 'DELIVERY';
  address?: { street: string; references?: string };
  notes?: string;
  deliveryNotes?: string;
  items: CreateOrderItem[];
}

export interface OrderCreatedResponse {
  id: string;
  orderNumber: string;
  status: string;
}

export interface MyOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  itemCount: number;
}

export interface OrderStatusResponse {
  orderNumber: string;
  status: string;
  total: number;
  deliveryType: string;
  items: { name: string; quantity: number; subtotal: number }[];
  createdAt: string;
}

// GET /public/business/:slug — returns BusinessPublic directly
export async function getBusiness(slug: string): Promise<BusinessPublic | null> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// GET /public/business/:slug/categories — returns Category[] directly
export async function getCategories(slug: string): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}/categories`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// Convenience: fetch both business + categories in parallel and combine
export async function getBusinessMenu(slug: string): Promise<MenuPublic | null> {
  try {
    const [business, categories] = await Promise.all([
      getBusiness(slug),
      getCategories(slug),
    ]);
    if (!business) return null;
    return { business, categories };
  } catch {
    return null;
  }
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<OrderCreatedResponse> {
  const res = await fetch(`${API_URL}/public/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) {
    throw new Error('RATE_LIMIT');
  }
  if (!res.ok) {
    throw new Error('ORDER_FAILED');
  }
  return res.json();
}

export async function getMyOrders(slug: string, phone: string): Promise<MyOrder[]> {
  try {
    const res = await fetch(
      `${API_URL}/public/business/${slug}/my-orders?phone=${encodeURIComponent(phone)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getOrderStatus(
  slug: string,
  orderNumber: string,
): Promise<OrderStatusResponse | null> {
  try {
    const res = await fetch(
      `${API_URL}/public/business/${slug}/orders/${orderNumber}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface PublicBranch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
}

export async function getPublicBranches(slug: string): Promise<PublicBranch[]> {
  try {
    const res = await fetch(`${API_URL}/public/business/${slug}/branches`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortBranchesByDistance(
  branches: PublicBranch[],
  userLat: number,
  userLon: number,
): (PublicBranch & { distanceKm: number })[] {
  return branches
    .map((b) => ({ ...b, distanceKm: haversineDistance(userLat, userLon, b.latitude, b.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
