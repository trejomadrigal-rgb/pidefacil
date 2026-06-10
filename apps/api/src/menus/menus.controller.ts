import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Controller('menus')
@Roles(Role.OWNER, Role.ADMIN)
export class MenusController {
  constructor(private menusService: MenusService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.menusService.findAll(user.businessId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateMenuDto) {
    return this.menusService.create(user.businessId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menusService.update(user.businessId, id, dto);
  }

  @Patch(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.menusService.publish(user.businessId, id);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  duplicate(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.menusService.duplicate(user.businessId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.menusService.remove(user.businessId, id);
  }
}
