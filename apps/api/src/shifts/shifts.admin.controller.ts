import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateLiquidationTripDto } from './dto/create-liquidation-trip.dto';

@Controller('shifts')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class ShiftsAdminController {
  constructor(private shifts: ShiftsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateShiftDto) {
    return this.shifts.create(user.businessId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.shifts.findAll(user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.shifts.findOne(id, user.businessId);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.shifts.close(id, user.businessId, user.userId);
  }

  @Post(':id/trips')
  createTrip(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLiquidationTripDto,
  ) {
    return this.shifts.createTrip(id, user.businessId, dto);
  }
}
