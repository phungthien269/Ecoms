import { Injectable } from "@nestjs/common";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly store = new Map<string, RateLimitEntry>();

  consume(key: string, maxRequests: number, windowMs: number) {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      const entry = {
        count: 1,
        resetAt
      };
      this.store.set(key, entry);
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - entry.count),
        limit: maxRequests,
        resetAt
      };
    }

    existing.count += 1;
    this.store.set(key, existing);

    return {
      allowed: existing.count <= maxRequests,
      remaining: Math.max(0, maxRequests - existing.count),
      limit: maxRequests,
      resetAt: existing.resetAt
    };
  }
}
