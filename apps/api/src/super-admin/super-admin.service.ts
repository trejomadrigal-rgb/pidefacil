import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { BusinessService } from '../business/business.service';
import { CreateBusinessDto } from '../business/dto/create-business.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessService: BusinessService,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────

  async getDashboard() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [subscriptions, totalOrders30d, recentBusinesses] = await Promise.all([
      this.prisma.subscription.findMany({ include: { plan: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.business.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const mrr = subscriptions
      .filter(s => s.status === 'ACTIVE')
      .reduce((sum, s) => sum + Number(s.plan.monthlyPrice), 0);

    const activeBusinesses = subscriptions.filter(s => s.status === 'ACTIVE').length;
    const trialBusinesses = subscriptions.filter(s => s.status === 'TRIAL').length;

    // businessesByPlan
    const planMap = new Map<string, number>();
    for (const sub of subscriptions) {
      planMap.set(sub.plan.name, (planMap.get(sub.plan.name) ?? 0) + 1);
    }
    const businessesByPlan = Array.from(planMap.entries()).map(([planName, count]) => ({
      planName,
      count,
    }));

    // newBusinesses30d — exactly 30 entries, zero-filled
    const buckets: Record<string, number> = {};
    for (const biz of recentBusinesses) {
      const day = biz.createdAt.toISOString().slice(0, 10);
      buckets[day] = (buckets[day] ?? 0) + 1;
    }
    const newBusinesses30d = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const day = d.toISOString().slice(0, 10);
      return { date: day, count: buckets[day] ?? 0 };
    });

    return { mrr, activeBusinesses, trialBusinesses, totalOrders30d, businessesByPlan, newBusinesses30d };
  }

  // ── Plans ─────────────────────────────────────────────────────────────

  getPlans() {
    return this.prisma.plan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  }

  createPlan(dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: dto });
  }

  updatePlan(id: string, dto: UpdatePlanDto) {
    return this.handlePrismaNotFound(() =>
      this.prisma.plan.update({ where: { id }, data: dto }),
    );
  }

  async deletePlan(id: string) {
    const activeCount = await this.prisma.subscription.count({
      where: { planId: id, status: { in: ['ACTIVE', 'TRIAL'] } },
    });
    if (activeCount > 0) {
      throw new ConflictException('Cannot delete a plan with active or trial subscriptions');
    }
    return this.handlePrismaNotFound(() =>
      this.prisma.plan.delete({ where: { id } }),
    );
  }

  // ── Businesses ────────────────────────────────────────────────────────

  getBusinesses(status?: BusinessStatus) {
    return this.prisma.business.findMany({
      where: status ? { status } : undefined,
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  getBusinessById(id: string) {
    return this.handlePrismaNotFound(() =>
      this.prisma.business.findUniqueOrThrow({
        where: { id },
        include: { subscription: { include: { plan: true } } },
      }),
    );
  }

  createBusiness(dto: CreateBusinessDto) {
    return this.businessService.createBusiness(dto);
  }

  updateBusiness(id: string, dto: UpdateBusinessDto) {
    return this.handlePrismaNotFound(() =>
      this.prisma.business.update({ where: { id }, data: dto }),
    );
  }

  suspendBusiness(id: string) {
    return this.handlePrismaNotFound(() =>
      this.prisma.business.update({ where: { id }, data: { status: 'SUSPENDED' } }),
    );
  }

  activateBusiness(id: string) {
    return this.handlePrismaNotFound(() =>
      this.prisma.business.update({ where: { id }, data: { status: 'ACTIVE' } }),
    );
  }

  // ── Subscriptions ─────────────────────────────────────────────────────

  upsertSubscription(dto: CreateSubscriptionDto) {
    return this.prisma.subscription.upsert({
      where: { businessId: dto.businessId },
      create: {
        businessId: dto.businessId,
        planId: dto.planId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status,
      },
      update: {
        planId: dto.planId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status,
      },
    });
  }

  updateSubscription(id: string, dto: UpdateSubscriptionDto) {
    return this.handlePrismaNotFound(() =>
      this.prisma.subscription.update({
        where: { id },
        data: {
          ...(dto.planId !== undefined && { planId: dto.planId }),
          ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
          ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      }),
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private async handlePrismaNotFound<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Record not found');
      }
      throw e;
    }
  }
}
