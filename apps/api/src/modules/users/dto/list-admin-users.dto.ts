import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const manageableRoles = ["CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"] as const;

export class ListAdminUsersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(manageableRoles)
  role?: (typeof manageableRoles)[number];

  @IsOptional()
  @Transform(({ value }) =>
    value === "true" || value === true ? true : value === "false" || value === false ? false : undefined
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 12;
}
