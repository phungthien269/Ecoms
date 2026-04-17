import { Global, Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RateLimitGuard } from "./rate-limit.guard";
import { RateLimitService } from "./rate-limit.service";

@Global()
@Module({
  providers: [Reflector, RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard]
})
export class RateLimitModule {}
