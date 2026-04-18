import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

export interface ApiRequest extends Request {
  requestId?: string;
  startedAt?: number;
}

export interface RequestContextState {
  requestId: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

export function getRequestContext() {
  return requestContextStorage.getStore() ?? null;
}

export function getRequestId() {
  return getRequestContext()?.requestId ?? null;
}
