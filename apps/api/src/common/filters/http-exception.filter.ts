import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { Response } from "express";
import { toErrorResponse } from "../api-response";
import type { ApiRequest } from "../request-context";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<ApiRequest>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttpException
      ? exception.message
      : "Internal server error";

    response.status(status).json({
      ...toErrorResponse(
        isHttpException ? "HTTP_ERROR" : "INTERNAL_SERVER_ERROR",
        message,
        isHttpException ? exception.getResponse() : undefined
      ),
      path: request.url,
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString()
    });
  }
}
