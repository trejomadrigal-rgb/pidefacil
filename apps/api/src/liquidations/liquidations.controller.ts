import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { LiquidationsService } from './liquidations.service';
import { CreateLiquidationDto } from './dto/create-liquidation.dto';

@Controller('admin/liquidations')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class LiquidationsController {
  constructor(private liquidationsService: LiquidationsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateLiquidationDto) {
    return this.liquidationsService.create(user.businessId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload, @Query('branchId') branchId?: string) {
    return this.liquidationsService.findAll(user.businessId, branchId);
  }
}
