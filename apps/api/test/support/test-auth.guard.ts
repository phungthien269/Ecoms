import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { UserRole } from "@ecoms/contracts";
import type { AuthPayload } from "../../src/modules/auth/types/auth-payload";

@Injectable()
export class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthPayload;
    }>();
    const userId = this.readHeader(request.headers, "x-test-user-id");

    if (!userId) {
      throw new UnauthorizedException("Missing test user");
    }

    request.user = {
      sub: userId,
      email: this.readHeader(request.headers, "x-test-user-email") ?? `${userId}@test.local`,
      role: this.parseRole(this.readHeader(request.headers, "x-test-user-role"))
    };

    return true;
  }

  private parseRole(role: string | undefined) {
    if (!role) {
      return UserRole.CUSTOMER;
    }

    return Object.values(UserRole).includes(role as UserRole)
      ? (role as UserRole)
      : UserRole.CUSTOMER;
  }

  private readHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string
  ) {
    const value = headers[name];
    if (typeof value === "string") {
      return value;
    }

    return value?.[0];
  }
}
