import { IsEmail, IsString, IsIn, MinLength, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

const ASSIGNABLE_ROLES: Role[] = [Role.ADMIN, Role.OPERATOR, Role.KITCHEN, Role.MENU_DESIGNER, Role.OWNER];

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsIn(ASSIGNABLE_ROLES, { message: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` })
  role!: Role;
}
