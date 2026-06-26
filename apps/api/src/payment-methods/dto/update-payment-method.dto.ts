import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePaymentMethodDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  requiresConfirmation?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  position?: number;
}
