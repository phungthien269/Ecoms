import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateOrderShippingDto {
  @IsString()
  @MaxLength(120)
  recipientName!: string;

  @IsString()
  @MaxLength(30)
  phoneNumber!: string;

  @IsString()
  @MaxLength(255)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ward?: string;

  @IsString()
  @MaxLength(120)
  district!: string;

  @IsString()
  @MaxLength(120)
  province!: string;

  @IsString()
  @MaxLength(20)
  regionCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
