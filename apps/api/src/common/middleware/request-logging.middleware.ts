import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NextFunction, Response } from "express";
import type { ApiRequest } from "../request-context";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(request: ApiRequest, response: Response, next: NextFunction) {
    const startedAt = request.startedAt ?? Date.now();

    response.on("finish", () => {
      if (this.configService.get("REQUEST_LOGGING_ENABLED") === false) {
        return;
      }

      if (request.originalUrl?.endsWith("/api/health")) {
        return;
      }

      const durationMs = Date.now() - startedAt;
      const statusCode = response.statusCode;
      const level =
        statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

      const logLine = {
        ts: new Date().toISOString(),
        level,
        type: "http_request",
        requestId: request.requestId ?? null,
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode,
        durationMs,
        ip: request.ip,
        userAgent: request.headers["user-agent"] ?? null
      };

      console.log(JSON.stringify(logLine));
    });

    next();
  }
}
