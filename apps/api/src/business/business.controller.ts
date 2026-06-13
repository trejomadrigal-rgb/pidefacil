import { Controller, Get, Patch, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller()
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Get('business/me')
  getMyBusiness(@CurrentUser() user: CurrentUserPayload) {
    return this.businessService.getMyBusiness(user.businessId);
  }

  @Patch('business/me')
  @Roles(Role.OWNER, Role.ADMIN)
  updateMyBusiness(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessService.updateMyBusiness(user.businessId, dto);
  }

}
