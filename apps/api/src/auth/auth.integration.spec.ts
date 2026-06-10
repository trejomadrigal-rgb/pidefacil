import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = module.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.extra.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.business.deleteMany();
  });

  const validRegisterBody = {
    businessName: 'Fonda El Buen Sabor',
    slug: 'fonda-buen-sabor',
    phone: '5551234567',
    ownerName: 'Juan García',
    email: 'juan@fondabuen.com',
    password: 'Password123!',
  };

  describe('POST /auth/register', () => {
    it('crea business + user OWNER y retorna tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegisterBody)
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.user.email).toBe('juan@fondabuen.com');
      expect(res.body.user.role).toBe('OWNER');
      expect(res.body.business.slug).toBe('fonda-buen-sabor');
    });

    it('retorna 409 si el email ya existe', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(validRegisterBody);
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validRegisterBody, slug: 'otro-slug' })
        .expect(409);
      expect(res.body.message).toBe('Email already in use');
    });

    it('retorna 409 si el slug ya existe', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(validRegisterBody);
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validRegisterBody, email: 'otro@email.com' })
        .expect(409);
      expect(res.body.message).toBe('Slug already in use');
    });

    it('retorna 400 si el slug tiene mayúsculas', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validRegisterBody, slug: 'Fonda-Sabor' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/register').send(validRegisterBody);
    });

    it('retorna tokens con credenciales correctas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'juan@fondabuen.com', password: 'Password123!' })
        .expect(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
    });

    it('retorna 401 con contraseña incorrecta', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'juan@fondabuen.com', password: 'WrongPass' })
        .expect(401);
    });

    it('retorna 401 con email que no existe', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noexiste@test.com', password: 'Password123!' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer()).post('/auth/register').send(validRegisterBody);
      refreshToken = res.body.refresh_token;
    });

    it('rota el refresh token y retorna par nuevo', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.refresh_token).not.toBe(refreshToken);
    });

    it('retorna 401 si el token ya fue usado (rotado)', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').send({ refresh_token: refreshToken });
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer()).post('/auth/register').send(validRegisterBody);
      accessToken = res.body.access_token;
      refreshToken = res.body.refresh_token;
    });

    it('invalida el refresh token (logout)', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401);
    });

    it('logout-all invalida todos los tokens del usuario', async () => {
      const res2 = await request(app.getHttpServer()).post('/auth/login').send({ email: 'juan@fondabuen.com', password: 'Password123!' });
      const secondToken = res2.body.refresh_token;

      await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer()).post('/auth/refresh').send({ refresh_token: refreshToken }).expect(401);
      await request(app.getHttpServer()).post('/auth/refresh').send({ refresh_token: secondToken }).expect(401);
    });
  });
});
