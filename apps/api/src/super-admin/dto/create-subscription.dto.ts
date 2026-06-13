import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsString() @IsNotEmpty() businessId!: string;
  @IsString() @IsNotEmpty() planId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() @IsOptional() endDate?: string;
  @IsEnum(SubscriptionStatus) status!: SubscriptionStatus;
}
