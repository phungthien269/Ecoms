import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf
} from "class-validator";

export class ProductImageInputDto {
  @ValidateIf((value: ProductImageInputDto) => !value.fileAssetId)
  @IsUrl()
  url?: string;

  @ValidateIf((value: ProductImageInputDto) => !value.url)
  @IsString()
  fileAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
