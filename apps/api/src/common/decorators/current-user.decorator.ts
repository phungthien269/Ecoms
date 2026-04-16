import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthPayload } from "../../modules/auth/types/auth-payload";

export const CurrentUser = createParamDecorator(
  (field: keyof AuthPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthPayload }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return field ? user[field] : user;
  }
);
