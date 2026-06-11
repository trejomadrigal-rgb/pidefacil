import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@pidefacil.com';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`SUPER_ADMIN ya existe: ${email}`);
    return;
  }

  let business = await prisma.business.findUnique({ where: { slug: 'pidefacil-admin' } });
  if (!business) {
    business = await prisma.business.create({
      data: { name: 'PideFacil Admin', slug: 'pidefacil-admin', phone: '0000000000' },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { businessId: business.id, name: 'Super Admin', email, passwordHash, role: 'SUPER_ADMIN' },
  });

  console.log(`SUPER_ADMIN creado: ${email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
