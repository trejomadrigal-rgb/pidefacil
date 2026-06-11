import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TrustLevel } from '@prisma/client';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(TrustLevel)
  trustLevel?: TrustLevel;
}
