import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min
} from "class-validator";
import { VoucherDiscountType } from "@ecoms/contracts";

export class CreateShopVoucherDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(VoucherDiscountType)
  discountType!: VoucherDiscountType;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  discountValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  maxDiscountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  totalQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  perUserUsageLimit?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
