import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { ProductStatus } from "@ecoms/contracts";
import { ProductImageInputDto } from "./product-image-input.dto";

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  sku!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  originalPrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  salePrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lengthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  widthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  heightCm?: number;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];
}
