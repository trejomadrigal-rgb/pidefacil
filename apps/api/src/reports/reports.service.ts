import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetDashboardDto } from './dto/get-dashboard.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(businessId: string, dto: GetDashboardDto) {
    const start = new Date(`${dto.startDate}T00:00:00.000Z`);
    const end = new Date(`${dto.endDate}T23:59:59.999Z`);

    const [orderGroups, orderItems, allOrders, frequentResult] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where: { businessId, createdAt: { gte: start, lte: end } },
        _count: { id: true },
        _sum: { total: true },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: {
            businessId,
            createdAt: { gte: start, lte: end },
            status: { notIn: ['CANCELLED', 'REJECTED'] },
          },
        },
        select: {
          productId: true,
          quantity: true,
          product: { select: { name: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { businessId, createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
      }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { businessId, createdAt: { gte: start, lte: end }, customerId: { not: null } },
        having: { customerId: { _count: { gte: 2 } } },
      }),
    ]);

    // --- Summary ---
    let totalRevenue = 0;
    let totalOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let confirmedOrders = 0;

    const ACTIVE_STATUSES = ['NEW', 'UNDER_REVIEW', 'WAITING_CONFIRMATION', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY'];

    for (const row of orderGroups) {
      const count = row._count.id;
      totalOrders += count;

      if (row.status !== 'CANCELLED' && row.status !== 'REJECTED') {
        totalRevenue += Number(row._sum.total ?? 0);
      }
      if (row.status === 'DELIVERED') {
        deliveredOrders += count;
      }
      if (row.status === 'CANCELLED') {
        cancelledOrders += count;
      }
      if (ACTIVE_STATUSES.includes(row.status)) {
        confirmedOrders += count;
      }
    }

    // --- Top products ---
    const productMap = new Map<string, { name: string; qty: number }>();
    for (const item of orderItems) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        productMap.set(item.productId, { name: item.product.name, qty: item.quantity });
      }
    }
    const topProducts = [...productMap.entries()]
      .map(([productId, { name, qty }]) => ({
        productId,
        productName: name,
        totalQuantity: qty,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    // --- Peak hours ---
    const hourCounts = new Array(24).fill(0) as number[];
    for (const order of allOrders) {
      hourCounts[order.createdAt.getHours()]++;
    }
    const peakHours = hourCounts.map((orderCount, hour) => ({ hour, orderCount }));

    return {
      period: { startDate: dto.startDate, endDate: dto.endDate },
      summary: {
        totalRevenue,
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        confirmedOrders,
        frequentCustomers: frequentResult.length,
      },
      topProducts,
      peakHours,
    };
  }
}
