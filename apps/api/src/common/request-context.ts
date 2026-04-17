import type { Request } from "express";

export interface ApiRequest extends Request {
  requestId?: string;
  startedAt?: number;
}
