import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const orders = await prisma.order.findMany({
    where: { customerId: null, customerPhone: { not: '' } },
    select: { id: true, businessId: true, customerName: true, customerPhone: true },
  });

  console.log(`Found ${orders.length} orders without a customer record.`);

  if (orders.length === 0) {
    console.log('No orders to process. Done.');
    return;
  }

  // Group by businessId:phone
  type OrderGroup = { id: string; businessId: string; customerName: string; customerPhone: string }[];
  const groups: Record<string, OrderGroup> = {};

  for (const order of orders) {
    const key = `${order.businessId}:${order.customerPhone}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(order);
  }

  const groupKeys = Object.keys(groups);
  console.log(`Creating/linking ${groupKeys.length} customer records...`);

  let created = 0;
  let linked = 0;

  for (const key of groupKeys) {
    const groupOrders = groups[key];
    const first = groupOrders[0];
    const customer = await prisma.customer.upsert({
      where: { businessId_phone: { businessId: first.businessId, phone: first.customerPhone } },
      create: { businessId: first.businessId, name: first.customerName, phone: first.customerPhone },
      update: {},
    });

    if (groupOrders.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: groupOrders.map((o) => o.id) } },
        data: { customerId: customer.id },
      });
      linked += groupOrders.length;
      created += 1;
    }
  }

  console.log(`Created ${created} customer records and linked ${linked} orders. Done.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
