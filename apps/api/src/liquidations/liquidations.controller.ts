import { Controller, Patch, Param } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ShiftsService } from '../shifts/shifts.service';

@Controller('liquidations')
@Roles(Role.OWNER, Role.ADMIN, Role.OPERATOR)
export class LiquidationsController {
  constructor(private shifts: ShiftsService) {}

  @Patch(':id/close')
  closeTrip(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.shifts.closeTrip(id, user.businessId, user.userId);
  }
}
