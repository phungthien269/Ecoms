import { Global, Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MemoryRateLimitStore } from "./memory-rate-limit.store";
import { RateLimitGuard } from "./rate-limit.guard";
import { RateLimitService } from "./rate-limit.service";
import { RedisRateLimitStore } from "./redis-rate-limit.store";

@Global()
@Module({
  providers: [
    Reflector,
    MemoryRateLimitStore,
    RedisRateLimitStore,
    RateLimitService,
    RateLimitGuard
  ],
  exports: [RateLimitService, RateLimitGuard]
})
export class RateLimitModule {}
