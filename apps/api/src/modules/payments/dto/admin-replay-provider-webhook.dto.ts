import { PaymentWebhookEvent } from "@ecoms/contracts";
import { IsEnum, IsOptional, IsString, ValidateIf } from "class-validator";

export class AdminReplayProviderWebhookDto {
  @ValidateIf((value) => !value.referenceCode)
  @IsString()
  paymentId?: string;

  @ValidateIf((value) => !value.paymentId)
  @IsString()
  referenceCode?: string;

  @IsEnum(PaymentWebhookEvent)
  event!: PaymentWebhookEvent;

  @IsOptional()
  @IsString()
  providerReference?: string;
}
