import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ReportStatus } from "@ecoms/contracts";

export class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolvedNote?: string;
}
