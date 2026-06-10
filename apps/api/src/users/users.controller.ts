import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('business/me/users')
@Roles(Role.OWNER, Role.ADMIN)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  listUsers(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.listUsers(user.businessId);
  }

  @Get(':id')
  getUser(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.usersService.getUser(user.businessId, id);
  }

  @Post()
  createUser(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateUserDto) {
    return this.usersService.createUser(user.businessId, dto);
  }

  @Patch(':id')
  updateUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user.businessId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateUser(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.usersService.deactivateUser(user.businessId, id, user.userId);
  }
}
