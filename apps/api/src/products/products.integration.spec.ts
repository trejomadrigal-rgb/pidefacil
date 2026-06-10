import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Products (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;
  let categoryId: string;

  const registerBody = {
    businessName: 'Taquería El Padrino',
    slug: 'taqueria-padrino',
    phone: '5551112233',
    ownerName: 'Miguel Torres',
    email: 'miguel@padrino.com',
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
    await app.init();
  }, 30000);

  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    await prisma.extra.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.business.deleteMany();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;

    const cat = await prisma.category.create({
      data: { businessId, name: 'Tacos' },
    });
    categoryId = cat.id;
  }, 15000);

  describe('POST /products', () => {
    it('OWNER crea producto con precio', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ categoryId, name: 'Taco de Pastor', price: 20 })
        .expect(201);
      expect(res.body.name).toBe('Taco de Pastor');
      expect(Number(res.body.price)).toBe(20);
      expect(res.body.isAvailable).toBe(true);
      expect(res.body.variants).toEqual([]);
      expect(res.body.extras).toEqual([]);
    });

    it('retorna 404 si categoryId no pertenece al negocio', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Otro', slug: 'otro-biz-prod', phone: '5550000000' },
      });
      const otherCat = await prisma.category.create({
        data: { businessId: otherBiz.id, name: 'Ajena' },
      });
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ categoryId: otherCat.id, name: 'Taco', price: 20 })
        .expect(404);
    });

    it('retorna 400 con precio negativo', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ categoryId, name: 'Taco', price: -5 })
        .expect(400);
    });
  });

  describe('PATCH /products/:id', () => {
    it('actualiza nombre y precio', async () => {
      const prod = await prisma.product.create({
        data: { businessId, categoryId, name: 'Original', price: 15 },
      });
      const res = await request(app.getHttpServer())
        .patch(`/products/${prod.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Actualizado', price: 25 })
        .expect(200);
      expect(res.body.name).toBe('Actualizado');
      expect(Number(res.body.price)).toBe(25);
    });
  });

  describe('PATCH /products/:id/availability', () => {
    it('toggle isAvailable de true a false', async () => {
      const prod = await prisma.product.create({
        data: { businessId, categoryId, name: 'Producto', price: 10, isAvailable: true },
      });
      const res = await request(app.getHttpServer())
        .patch(`/products/${prod.id}/availability`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.isAvailable).toBe(false);
    });

    it('retorna 404 para producto de otro negocio (tenant isolation)', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'OtroBiz', slug: 'otro-biz-avail', phone: '5550000001' },
      });
      const otherCat = await prisma.category.create({
        data: { businessId: otherBiz.id, name: 'Cat' },
      });
      const otherProd = await prisma.product.create({
        data: { businessId: otherBiz.id, categoryId: otherCat.id, name: 'Ajeno', price: 10 },
      });
      await request(app.getHttpServer())
        .patch(`/products/${otherProd.id}/availability`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('POST /products/:id/variants', () => {
    it('agrega variante al producto', async () => {
      const prod = await prisma.product.create({
        data: { businessId, categoryId, name: 'Torta', price: 45 },
      });
      const res = await request(app.getHttpServer())
        .post(`/products/${prod.id}/variants`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Grande', price: 10 })
        .expect(201);
      expect(res.body.name).toBe('Grande');
      expect(Number(res.body.price)).toBe(10);
    });
  });

  describe('POST /products/:id/extras', () => {
    it('agrega extra al producto', async () => {
      const prod = await prisma.product.create({
        data: { businessId, categoryId, name: 'Quesadilla', price: 30 },
      });
      const res = await request(app.getHttpServer())
        .post(`/products/${prod.id}/extras`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Queso extra', price: 5 })
        .expect(201);
      expect(res.body.name).toBe('Queso extra');
    });
  });

  describe('DELETE /products/:id', () => {
    it('elimina producto y sus variantes/extras en cascade', async () => {
      const prod = await prisma.product.create({
        data: { businessId, categoryId, name: 'Para borrar', price: 20 },
      });
      await prisma.variant.create({ data: { productId: prod.id, name: 'Variante' } });
      await prisma.extra.create({ data: { productId: prod.id, name: 'Extra', price: 3 } });

      await request(app.getHttpServer())
        .delete(`/products/${prod.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const found = await prisma.product.findUnique({ where: { id: prod.id } });
      expect(found).toBeNull();
      const variants = await prisma.variant.findMany({ where: { productId: prod.id } });
      expect(variants).toHaveLength(0);
    });
  });
});
