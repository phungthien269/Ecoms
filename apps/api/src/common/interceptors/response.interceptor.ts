import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { map, Observable } from "rxjs";
import { toSuccessResponse } from "../api-response";
import type { ApiRequest } from "../request-context";

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ReturnType<typeof toSuccessResponse<T>>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ReturnType<typeof toSuccessResponse<T>>> {
    const request = context.switchToHttp().getRequest<ApiRequest>();

    return next.handle().pipe(
      map((data) =>
        toSuccessResponse(data, {
          requestId: request.requestId ?? null
        })
      )
    );
  }
}
