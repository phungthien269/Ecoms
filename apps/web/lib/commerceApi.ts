import { getDemoSession } from "./session";
import type { ApiEnvelope } from "./storefrontTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface CartSummary {
  shops: Array<{
    shop: {
      id: string;
      name: string;
      slug: string;
    };
    items: Array<{
      id: string;
      productId: string;
      productVariantId: string | null;
      quantity: number;
      unitPrice: string;
      subtotal: string;
      product: {
        id: string;
        name: string;
        slug: string;
        status: string;
        imageUrl: string | null;
        stock: number;
      };
      variant: {
        id: string;
        sku: string;
        name: string;
        attributes: Record<string, string>;
        stock: number;
      } | null;
    }>;
    subtotal: string;
  }>;
  totals: {
    itemCount: number;
    subtotal: string;
  };
}

export interface CheckoutPreview {
  paymentMethod: string;
  shippingAddress: {
    recipientName: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2: string | null;
    ward: string | null;
    district: string;
    province: string;
    regionCode: string;
  };
  shops: Array<{
    shop: {
      id: string;
      name: string;
      slug: string;
    };
    itemsSubtotal: string;
    shippingFee: string;
    discountTotal: string;
    grandTotal: string;
  }>;
  totals: {
    itemCount: number;
    itemsSubtotal: string;
    shippingFee: string;
    discountTotal: string;
    grandTotal: string;
  };
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  itemsSubtotal: string;
  shippingFee: string;
  discountTotal: string;
  grandTotal: string;
  placedAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
  };
  payments: Array<{
    id: string;
    method: string;
    status: string;
    amount: string;
    referenceCode: string;
    expiresAt: string | null;
  }>;
}

export interface OrderDetail extends OrderListItem {
  shippingAddress: {
    recipientName: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2: string | null;
    ward: string | null;
    district: string;
    province: string;
    regionCode: string;
  };
  note: string | null;
  totals: {
    itemsSubtotal: string;
    shippingFee: string;
    discountTotal: string;
    grandTotal: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productVariantId: string | null;
    productName: string;
    productSlug: string;
    productSku: string;
    variantName: string | null;
    variantSku: string | null;
    variantAttributes: Record<string, string> | null;
    quantity: number;
    reviewId?: string | null;
    unitPrice: string;
    subtotal: string;
  }>;
  payments: Array<{
    id: string;
    method: string;
    status: string;
    amount: string;
    referenceCode: string;
    expiresAt: string | null;
    paidAt: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

export interface SellerOrderListItem extends OrderListItem {
  customer: {
    id: string;
    fullName: string;
    email: string;
  };
  items: Array<{
    id: string;
    productName: string;
    productSlug: string;
    variantName: string | null;
    quantity: number;
    subtotal: string;
  }>;
}

export interface SellerOrderDetail extends Omit<OrderDetail, "shop"> {
  customer: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
  };
  shop: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}

export interface WishlistItem {
  id: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    salePrice: string;
    originalPrice: string;
    ratingAverage: string;
    soldCount: number;
    imageUrl: string | null;
    shop: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

async function requestAuthedJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const session = await getDemoSession();
  if (!session) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.accessToken}`,
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ApiEnvelope<T>;
    return payload.data;
  } catch {
    return null;
  }
}

export async function getCart() {
  return requestAuthedJson<CartSummary>("/cart");
}

export async function getOrders() {
  return (await requestAuthedJson<OrderListItem[]>("/orders")) ?? [];
}

export async function getOrder(orderId: string) {
  return requestAuthedJson<OrderDetail>(`/orders/${orderId}`);
}

export async function getCheckoutPreview(previewPayload: Record<string, unknown>) {
  return requestAuthedJson<CheckoutPreview>("/checkout/preview", {
    method: "POST",
    body: JSON.stringify(previewPayload)
  });
}

export async function getSellerShop() {
  return requestAuthedJson<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    status: string;
    owner: {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };
  }>("/shops/me");
}

export async function getSellerProducts() {
  return (
    (await requestAuthedJson<
      Array<{
        id: string;
        name: string;
        slug: string;
        sku: string;
        status: string;
        salePrice: string;
        stock: number;
        images: Array<{ id: string; url: string }>;
        variants: Array<{ id: string; name: string; stock: number }>;
      }>
    >("/products/me")) ?? []
  );
}

export async function getSellerOrders() {
  return (await requestAuthedJson<SellerOrderListItem[]>("/orders/seller/me")) ?? [];
}

export async function getSellerOrder(orderId: string) {
  return requestAuthedJson<SellerOrderDetail>(`/orders/seller/me/${orderId}`);
}

export async function getWishlist() {
  return (await requestAuthedJson<WishlistItem[]>("/wishlist")) ?? [];
}
