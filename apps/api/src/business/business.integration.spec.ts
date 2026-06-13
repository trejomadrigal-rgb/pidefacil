import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Business (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let superAdminToken: string;

  const ownerRegBody = {
    businessName: 'Cocina Doña Rosa',
    slug: 'cocina-dona-rosa',
    phone: '5559876543',
    ownerName: 'Rosa Martínez',
    email: 'rosa@cocina.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = module.get<PrismaService>(PrismaService);
    await app.init();
  }, 30000);

  afterAll(async () => { await app.close(); }, 15000);

  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.extra.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.business.deleteMany();

    // Create OWNER via register
    const ownerRes = await request(app.getHttpServer()).post('/auth/register').send(ownerRegBody);
    ownerToken = ownerRes.body.access_token;

    // Create SUPER_ADMIN directly in DB (no register endpoint for super admins)
    const superBiz = await prisma.business.create({
      data: { name: 'PideFacil Admin', slug: 'pidefacil-admin', phone: '0000000000' },
    });
    await prisma.user.create({
      data: {
        businessId: superBiz.id,
        name: 'Super Admin',
        email: 'superadmin@pidefacil.com',
        passwordHash: '$2b$10$0ZWYxlU4B5dGRlfEl5CP9eUECn6qn30/wL37z/PrSmfw5FftgPORu',
        role: 'SUPER_ADMIN',
      },
    });
    const superRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'superadmin@pidefacil.com', password: 'SuperPass1!' });
    superAdminToken = superRes.body.access_token;
  }, 15000);

  describe('GET /business/me', () => {
    it('retorna el negocio del usuario autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/business/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.slug).toBe('cocina-dona-rosa');
      expect(res.body.name).toBe('Cocina Doña Rosa');
    });

    it('retorna 401 sin token', async () => {
      await request(app.getHttpServer()).get('/business/me').expect(401);
    });
  });

  describe('PATCH /business/me', () => {
    it('OWNER puede actualizar nombre y teléfono', async () => {
      const res = await request(app.getHttpServer())
        .patch('/business/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Cocina Rosa Nueva', phone: '5550001111' })
        .expect(200);
      expect(res.body.name).toBe('Cocina Rosa Nueva');
    });

    it('retorna 409 si slug ya existe en otro negocio', async () => {
      await prisma.business.create({
        data: { name: 'Otra Fonda', slug: 'fonda-extra', phone: '5550000000' },
      });
      await request(app.getHttpServer())
        .patch('/business/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ slug: 'fonda-extra' })
        .expect(409);
    });
  });

  describe('POST /super-admin/businesses', () => {
    it('SUPER_ADMIN crea negocio con OWNER', async () => {
      const res = await request(app.getHttpServer())
        .post('/super-admin/businesses')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          businessName: 'Fonda Nueva',
          slug: 'fonda-nueva',
          phone: '5558887777',
          ownerName: 'Carlos López',
          ownerEmail: 'carlos@fonda.com',
          ownerPassword: 'Pass1234!',
        })
        .expect(201);
      expect(res.body.business.slug).toBe('fonda-nueva');
      expect(res.body.owner.role).toBe('OWNER');
    });

    it('OWNER no puede crear negocios → 403', async () => {
      await request(app.getHttpServer())
        .post('/super-admin/businesses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          businessName: 'Otro',
          slug: 'otro',
          phone: '5550000000',
          ownerName: 'X',
          ownerEmail: 'x@x.com',
          ownerPassword: 'Pass1234!',
        })
        .expect(403);
    });
  });
});
