import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Categories (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Cocina Los Ángeles',
    slug: 'cocina-angeles',
    phone: '5557654321',
    ownerName: 'Ana López',
    email: 'ana@angeles.com',
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

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
  }, 15000);

  describe('POST /categories', () => {
    it('OWNER crea categoría sin menú', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Entradas', sortOrder: 0 })
        .expect(201);
      expect(res.body.name).toBe('Entradas');
      expect(res.body.businessId).toBe(businessId);
    });

    it('crea categoría ligada a un menú existente', async () => {
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Menú Diario', type: 'DAILY' },
      });
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Sopas', menuId: menu.id })
        .expect(201);
      expect(res.body.menuId).toBe(menu.id);
    });

    it('retorna 404 si menuId no pertenece al negocio', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Otro', slug: 'otro-biz', phone: '5550000000' },
      });
      const otherMenu = await prisma.menu.create({
        data: { businessId: otherBiz.id, name: 'Ajeno', type: 'FIXED' },
      });
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Test', menuId: otherMenu.id })
        .expect(404);
    });
  });

  describe('PATCH /categories/:id', () => {
    it('actualiza nombre y sortOrder', async () => {
      const cat = await prisma.category.create({
        data: { businessId, name: 'Original' },
      });
      const res = await request(app.getHttpServer())
        .patch(`/categories/${cat.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Actualizado', sortOrder: 5 })
        .expect(200);
      expect(res.body.name).toBe('Actualizado');
      expect(res.body.sortOrder).toBe(5);
    });
  });

  describe('DELETE /categories/:id', () => {
    it('elimina categoría sin productos activos', async () => {
      const cat = await prisma.category.create({
        data: { businessId, name: 'Sin productos' },
      });
      await request(app.getHttpServer())
        .delete(`/categories/${cat.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
      const found = await prisma.category.findUnique({ where: { id: cat.id } });
      expect(found).toBeNull();
    });

    it('retorna 422 al eliminar categoría con productos activos', async () => {
      const cat = await prisma.category.create({
        data: { businessId, name: 'Con productos' },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Producto', price: 10, isAvailable: true },
      });
      await request(app.getHttpServer())
        .delete(`/categories/${cat.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(422);
    });

    it('retorna 404 para categoría de otro negocio (tenant isolation)', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Otro', slug: 'otro-biz2', phone: '5550000001' },
      });
      const otherCat = await prisma.category.create({
        data: { businessId: otherBiz.id, name: 'Ajena' },
      });
      await request(app.getHttpServer())
        .delete(`/categories/${otherCat.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('PATCH /categories/reorder', () => {
    it('actualiza sortOrder en bulk', async () => {
      // crear menú y dos categorías
      const menuRes = await request(app.getHttpServer())
        .post('/menus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Menú Reorder', type: 'FIXED' });
      const menuId = menuRes.body.id;

      const cat1 = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Cat A', menuId, sortOrder: 0 });
      const cat2 = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Cat B', menuId, sortOrder: 1 });

      const res = await request(app.getHttpServer())
        .patch('/categories/reorder')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ items: [
          { id: cat1.body.id, sortOrder: 10 },
          { id: cat2.body.id, sortOrder: 5 },
        ]});

      expect(res.status).toBe(200);

      const list = await request(app.getHttpServer())
        .get(`/categories?menuId=${menuId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(list.body[0].id).toBe(cat2.body.id); // sortOrder 5 primero
      expect(list.body[1].id).toBe(cat1.body.id); // sortOrder 10 segundo
    });
  });
});
