import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DeviceType } from '@prisma/client';

export class RegisterDeviceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(DeviceType)
  deviceType!: DeviceType;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  token!: string;
}
