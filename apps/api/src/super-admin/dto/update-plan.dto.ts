import { IsString, IsNotEmpty, IsNumber, IsInt, Min, IsOptional } from 'class-validator';

export class UpdatePlanDto {
  @IsString() @IsNotEmpty() @IsOptional() name?: string;
  @IsNumber() @Min(0) @IsOptional() monthlyPrice?: number;
  @IsInt() @Min(1) @IsOptional() maxUsers?: number;
  @IsInt() @Min(1) @IsOptional() maxProducts?: number;
  @IsInt() @Min(1) @IsOptional() maxBranches?: number;
}
