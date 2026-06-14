import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLiquidationDto {
  @IsString()
  branchId!: string;

  @IsString()
  receivedById!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
