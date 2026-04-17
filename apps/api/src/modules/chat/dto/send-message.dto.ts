import { IsOptional, IsString, MaxLength } from "class-validator";

export class SendMessageDto {
  @IsString()
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageFileAssetId?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}
