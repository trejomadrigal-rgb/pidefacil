import { Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { LiquidationsService } from './liquidations.service';

/**
 * LiquidationsController — STUB
 *
 * Routes are kept so that the module compiles and can be wired into AppModule.
 * All methods delegate to LiquidationsService which returns 501 Not Implemented
 * until the repartidores task delivers the full implementation.
 */
@Controller('admin/liquidations')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class LiquidationsController {
  constructor(private liquidationsService: LiquidationsService) {}

  @Post()
  create(@CurrentUser() _user: CurrentUserPayload) {
    return this.liquidationsService.create();
  }

  @Get()
  findAll(@CurrentUser() _user: CurrentUserPayload) {
    return this.liquidationsService.findAll();
  }
}
