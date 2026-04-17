import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateUploadIntentDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  folder?: string;
}
