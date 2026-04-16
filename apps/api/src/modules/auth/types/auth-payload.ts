import type { UserRole } from "@ecoms/contracts";

export interface AuthPayload {
  sub: string;
  email: string;
  role: UserRole;
}
