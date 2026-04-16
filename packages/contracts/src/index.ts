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
