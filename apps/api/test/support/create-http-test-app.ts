import { ValidationPipe, type Provider, type Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { ResponseInterceptor } from "../../src/common/interceptors/response.interceptor";
import { RequestContextMiddleware } from "../../src/common/middleware/request-context.middleware";
import { JwtAuthGuard } from "../../src/common/guards/jwt-auth.guard";
import { MemoryRateLimitStore } from "../../src/modules/rateLimit/memory-rate-limit.store";
import { RateLimitGuard } from "../../src/modules/rateLimit/rate-limit.guard";
import { RedisRateLimitStore } from "../../src/modules/rateLimit/redis-rate-limit.store";
import { RateLimitService } from "../../src/modules/rateLimit/rate-limit.service";
import { RolesGuard } from "../../src/modules/rbac/guards/roles.guard";
import { TestJwtAuthGuard } from "./test-auth.guard";

interface CreateHttpTestAppOptions {
  controllers: Type<unknown>[];
  providers: Provider[];
  configValues?: Record<string, number | string | boolean>;
}

export async function createHttpTestApp({
  controllers,
  providers,
  configValues
}: CreateHttpTestAppOptions): Promise<INestApplication> {
  const moduleBuilder = Test.createTestingModule({
    controllers,
    providers: [
      ...providers,
      Reflector,
      RolesGuard,
      MemoryRateLimitStore,
      RedisRateLimitStore,
      RateLimitGuard,
      RateLimitService,
      ResponseInterceptor,
      HttpExceptionFilter,
      RequestContextMiddleware,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback?: unknown) => configValues?.[key] ?? fallback
        }
      }
    ]
  })
    .overrideGuard(JwtAuthGuard)
    .useClass(TestJwtAuthGuard);

  const moduleRef = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  const requestContextMiddleware = app.get(RequestContextMiddleware);

  app.setGlobalPrefix("api");
  app.use((request, response, next) => requestContextMiddleware.use(request, response, next));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true
    })
  );
  app.useGlobalFilters(app.get(HttpExceptionFilter));
  app.useGlobalInterceptors(app.get(ResponseInterceptor));

  await app.init();
  return app;
}
