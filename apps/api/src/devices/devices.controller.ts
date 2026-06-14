import {
  Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Controller('admin/devices')
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Post('register')
  register(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(user.businessId, user.userId, dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.devicesService.findAll(user.businessId);
  }

  @Patch(':id/approve')
  @Roles(Role.OWNER, Role.ADMIN)
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.approve(user.businessId, id, dto.branchId);
  }

  @Patch(':id/block')
  @Roles(Role.OWNER, Role.ADMIN)
  block(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.devicesService.block(user.businessId, id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(204)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.devicesService.remove(user.businessId, id);
  }
}
