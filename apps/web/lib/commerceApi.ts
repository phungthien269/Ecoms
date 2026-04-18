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
  vouchers: {
    platformCode?: string | null;
    freeshipCode?: string | null;
    shopCodes?: Array<{
      shopId: string;
      code: string;
    }>;
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
    appliedVouchers: AppliedVoucherSummary[];
  }>;
  appliedVouchers: AppliedVoucherSummary[];
  totals: {
    itemCount: number;
    itemsSubtotal: string;
    shippingFee: string;
    discountTotal: string;
    grandTotal: string;
  };
}

export interface SavedAddressItem {
  id: string;
  label: string;
  recipientName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string | null;
  ward: string | null;
  district: string;
  province: string;
  regionCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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
  appliedVoucherCodes: string[];
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
  appliedVoucherCodes: string[];
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
  statusTimeline: Array<{
    id: string;
    status: string;
    actorType: string;
    actorUser: {
      id: string;
      fullName: string;
      role: string;
    } | null;
    note: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  returnWindow: {
    canRequest: boolean;
    deliveredAt: string | null;
    expiresAt: string | null;
  };
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

export interface SellerReviewItem {
  id: string;
  rating: number;
  comment: string;
  imageUrls: string[];
  sellerReply: string | null;
  sellerReplyAt: string | null;
  createdAt: string;
  reviewer: {
    id: string;
    fullName: string;
    email: string;
  };
  product: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface SellerFileAssetItem {
  id: string;
  driver: string;
  bucket: string | null;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number | null;
  url: string;
  status: string;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Array<{
    id: string;
    category: string;
    title: string;
    body: string;
    linkUrl: string | null;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
}

export interface ChatConversationItem {
  id: string;
  buyer: {
    id: string;
    fullName: string;
    email: string;
  };
  shop: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
  };
  product: {
    id: string;
    name: string;
    slug: string;
  } | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  isCounterpartOnline: boolean;
  unreadCount: number;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    fullName: string;
    role: string;
  };
  content: string;
  imageUrl: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
  } | null;
  createdAt: string;
}

export interface AdminDashboardData {
  stats: {
    totalUsers: number;
    totalSellers: number;
    totalAdmins: number;
    inactiveUsers: number;
    totalShops: number;
    pendingShops: number;
    totalProducts: number;
    activeProducts: number;
    bannedProducts: number;
    totalOrders: number;
    pendingPayments: number;
    totalFlashSales: number;
    activeFlashSales: number;
    totalBanners: number;
    activeBanners: number;
    totalReports: number;
    openReports: number;
    totalReviews: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    grandTotal: string;
    createdAt: string;
    user: {
      id: string;
      fullName: string;
      email: string;
    };
    shop: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  shopsNeedingReview: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    owner: {
      id: string;
      fullName: string;
      email: string;
    };
  }>;
  productsNeedingReview: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    status: string;
    salePrice: string;
    createdAt: string;
    shop: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
}

export interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
}

export interface SystemDiagnosticsData {
  status: "ok" | "degraded" | "fail";
  timestamp: string;
  service: string;
  ready: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "degraded" | "fail";
    message: string;
    details?: Record<string, unknown>;
  }>;
}

export interface AdminReviewItem {
  id: string;
  rating: number;
  comment: string;
  imageUrls: string[];
  sellerReply: string | null;
  sellerReplyAt: string | null;
  createdAt: string;
  reviewer: {
    id: string;
    fullName: string;
    email: string;
  };
  product: {
    id: string;
    name: string;
    slug: string;
    shop: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

export interface AdminShopItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export interface AdminProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: string;
  salePrice: string;
  stock: number;
  shop: {
    id: string;
    name: string;
    status: string;
  };
  category: {
    id: string;
    name: string;
  };
  brand: {
    id: string;
    name: string;
  } | null;
}

export interface AdminCategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
}

export interface AdminBrandItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt?: string;
}

