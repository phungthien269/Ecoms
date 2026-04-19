import { IsEnum, IsISO8601, IsString } from "class-validator";

export enum DemoGatewayWebhookStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED"
}

export class DemoGatewayWebhookDto {
  @IsString()
  merchantCode!: string;

  @IsString()
  referenceCode!: string;

  @IsEnum(DemoGatewayWebhookStatus)
  status!: DemoGatewayWebhookStatus;

  @IsString()
  providerReference!: string;

  @IsISO8601()
  occurredAt!: string;
}
