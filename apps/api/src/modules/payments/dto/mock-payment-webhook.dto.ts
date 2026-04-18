import { PaymentWebhookEvent } from "@ecoms/contracts";
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateIf
} from "class-validator";

export class MockPaymentWebhookDto {
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

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
