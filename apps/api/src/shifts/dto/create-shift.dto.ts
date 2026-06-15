import { IsString, IsOptional } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  deliveryUserId!: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
