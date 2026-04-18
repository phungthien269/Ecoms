import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import { requestContextStorage, type ApiRequest } from "../request-context";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: ApiRequest, response: Response, next: NextFunction) {
    const requestId = this.getRequestId(request.headers["x-request-id"]);
    request.requestId = requestId;
    request.startedAt = Date.now();
    response.setHeader("x-request-id", requestId);
    requestContextStorage.run({ requestId }, () => next());
  }

  private getRequestId(headerValue: string | string[] | undefined) {
    if (typeof headerValue === "string" && headerValue.trim()) {
      return headerValue.trim().slice(0, 100);
    }

    if (Array.isArray(headerValue) && headerValue[0]?.trim()) {
      return headerValue[0].trim().slice(0, 100);
    }

    return randomUUID();
  }
}
