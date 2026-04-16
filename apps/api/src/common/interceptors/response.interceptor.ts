import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { map, Observable } from "rxjs";
import { toSuccessResponse } from "../api-response";

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ReturnType<typeof toSuccessResponse<T>>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ReturnType<typeof toSuccessResponse<T>>> {
    return next.handle().pipe(map((data) => toSuccessResponse(data)));
  }
}
