import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateConversationDto {
  @IsString()
  shopId!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  initialMessage?: string;
}
