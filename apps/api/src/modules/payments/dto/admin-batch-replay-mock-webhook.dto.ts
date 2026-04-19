import { PaymentWebhookEvent } from "@ecoms/contracts";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class AdminBatchReplayMockWebhookDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  paymentIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  referenceCodes?: string[];

  @IsEnum(PaymentWebhookEvent)
  event!: PaymentWebhookEvent;

  @IsOptional()
  @IsString()
  providerReferencePrefix?: string;
}
