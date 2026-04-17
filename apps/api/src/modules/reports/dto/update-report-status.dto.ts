import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { ReportStatus } from "@ecoms/contracts";

export enum ReportModerationAction {
  NONE = "NONE",
  BAN_PRODUCT = "BAN_PRODUCT",
  ACTIVATE_PRODUCT = "ACTIVATE_PRODUCT",
  SUSPEND_SHOP = "SUSPEND_SHOP",
  ACTIVATE_SHOP = "ACTIVATE_SHOP"
}

const REPORT_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
const REPORT_MODERATION_ACTIONS = [
  ReportModerationAction.NONE,
  ReportModerationAction.BAN_PRODUCT,
  ReportModerationAction.ACTIVATE_PRODUCT,
  ReportModerationAction.SUSPEND_SHOP,
  ReportModerationAction.ACTIVATE_SHOP
] as const;

export class UpdateReportStatusDto {
  @IsIn(REPORT_STATUSES)
  status!: ReportStatus;

  @IsOptional()
  @IsIn(REPORT_MODERATION_ACTIONS)
  moderationAction?: ReportModerationAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolvedNote?: string;
}
