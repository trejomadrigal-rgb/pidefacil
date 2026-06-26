import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { GetDashboardDto } from './dto/get-dashboard.dto';

@Controller('reports')
@Roles(Role.OWNER, Role.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query() dto: GetDashboardDto,
  ) {
    return this.reportsService.getDashboard(user.businessId, dto);
  }
}
