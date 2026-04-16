import type { ApiErrorResponse, ApiSuccessResponse } from "@ecoms/contracts";

export function toSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta
  };
}

export function toErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
}
