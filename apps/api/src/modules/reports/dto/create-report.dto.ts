import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ReportTargetType } from "@ecoms/contracts";

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsString()
  targetId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
