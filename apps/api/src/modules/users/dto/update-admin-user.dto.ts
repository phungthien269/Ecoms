import { IsBoolean, IsIn, IsOptional } from "class-validator";

const manageableRoles = ["CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"] as const;

export class UpdateAdminUserDto {
  @IsOptional()
  @IsIn(manageableRoles)
  role?: (typeof manageableRoles)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
