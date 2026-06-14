import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Menus (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const registerBody = {
    businessName: 'Fonda Los Compadres',
    slug: 'fonda-compadres',
    phone: '5551234567',
    ownerName: 'Pedro Ramírez',
    email: 'pedro@compadres.com',
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

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(registerBody);
    ownerToken = res.body.access_token;
    businessId = res.body.business.id;
  }, 15000);

  describe('GET /menus', () => {
    it('retorna array vacío cuando no hay menús', async () => {
      const res = await request(app.getHttpServer())
        .get('/menus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('retorna 401 sin token', async () => {
      await request(app.getHttpServer()).get('/menus').expect(401);
    });
  });

  describe('POST /menus', () => {
    it('OWNER crea menú FIXED', async () => {
      const res = await request(app.getHttpServer())
        .post('/menus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Menú Principal', type: 'FIXED' })
        .expect(201);
      expect(res.body.name).toBe('Menú Principal');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.businessId).toBe(businessId);
    });

    it('retorna 400 con tipo inválido', async () => {
      await request(app.getHttpServer())
        .post('/menus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Menú', type: 'INVALID' })
        .expect(400);
    });
  });

  describe('PATCH /menus/:id/publish', () => {
    it('publica menú con productos disponibles', async () => {
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Menú Test', type: 'FIXED' },
      });
      const cat = await prisma.category.create({
        data: { businessId, menuId: menu.id, name: 'Entradas' },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Sopa', price: 35, isAvailable: true },
      });

      const res = await request(app.getHttpServer())
        .patch(`/menus/${menu.id}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.status).toBe('PUBLISHED');
      expect(res.body.publishedAt).toBeDefined();
    });

    it('retorna 422 cuando el menú no tiene productos disponibles', async () => {
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Menú Vacío', type: 'FIXED' },
      });
      await request(app.getHttpServer())
        .patch(`/menus/${menu.id}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(422);
    });

    it('retorna 404 para menú de otro negocio', async () => {
      const otherBiz = await prisma.business.create({
        data: { name: 'Otro', slug: 'otro-negocio', phone: '5550000000' },
      });
      const otherMenu = await prisma.menu.create({
        data: { businessId: otherBiz.id, name: 'Menú Ajeno', type: 'FIXED' },
      });
      await request(app.getHttpServer())
        .patch(`/menus/${otherMenu.id}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('POST /menus/:id/duplicate', () => {
    it('duplica menú con categorías y productos', async () => {
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Original', type: 'FIXED' },
      });
      const cat = await prisma.category.create({
        data: { businessId, menuId: menu.id, name: 'Platos' },
      });
      await prisma.product.create({
        data: { businessId, categoryId: cat.id, name: 'Arroz', price: 25 },
      });

      const res = await request(app.getHttpServer())
        .post(`/menus/${menu.id}/duplicate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
      expect(res.body.name).toBe('Original (copia)');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.id).not.toBe(menu.id);

      const newCats = await prisma.category.findMany({ where: { menuId: res.body.id } });
      expect(newCats).toHaveLength(1);
      expect(newCats[0].id).not.toBe(cat.id);
      const newProds = await prisma.product.findMany({ where: { categoryId: newCats[0].id } });
      expect(newProds).toHaveLength(1);
    });
  });

  describe('DELETE /menus/:id', () => {
    it('elimina menú en DRAFT', async () => {
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Para Borrar', type: 'FIXED' },
      });
      await request(app.getHttpServer())
        .delete(`/menus/${menu.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
      const found = await prisma.menu.findUnique({ where: { id: menu.id } });
      expect(found).toBeNull();
    });

    it('retorna 422 al intentar borrar menú PUBLISHED', async () => {
      const menu = await prisma.menu.create({
        data: { businessId, name: 'Publicado', type: 'FIXED', status: 'PUBLISHED' },
      });
      await request(app.getHttpServer())
        .delete(`/menus/${menu.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(422);
    });
  });
});
