import {
  Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, Patch, Post, Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpsertMenuSchedulesDto } from './dto/upsert-menu-schedules.dto';
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto';

@Controller('admin/branches')
@Roles(Role.OWNER, Role.ADMIN)
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.branchesService.findAll(user.businessId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user.businessId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.findOne(user.businessId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(user.businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.remove(user.businessId, id);
  }

  @Get(':id/menu-schedules')
  getMenuSchedules(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.getMenuSchedules(user.businessId, id);
  }

  @Put(':id/menu-schedules')
  upsertMenuSchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpsertMenuSchedulesDto,
  ) {
    return this.branchesService.upsertMenuSchedules(user.businessId, id, dto);
  }

  @Get(':id/product-availability')
  getProductAvailability(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.branchesService.getProductAvailability(user.businessId, id);
  }

  @Patch(':id/product-availability')
  updateProductAvailability(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductAvailabilityDto,
  ) {
    return this.branchesService.updateProductAvailability(user.businessId, id, dto);
  }
}
