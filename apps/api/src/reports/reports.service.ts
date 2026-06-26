import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetDashboardDto } from './dto/get-dashboard.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(businessId: string, dto: GetDashboardDto) {
    const start = new Date(`${dto.startDate}T00:00:00.000Z`);
    const end = new Date(`${dto.endDate}T23:59:59.999Z`);

    const [orderGroups, orderItems, orders, frequentResult] = await Promise.all([
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
        select: { createdAt: true, status: true, total: true, paymentMethod: true },
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
      if (row.status === 'DELIVERED') deliveredOrders += count;
      if (row.status === 'CANCELLED') cancelledOrders += count;
      if (ACTIVE_STATUSES.includes(row.status)) confirmedOrders += count;
    }

    const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0;
    const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

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
      .map(([productId, { name, qty }]) => ({ productId, productName: name, totalQuantity: qty }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    // --- Peak hours & daily trend & payment breakdown ---
    const hourCounts = new Array(24).fill(0) as number[];
    const dailyMap = new Map<string, { orders: number; revenue: number }>();
    const revenueByPayment = { cash: 0, card: 0, transfer: 0 };

    for (const order of orders) {
      // Peak hours
      hourCounts[order.createdAt.getHours()]++;

      // Daily trend — fill map per date
      const date = order.createdAt.toISOString().split('T')[0];
      const day = dailyMap.get(date) ?? { orders: 0, revenue: 0 };
      day.orders++;
      if (order.status !== 'CANCELLED' && order.status !== 'REJECTED') {
        day.revenue += Number(order.total);
      }
      dailyMap.set(date, day);

      // Revenue by payment method (only delivered orders)
      if (order.status === 'DELIVERED') {
        const amount = Number(order.total);
        if (order.paymentMethod === 'CASH') revenueByPayment.cash += amount;
        else if (order.paymentMethod === 'CARD') revenueByPayment.card += amount;
        else if (order.paymentMethod === 'TRANSFER') revenueByPayment.transfer += amount;
      }
    }

    // Build daily trend filling every date in range
    const dailyTrend: { date: string; orders: number; revenue: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const date = cursor.toISOString().split('T')[0];
      dailyTrend.push({ date, ...(dailyMap.get(date) ?? { orders: 0, revenue: 0 }) });
      cursor.setDate(cursor.getDate() + 1);
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
        avgOrderValue,
        deliveryRate,
      },
      topProducts,
      peakHours,
      dailyTrend,
      revenueByPayment,
    };
  }
}
