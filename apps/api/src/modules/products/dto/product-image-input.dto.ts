import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from "class-validator";

export class ProductImageInputDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
