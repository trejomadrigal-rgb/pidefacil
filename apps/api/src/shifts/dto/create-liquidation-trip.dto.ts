import { IsArray, IsString, ArrayMinSize, IsOptional } from 'class-validator';

export class CreateLiquidationTripDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds!: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
