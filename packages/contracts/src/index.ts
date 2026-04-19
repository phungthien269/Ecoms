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

export enum PaymentWebhookEvent {
  PAID = "PAID",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED"
}

export enum VoucherScope {
  PLATFORM = "PLATFORM",
  SHOP = "SHOP",
  FREESHIP = "FREESHIP"
}

export enum VoucherDiscountType {
  FIXED = "FIXED",
  PERCENTAGE = "PERCENTAGE"
}

export enum NotificationCategory {
  ORDER_STATUS = "ORDER_STATUS",
  CHAT = "CHAT",
  PROMOTION = "PROMOTION",
  REVIEW = "REVIEW",
  SYSTEM = "SYSTEM"
}

export enum ReportTargetType {
  PRODUCT = "PRODUCT",
  SHOP = "SHOP",
  REVIEW = "REVIEW"
}

export enum ReportStatus {
  OPEN = "OPEN",
  IN_REVIEW = "IN_REVIEW",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED"
}

export enum FileAssetStatus {
  PENDING = "PENDING",
  READY = "READY",
  FAILED = "FAILED"
}

export enum FlashSaleStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
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

export interface SavedAddressSummary extends CheckoutShippingAddress {
  id: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutShopVoucherInput {
  shopId: string;
  code: string;
}

export interface CheckoutVoucherSelection {
  platformCode?: string | null;
  freeshipCode?: string | null;
  shopCodes?: CheckoutShopVoucherInput[];
}

export interface AppliedVoucherSummary {
  id: string;
  code: string;
  name: string;
  scope: VoucherScope;
  discountAmount: string;
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
  appliedVouchers: AppliedVoucherSummary[];
}

export interface CheckoutPreview {
  paymentMethod: PaymentMethod;
  shippingAddress: CheckoutShippingAddress;
  vouchers: CheckoutVoucherSelection;
  shops: CheckoutShopPreview[];
  appliedVouchers: AppliedVoucherSummary[];
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

export interface OrderStatusTimelineEvent {
  id: string;
  status: OrderStatus;
  actorType: string;
  actorUser: {
    id: string;
    fullName: string;
    role: UserRole;
  } | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface OrderReturnWindowSummary {
  canRequest: boolean;
  deliveredAt: string | null;
  expiresAt: string | null;
}

export interface OrderAutoCompleteSummary {
  canAutoComplete: boolean;
  deliveredAt: string | null;
  autoCompleteAt: string | null;
  windowDays: number;
}

export interface PaymentEventSummary {
  id: string;
  eventType: string;
  source: string;
  actorType: string;
  actorUser: {
    id: string;
    fullName: string;
    role: UserRole;
  } | null;
  previousStatus: PaymentStatus | null;
  nextStatus: PaymentStatus;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaymentCheckoutArtifactSummary {
  provider: string;
  providerDisplayName: string | null;
  checkoutMode: "hosted_checkout" | "bank_transfer";
  paymentUrl: string | null;
  callbackUrl: string | null;
  sessionToken: string | null;
  qrPayload: string | null;
  merchantCode: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
}

export interface PaymentTraceSummary {
  payment: {
    id: string;
    orderId: string;
    orderNumber: string;
    orderStatus: OrderStatus;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: string;
    referenceCode: string;
    expiresAt: string | null;
    paidAt: string | null;
    metadata: Record<string, unknown> | null;
    checkoutArtifact: PaymentCheckoutArtifactSummary | null;
    createdAt: string;
    updatedAt: string;
  };
  events: PaymentEventSummary[];
}

export interface AdminPaymentSummary {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
  referenceCode: string;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    shop: {
      id: string;
      name: string;
      slug: string;
    };
  };
  recentEvents: PaymentEventSummary[];
}

export interface PaymentProviderDiagnosticsSummary {
  provider: string;
  displayName: string;
  mode: "mock_gateway" | "demo_gateway";
  configured: boolean;
  webhookMode: "internal_mock" | "provider_callback";
  supportsHostedCheckout: boolean;
  supportsBankTransfer: boolean;
  supportsWebhookReplay: boolean;
  merchantCode: string | null;
  baseUrl: string | null;
  actionHint: string;
}

export interface OrderShippingUpdateWindowSummary {
  canEdit: boolean;
  lockedReason: string | null;
}

export interface OrderShippingChangeField {
  key:
    | "recipientName"
    | "phoneNumber"
    | "addressLine1"
    | "addressLine2"
    | "ward"
    | "district"
    | "province"
    | "regionCode"
    | "note";
  label: string;
  previousValue: string | null;
  nextValue: string | null;
}

export interface OrderShippingUpdateSummary {
  updatedAt: string;
  actorType: string;
  actorUser: {
    id: string;
    fullName: string;
    role: UserRole;
  } | null;
  note: string | null;
  changedFields: OrderShippingChangeField[];
  previousAddress: Record<string, string | null>;
  nextAddress: Record<string, string | null>;
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
  status: "ok" | "degraded";
  timestamp: string;
  service: string;
}

export interface DependencyHealthEntry {
  key: string;
  label: string;
  status: "ok" | "degraded" | "fail";
  message: string;
  details?: Record<string, unknown>;
}

export interface ReadinessStatus {
  status: "ok" | "degraded" | "fail";
  timestamp: string;
  service: string;
  ready: boolean;
  checks: DependencyHealthEntry[];
}

export interface VoucherSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope: VoucherScope;
  discountType: VoucherDiscountType;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderValue: string | null;
  totalQuantity: number | null;
  usedCount: number;
  perUserUsageLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
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
  createdAt: string;
}

export interface FlashSaleItemSummary {
  flashPrice: string;
  stockLimit: number;
  soldCount: number;
  remainingStock: number;
  startsAt: string;
  endsAt: string;
  status: FlashSaleStatus;
}

export interface ProductFlashSaleSummary {
  id: string;
  flashSaleId: string;
  flashSaleName: string;
  flashPrice: string;
  originalSalePrice: string;
  stockLimit: number;
  soldCount: number;
  remainingStock: number;
  startsAt: string;
  endsAt: string;
  status: FlashSaleStatus;
}

export interface FlashSaleSummary {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  startsAt: string;
  endsAt: string;
  status: FlashSaleStatus;
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

export interface NotificationSummary {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ChatConversationSummary {
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

export interface ChatMessageSummary {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    fullName: string;
    role: UserRole;
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

export interface ReportSummary {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolvedNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface FileAssetSummary {
  id: string;
  driver: string;
  bucket: string | null;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number | null;
  url: string;
  status: FileAssetStatus;
  createdAt: string;
}

export interface FileUploadInstruction {
  strategy: "single_put" | "form_post";
  method: "PUT" | "POST";
  uploadUrl: string;
  publicUrl: string;
  headers?: Record<string, string>;
  fields?: Record<string, string>;
  expiresAt: string | null;
}

export interface FileUploadIntentSummary {
  asset: FileAssetSummary;
  upload: FileUploadInstruction;
}

export interface AuditLogSummary {
  id: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface SystemSettingSummary {
  key: string;
  category: string;
  label: string;
  description: string | null;
  valueType: "STRING" | "NUMBER" | "BOOLEAN";
  value: string | number | boolean;
  updatedAt: string | null;
  updatedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface PublicSystemSettingsSummary {
  marketplaceName: string;
  supportEmail: string;
  paymentTimeoutMinutes: number;
  orderAutoCompleteDays: number;
  paymentOnlineGatewayEnabled: boolean;
  paymentIncidentMessage: string | null;
}
