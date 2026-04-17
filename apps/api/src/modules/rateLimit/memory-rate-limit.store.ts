import { Injectable } from "@nestjs/common";
import type { RateLimitResult, RateLimitStore } from "./rate-limit.types";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();

  async consume(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
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
