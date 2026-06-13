import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class UpdateSubscriptionDto {
  @IsString() @IsOptional() planId?: string;
  @IsDateString() @IsOptional() startDate?: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsEnum(SubscriptionStatus) @IsOptional() status?: SubscriptionStatus;
}
