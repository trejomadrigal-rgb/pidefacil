import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Public API (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let ownerToken: string;
  let businessSlug: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda QR Pública',
    slug: 'fonda-qr',
    phone: '5554443322',
    ownerName: 'Luisa Mendoza',
    email: 'luisa@qr.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
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
    await prisma.subscription.deleteMany();
    await prisma.liquidation.deleteMany();
    await prisma.device.deleteMany();
    await prisma.branchProductAvailability.deleteMany();
    await prisma.branchMenuSchedule.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.business.deleteMany();
    // Limpiar cache Redis de este slug
    await redis.del('public:business:fonda-qr', 'public:categories:fonda-qr', 'public:products:fonda-qr');

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
    businessSlug = 'fonda-qr';
  }, 15000);

  describe('GET /public/business/:slug', () => {
    it('retorna info del negocio sin autenticación', async () => {
      const res = await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}`)
        .expect(200);
      expect(res.body.slug).toBe(businessSlug);
      expect(res.body.name).toBe('Fonda QR Pública');
    });

    it('retorna 404 para slug inexistente', async () => {
      await request(app.getHttpServer())
        .get('/public/business/slug-inexistente')
        .expect(404);
    });

    it('segunda petición usa cache Redis (no requiere DB)', async () => {
      // Primera petición llena el cache
      await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}`)
        .expect(200);

      // Verificar que el cache Redis fue llenado
      const cached = await redis.get(`public:business:${businessSlug}`);
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached!);
      expect(parsed.slug).toBe(businessSlug);
    });
  });

  describe('GET /public/business/:slug/categories', () => {
    it('retorna categorías activas con productos disponibles', async () => {
      const cat = await prisma.category.create({
        data: { businessId, name: 'Tacos', status: 'ACTIVE', sortOrder: 0 },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Taco de Pastor', price: 20, isAvailable: true },
      });

      const res = await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}/categories`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Tacos');
      expect(res.body[0].products).toHaveLength(1);
      expect(res.body[0].products[0].name).toBe('Taco de Pastor');
    });

    it('excluye productos no disponibles', async () => {
      const cat = await prisma.category.create({
        data: { businessId, name: 'Bebidas', status: 'ACTIVE' },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Aguas', price: 15, isAvailable: false },
      });

      const res = await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}/categories`)
        .expect(200);
      expect(res.body[0].products).toHaveLength(0);
    });
  });

  describe('GET /public/business/:slug/products', () => {
    it('retorna todos los productos disponibles', async () => {
      const cat = await prisma.category.create({
        data: { businessId, name: 'Platos', status: 'ACTIVE' },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Arroz', price: 25, isAvailable: true },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Frijoles', price: 20, isAvailable: false },
      });

      const res = await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}/products`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Arroz');
    });

    it('filtra por ?search=', async () => {
      const cat = await prisma.category.create({
        data: { businessId, name: 'Antojitos', status: 'ACTIVE' },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Tostada', price: 15, isAvailable: true },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Sopa', price: 30, isAvailable: true },
      });

      const res = await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}/products?search=tost`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Tostada');
    });
  });

  describe('Cache invalidation', () => {
    it('publicar menú invalida el cache', async () => {
      // Llenar cache
      await request(app.getHttpServer())
        .get(`/public/business/${businessSlug}/categories`)
        .expect(200);
      const cachedBefore = await redis.get(`public:categories:${businessSlug}`);
      expect(cachedBefore).not.toBeNull();

      // Crear menú con producto y publicar
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Menú del Día', type: 'FIXED' },
      });
      const cat = await prisma.category.create({
        data: { businessId, menuId: menu.id, name: 'Especiales' },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Especial', price: 55, isAvailable: true },
      });
      await request(app.getHttpServer())
        .patch(`/menus/${menu.id}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Cache debe haber sido invalidado
      const cachedAfter = await redis.get(`public:categories:${businessSlug}`);
      expect(cachedAfter).toBeNull();
    });
  });
});
