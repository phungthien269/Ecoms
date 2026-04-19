import { IsString, ValidateIf } from "class-validator";

export class PaymentTraceQueryDto {
  @ValidateIf((value) => !value.referenceCode)
  @IsString()
  paymentId?: string;

  @ValidateIf((value) => !value.paymentId)
  @IsString()
  referenceCode?: string;
}
