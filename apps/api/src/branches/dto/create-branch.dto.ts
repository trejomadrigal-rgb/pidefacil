import { IsNumber, IsOptional, IsString, MaxLength, MinLength, Max, Min } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
