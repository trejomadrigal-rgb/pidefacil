import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function getArg(name: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || !process.argv[idx + 1]) {
    throw new Error(`Missing required argument: --${name}`);
  }
  return process.argv[idx + 1];
}

async function main() {
  const name = getArg('name');
  const slug = getArg('slug');
  const phone = getArg('phone');
  const email = getArg('email');
  const password = getArg('password');

  const existing = await prisma.business.findUnique({ where: { slug } });
  if (existing) {
    console.error(`\n❌ Error: ya existe una fonda con el slug "${slug}"\n`);
    process.exit(1);
  }

  const business = await prisma.business.create({
    data: { name, slug, phone, status: 'ACTIVE' },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      businessId: business.id,
      name,
      email,
      passwordHash,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  console.log('\n✅ Fonda creada exitosamente\n');
  console.log(`  Negocio:    ${name}`);
  console.log(`  Admin URL:  http://2.24.201.108:3002`);
  console.log(`  QR URL:     http://2.24.201.108:3001/${slug}`);
  console.log(`  Email:      ${email}`);
  console.log(`  Contraseña: ${password}\n`);
  console.log('  Comparte el QR URL con tus clientes.');
  console.log('  El operador entra al Admin URL con las credenciales de arriba.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e.message, '\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
