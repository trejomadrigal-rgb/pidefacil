import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeviceStatus } from '@prisma/client';

export class UpdateDeviceDto {
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  branchId?: string;
}
