// Script para crear super admin. Se copia al container de la API y se ejecuta con node.
// Usa los módulos que ya tiene el container en /app/apps/api/node_modules/
process.chdir('/app/apps/api');
const nm = process.cwd() + '/node_modules';
const { PrismaClient } = require(nm + '/@prisma/client');
const { PrismaPg } = require(nm + '/@prisma/adapter-pg');
const bcrypt = require(nm + '/bcrypt');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const email = process.env.SA_EMAIL || 'superadmin@pidefacil.com';
const password = process.env.SA_PASS || 'ChangeMe123!';
async function main() {
  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { passwordHash: hash } });
    console.log('SUPER_ADMIN password actualizado:', email);
    return;
  }
  let biz = await prisma.business.findUnique({ where: { slug: 'pidefacil-admin' } });
  if (!biz) {
    biz = await prisma.business.create({
      data: { name: 'PideFacil Admin', slug: 'pidefacil-admin', phone: '0000000000' },
    });
  }
  await prisma.user.create({
    data: { businessId: biz.id, name: 'Super Admin', email, passwordHash: hash, role: 'SUPER_ADMIN' },
  });
  console.log('SUPER_ADMIN creado:', email);
}
main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
