export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export interface RateLimitStore {
  consume(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
}
