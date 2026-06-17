import { IsIn, IsString, IsOptional, MinLength, MaxLength, Matches, IsUrl, ValidateIf } from 'class-validator';

const MENU_COLORS = ['naranja','verde','rojo','azul','morado','rosa','dorado','turquesa'] as const;

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug?: string;

  @IsOptional()
  @ValidateIf(o => !!o.phone)
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @ValidateIf(o => !!o.logoUrl)
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @ValidateIf(o => !!o.coverUrl)
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  hours?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(MENU_COLORS)
  menuColor?: string;
}
