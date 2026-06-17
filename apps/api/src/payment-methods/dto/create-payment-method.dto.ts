import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;

  @IsBoolean()
  @IsOptional()
  requiresConfirmation?: boolean;

  @IsInt()
  @IsOptional()
  position?: number;
}
