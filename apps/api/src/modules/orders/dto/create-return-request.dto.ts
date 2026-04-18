import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateReturnRequestDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
