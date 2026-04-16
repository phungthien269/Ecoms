import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateReviewDto {
  @IsString()
  orderItemId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MaxLength(1000)
  comment!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
