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
