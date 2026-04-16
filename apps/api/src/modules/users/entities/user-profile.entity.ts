import type { UserRole } from "@ecoms/contracts";

export interface UserProfileEntity {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: UserRole;
}
