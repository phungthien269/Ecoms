import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { Type } from "class-transformer";

export class ProductVariantInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  sku!: string;

  @IsObject()
  attributes!: Record<string, string>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
