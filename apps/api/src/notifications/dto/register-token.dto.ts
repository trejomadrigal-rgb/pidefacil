import { IsEnum, IsString } from 'class-validator';
import { Platform } from '@prisma/client';

export class RegisterTokenDto {
  @IsString()
  token!: string;

  @IsEnum(Platform)
  platform!: Platform;
}
