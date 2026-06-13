import { IsString, IsOptional } from 'class-validator';

export class UpdateBusinessDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() whatsapp?: string;
  @IsString() @IsOptional() timezone?: string;
}
