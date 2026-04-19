import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class SendTestEmailDto {
  @IsEmail()
  recipientEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;
}
