import { IsString } from "class-validator";

export class UpdateSystemSettingDto {
  @IsString()
  value!: string;
}
