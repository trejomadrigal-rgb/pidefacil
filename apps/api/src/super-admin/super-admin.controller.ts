import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, Patch, Post, Query } from '@nestjs/common';
import { BusinessStatus, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateBusinessDto } from '../business/dto/create-business.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SuperAdminService } from './super-admin.service';

@Controller('super-admin')
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.superAdminService.getDashboard();
  }

  @Get('plans')
  getPlans() {
    return this.superAdminService.getPlans();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.superAdminService.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.superAdminService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.superAdminService.deletePlan(id);
  }

  @Get('businesses')
  getBusinesses(@Query('status', new ParseEnumPipe(BusinessStatus, { optional: true })) status?: BusinessStatus) {
    return this.superAdminService.getBusinesses(status);
  }

  @Post('businesses')
  createBusiness(@Body() dto: CreateBusinessDto) {
    return this.superAdminService.createBusiness(dto);
  }

  @Get('businesses/:id')
  getBusiness(@Param('id') id: string) {
    return this.superAdminService.getBusinessById(id);
  }

  @Patch('businesses/:id')
  updateBusiness(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.superAdminService.updateBusiness(id, dto);
  }

  @Post('businesses/:id/suspend')
  @HttpCode(200)
  suspendBusiness(@Param('id') id: string) {
    return this.superAdminService.suspendBusiness(id);
  }

  @Post('businesses/:id/activate')
  @HttpCode(200)
  activateBusiness(@Param('id') id: string) {
    return this.superAdminService.activateBusiness(id);
  }

  @Post('subscriptions')
  upsertSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.superAdminService.upsertSubscription(dto);
  }

  @Patch('subscriptions/:id')
  updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.superAdminService.updateSubscription(id, dto);
  }
}
