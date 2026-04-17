import { SetMetadata } from "@nestjs/common";

export interface RateLimitRule {
  name: string;
  maxRequests?: number;
  windowMs?: number;
}

export const RATE_LIMIT_RULE_KEY = "rate_limit_rule";

export const RateLimit = (rule: RateLimitRule) =>
  SetMetadata(RATE_LIMIT_RULE_KEY, rule);
