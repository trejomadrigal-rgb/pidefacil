import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('WhatsappModule (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let businessId: string;

  const suffix = Date.now();
  const mockFetch = jest.fn();
  let originalFetch: typeof fetch;

  beforeAll(async () => {
    originalFetch = global.fetch;
    global.fetch = mockFetch as any;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        businessName: `Fonda WA Test ${suffix}`,
        slug: `fonda-wa-${suffix}`,
        phone: '5512345678',
        ownerName: 'Dueño WA',
        email: `wa-owner-${suffix}@test.com`,
        password: 'Password123!',
      })
      .expect(201);

    ownerToken = registerRes.body.access_token;
    businessId = registerRes.body.business.id;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    await prisma.subscription.deleteMany({ where: { businessId } });
    await prisma.refreshToken.deleteMany({ where: { user: { businessId } } });
    await prisma.user.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await app.close();
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('GET /admin/whatsapp/status → not_configured cuando no hay sesión', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/whatsapp/status')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.status).toBe('not_configured');
  });

  it('POST /admin/whatsapp/connect → crea sesión y devuelve QR', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ instance: { instanceName: `fonda-wa-${suffix}`, status: 'created' } }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: '2@abc123', base64: 'data:image/png;base64,iVBOR==' }),
      } as any);

    const res = await request(app.getHttpServer())
      .post('/admin/whatsapp/connect')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(res.body.qr).toMatch(/^data:image\/png;base64,/);
    expect(res.body.status).toBe('connecting');

    const updated = await prisma.business.findUnique({ where: { id: businessId } });
    expect(updated?.whatsappSession).toBe(`fonda-wa-${suffix}`);
  });

  it('GET /admin/whatsapp/status → open cuando Evolution responde open', async () => {
    await prisma.business.update({ where: { id: businessId }, data: { whatsappSession: `fonda-wa-${suffix}` } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instance: { instanceName: `fonda-wa-${suffix}`, state: 'open' } }),
    } as any);

    const res = await request(app.getHttpServer())
      .get('/admin/whatsapp/status')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.status).toBe('open');
  });

  it('DELETE /admin/whatsapp/disconnect → elimina sesión y limpia BD', async () => {
    await prisma.business.update({ where: { id: businessId }, data: { whatsappSession: `fonda-wa-${suffix}` } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'SUCCESS' }),
    } as any);

    await request(app.getHttpServer())
      .delete('/admin/whatsapp/disconnect')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const updated = await prisma.business.findUnique({ where: { id: businessId } });
    expect(updated?.whatsappSession).toBeNull();
  });
});
