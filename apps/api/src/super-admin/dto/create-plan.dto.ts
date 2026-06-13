import { IsString, IsNotEmpty, IsNumber, IsInt, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() @Min(0) monthlyPrice!: number;
  @IsInt() @Min(1) maxUsers!: number;
  @IsInt() @Min(1) maxProducts!: number;
  @IsInt() @Min(1) maxBranches!: number;
}
