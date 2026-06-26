import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { DuplicateEmailException } from '../common/exceptions/duplicate-email.exception';
import { DuplicateSlugException } from '../common/exceptions/duplicate-slug.exception';
import { InvalidCredentialsException } from '../common/exceptions/invalid-credentials.exception';
import { TokenExpiredException } from '../common/exceptions/token-expired.exception';

const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const RESET_CODE_TTL_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(`[EMAIL STUB] To: ${to} | Subject: ${subject} | ${html.replace(/<[^>]+>/g, '')}`);
      return;
    }
    const transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? 'PideFacil <noreply@pidefacil.mx>',
      to,
      subject,
      html,
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string, businessId: string, role: string) {
    const accessToken = this.jwt.sign({ sub: userId, businessId, role });

    const refreshToken = uuidv4();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, isRevoked: false },
    });
    await this.redis.set(`rt:${tokenHash}`, userId, REFRESH_TOKEN_TTL_SECONDS);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async register(dto: RegisterDto) {
    const [existingEmail, existingSlug] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.business.findUnique({ where: { slug: dto.slug } }),
    ]);
    if (existingEmail) throw new DuplicateEmailException();
    if (existingSlug) throw new DuplicateSlugException();

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const { business, user } = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: dto.businessName, slug: dto.slug, phone: dto.phone },
      });
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          name: dto.ownerName,
          email: dto.email,
          passwordHash,
          role: 'OWNER',
        },
      });
      return { business, user };
    });

    const tokens = await this.issueTokens(user.id, business.id, user.role);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: { id: business.id, name: business.name, slug: business.slug },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { business: true },
    });

    if (!user || user.status === 'INACTIVE') throw new InvalidCredentialsException();

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsException();

    const tokens = await this.issueTokens(user.id, user.businessId, user.role);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: { id: user.business.id, name: user.business.name, slug: user.business.slug },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    // Fast-path: Redis check
    const inRedis = await this.redis.get(`rt:${tokenHash}`);
    if (!inRedis) throw new TokenExpiredException();

    // Atomic: lookup + revoke in one transaction
    const dbToken = await this.prisma.$transaction(async (tx) => {
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { business: true } } },
      });
      if (!token || token.isRevoked || token.expiresAt < new Date()) {
        throw new TokenExpiredException();
      }
      await tx.refreshToken.update({
        where: { id: token.id },
        data: { isRevoked: true },
      });
      return token;
    });

    await this.redis.del(`rt:${tokenHash}`);

    const { user } = dbToken;
    const tokens = await this.issueTokens(user.id, user.businessId, user.role);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.redis.del(`rt:${tokenHash}`);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to avoid revealing whether email exists
    if (!user) return;

    const code = String(randomInt(100000, 999999));
    await this.redis.set(`pwd-reset:${email}`, code, RESET_CODE_TTL_SECONDS);

    await this.sendEmail(
      email,
      'Código para recuperar tu contraseña — PideFacil',
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#FF6B35">PideFacil</h2>
        <p>Tu código de verificación es:</p>
        <div style="font-size:40px;font-weight:bold;letter-spacing:8px;color:#1A1A2E;text-align:center;padding:24px;background:#f5f5f5;border-radius:12px;margin:24px 0">
          ${code}
        </div>
        <p style="color:#6B7280;font-size:14px">Válido por 15 minutos. Si no solicitaste este código, ignora este correo.</p>
      </div>`,
    );
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const stored = await this.redis.get(`pwd-reset:${email}`);
    if (!stored || stored !== code) {
      throw new BadRequestException('Código incorrecto o expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.redis.del(`pwd-reset:${email}`);
  }

  async logoutAll(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, isRevoked: false },
      select: { tokenHash: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    if (tokens.length > 0) {
      await this.redis.del(...tokens.map((t) => `rt:${t.tokenHash}`));
    }
  }
}
