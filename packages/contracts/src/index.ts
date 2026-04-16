export enum UserRole {
  GUEST = "GUEST",
  CUSTOMER = "CUSTOMER",
  SELLER = "SELLER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN"
}

export enum ShopStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED"
}

export enum ProductStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  BANNED = "BANNED"
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  SHIPPING = "SHIPPING",
  DELIVERED = "DELIVERED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  DELIVERY_FAILED = "DELIVERY_FAILED",
  RETURN_REQUESTED = "RETURN_REQUESTED",
  RETURNED = "RETURNED",
  REFUNDED = "REFUNDED"
}

export enum PaymentMethod {
  COD = "COD",
  BANK_TRANSFER = "BANK_TRANSFER",
  ONLINE_GATEWAY = "ONLINE_GATEWAY"
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED"
}

export interface ProductReviewSummary {
  id: string;
  reviewer: {
    id: string;
    fullName: string;
  };
  rating: number;
  comment: string;
  imageUrls: string[];
  sellerReply: string | null;
  sellerReplyAt: string | null;
  createdAt: string;
}

export interface CartItemSummary {
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
}

export interface CartShopGroup {
  shop: {
    id: string;
    name: string;
    slug: string;
  };
  items: CartItemSummary[];
  subtotal: string;
}

export interface CartSummary {
  shops: CartShopGroup[];
  totals: {
    itemCount: number;
    subtotal: string;
  };
}

export interface CheckoutShippingAddress {
  recipientName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string | null;
  ward?: string | null;
  district: string;
  province: string;
  regionCode: string;
}

export interface CheckoutShopPreview {
  shop: {
    id: string;
    name: string;
    slug: string;
  };
  itemsSubtotal: string;
  shippingFee: string;
  discountTotal: string;
  grandTotal: string;
}

export interface CheckoutPreview {
  paymentMethod: PaymentMethod;
  shippingAddress: CheckoutShippingAddress;
  shops: CheckoutShopPreview[];
  totals: {
    itemCount: number;
    itemsSubtotal: string;
    shippingFee: string;
    discountTotal: string;
    grandTotal: string;
  };
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  shopId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  itemsSubtotal: string;
  shippingFee: string;
  discountTotal: string;
  grandTotal: string;
  placedAt: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthStatus {
  status: "ok";
  timestamp: string;
  service: string;
}