export interface AdminOrderItem {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  itemsSubtotal: string;
  shippingFee: string;
  discountTotal: string;
  grandTotal: string;
  appliedVoucherCodes: string[];
  placedAt: string;
  customer: {
    id: string;
    fullName: string;
    email: string;
  };
  shop: {
    id: string;
    name: string;
    slug: string;
    status: string;
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

export interface VoucherSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: string;
  discountType: string;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderValue: string | null;
  totalQuantity: number | null;
  usedCount: number;
  perUserUsageLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  shop: {
    id: string;
    name: string;
    slug: string;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface FlashSaleSummary {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productSlug: string;
    flashPrice: string;
    originalSalePrice: string;
    stockLimit: number;
    soldCount: number;
    remainingStock: number;
    imageUrl: string | null;
  }>;
}

export interface AdminReportItem {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  resolvedNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: {
    id: string;
    fullName: string;
    email: string;
  };
  resolvedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  target:
    | {
        id: string;
        name?: string;
        slug?: string;
        status?: string;
        ownerId?: string;
        comment?: string;
        product?: {
          id: string;
          name: string;
          slug: string;
        };
      }
    | null;
}

export interface AdminBannerItem {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppliedVoucherSummary {
  id: string;
  code: string;
  name: string;
  scope: string;
  discountAmount: string;
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

export async function getAddresses() {
  return (await requestAuthedJson<SavedAddressItem[]>("/addresses")) ?? [];
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
        description: string;
        categoryId: string;
        brandId: string | null;
        status: string;
        originalPrice: string;
        salePrice: string;
        stock: number;
        weightGrams: number | null;
        tags: string[];
        images: Array<{ id: string; url: string }>;
        variants: Array<{
          id: string;
          sku: string;
          name: string;
          stock: number;
          price: string | null;
        }>;
      }>
    >("/products/me")) ?? []
  );
}

export async function getSellerFiles() {
  return (await requestAuthedJson<SellerFileAssetItem[]>("/files/me")) ?? [];
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

export async function getSellerReviews() {
  return (await requestAuthedJson<SellerReviewItem[]>("/reviews/seller/me")) ?? [];
}

export async function getAdminDashboard() {
  return requestAuthedJson<AdminDashboardData>("/admin/dashboard");
}

export async function getAdminUsers() {
  return (await requestAuthedJson<AdminUserItem[]>("/users/admin")) ?? [];
}

export async function getSystemDiagnostics() {
  return requestAuthedJson<SystemDiagnosticsData>("/health/diagnostics");
}

export async function getAdminReviews() {
  return (await requestAuthedJson<AdminReviewItem[]>("/reviews/admin")) ?? [];
}

export async function getAdminShops() {
  return (await requestAuthedJson<AdminShopItem[]>("/shops/admin")) ?? [];
}

export async function getAdminProducts() {
  return (await requestAuthedJson<AdminProductItem[]>("/products/admin")) ?? [];
}

export async function getAdminCategories() {
  return (await requestAuthedJson<AdminCategoryItem[]>("/categories/admin")) ?? [];
}

export async function getAdminBrands() {
  return (await requestAuthedJson<AdminBrandItem[]>("/brands")) ?? [];
}

export async function getAdminOrders() {
  return (await requestAuthedJson<AdminOrderItem[]>("/orders/admin")) ?? [];
}

export async function getAdminVouchers() {
  return (await requestAuthedJson<VoucherSummary[]>("/vouchers/admin")) ?? [];
}

export async function getAdminFlashSales() {
  return (await requestAuthedJson<FlashSaleSummary[]>("/flash-sales/admin")) ?? [];
}

export async function getAdminReports() {
  return (await requestAuthedJson<AdminReportItem[]>("/reports/admin")) ?? [];
}

export async function getAdminBanners() {
  return (await requestAuthedJson<AdminBannerItem[]>("/banners/admin")) ?? [];
}

export async function getSellerVouchers() {
  return (await requestAuthedJson<VoucherSummary[]>("/vouchers/shop/me")) ?? [];
}

export async function getCheckoutPlatformVouchers() {
  return (await requestAuthedJson<VoucherSummary[]>("/vouchers/checkout/platform")) ?? [];
}

export async function getCheckoutFreeshipVouchers() {
  return (await requestAuthedJson<VoucherSummary[]>("/vouchers/checkout/freeship")) ?? [];
}

export async function getNotifications() {
  return (
    (await requestAuthedJson<NotificationsResponse>("/notifications")) ?? {
      items: [],
      unreadCount: 0
    }
  );
}

export async function getChatConversations() {
  return (await requestAuthedJson<ChatConversationItem[]>("/chat/conversations")) ?? [];
}

export async function getChatMessages(conversationId: string) {
  return (
    (await requestAuthedJson<ChatMessageItem[]>(
      `/chat/conversations/${conversationId}/messages`
    )) ?? []
  );
}
