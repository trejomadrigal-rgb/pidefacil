import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Files (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;

  const registerBody = {
    businessName: 'Fonda Digital',
    slug: 'fonda-digital',
    phone: '5559998877',
    ownerName: 'Sofía Reyes',
    email: 'sofia@digital.com',
    password: 'Password123!',
  };

  // Buffer que simula una imagen JPEG válida (cabecera mínima)
  const jpegBuffer = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // SOI + APP0 marker
    Buffer.alloc(100, 0),
  ]);

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
  }, 15000);

  describe('POST /files/upload', () => {
    it('sube imagen JPEG y retorna URL', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' })
        .expect(201);
      expect(res.body.url).toMatch(/^http.+pidefacil\/products\/.+\.jpg$/);
    });

    it('retorna 422 con tipo MIME no permitido', async () => {
      await request(app.getHttpServer())
        .post('/files/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', Buffer.from('<svg/>'), { filename: 'test.svg', contentType: 'image/svg+xml' })
        .expect(422);
    });

    it('retorna 422 con archivo mayor a 5MB', async () => {
      const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0); // 6MB
      await request(app.getHttpServer())
        .post('/files/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' })
        .expect(422);
    });

    it('retorna 401 sin token', async () => {
      await request(app.getHttpServer())
        .post('/files/upload')
        .attach('file', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' })
        .expect(401);
    });

    it('sube imagen PNG y retorna URL', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(50)]);
      const res = await request(app.getHttpServer())
        .post('/files/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', pngBuffer, { filename: 'test.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body.url).toMatch(/\.png$/);
    });
  });
});
