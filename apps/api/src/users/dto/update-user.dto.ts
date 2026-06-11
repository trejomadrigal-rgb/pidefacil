import { IsEmail, IsString, IsIn, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Role, UserStatus } from '@prisma/client';

const ASSIGNABLE_ROLES: Role[] = [Role.ADMIN, Role.OPERATOR, Role.KITCHEN, Role.MENU_DESIGNER, Role.OWNER];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES, { message: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` })
  role?: Role;

  @IsOptional()
  @IsIn([UserStatus.ACTIVE, UserStatus.INACTIVE])
  status?: UserStatus;
}
