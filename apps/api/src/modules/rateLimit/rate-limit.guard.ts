import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import type { AuthPayload } from "../auth/types/auth-payload";
import type { ApiRequest } from "../../common/request-context";
import {
  RATE_LIMIT_RULE_KEY,
  type RateLimitRule
} from "./rate-limit.decorator";
import { RateLimitService } from "./rate-limit.service";

type ResolvedRateLimitRule = RateLimitRule & {
  maxRequests: number;
  windowMs: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext) {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(
      RATE_LIMIT_RULE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!rule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequest & { user?: AuthPayload }>();
    const response = context.switchToHttp().getResponse<Response>();
    const identity = request.user?.sub ?? request.ip ?? "anonymous";
    const key = `${rule.name}:${identity}`;
    const resolvedRule = this.resolveRule(rule);
    const result = await this.rateLimitService.consume(
      key,
      resolvedRule.maxRequests,
      resolvedRule.windowMs
    );

    response.setHeader("x-ratelimit-limit", String(result.limit));
    response.setHeader("x-ratelimit-remaining", String(result.remaining));
    response.setHeader("x-ratelimit-reset", new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private resolveRule(rule: RateLimitRule): ResolvedRateLimitRule {
    if (rule.windowMs !== undefined && rule.maxRequests !== undefined) {
      return {
        ...rule,
        windowMs: rule.windowMs,
        maxRequests: rule.maxRequests
      };
    }

    if (rule.name.startsWith("auth.")) {
      return {
        ...rule,
        windowMs:
          rule.windowMs ??
          this.configService.get<number>("AUTH_RATE_LIMIT_WINDOW_MS", 60_000),
        maxRequests:
          rule.maxRequests ??
          this.configService.get<number>("AUTH_RATE_LIMIT_MAX", 10)
      };
    }

    if (rule.name.startsWith("reports.")) {
      return {
        ...rule,
        windowMs:
          rule.windowMs ??
          this.configService.get<number>("REPORT_RATE_LIMIT_WINDOW_MS", 60_000),
        maxRequests:
          rule.maxRequests ??
          this.configService.get<number>("REPORT_RATE_LIMIT_MAX", 6)
      };
    }

    if (rule.name.startsWith("chat.")) {
      return {
        ...rule,
        windowMs:
          rule.windowMs ??
          this.configService.get<number>("CHAT_RATE_LIMIT_WINDOW_MS", 60_000),
        maxRequests:
          rule.maxRequests ??
          this.configService.get<number>("CHAT_RATE_LIMIT_MAX", 30)
      };
    }

    if (rule.name.startsWith("files.")) {
      return {
        ...rule,
        windowMs:
          rule.windowMs ??
          this.configService.get<number>("FILE_RATE_LIMIT_WINDOW_MS", 60_000),
        maxRequests:
          rule.maxRequests ??
          this.configService.get<number>("FILE_RATE_LIMIT_MAX", 20)
      };
    }

    return {
      ...rule,
      windowMs: rule.windowMs ?? 60_000,
      maxRequests: rule.maxRequests ?? 20
    };
  }
}
