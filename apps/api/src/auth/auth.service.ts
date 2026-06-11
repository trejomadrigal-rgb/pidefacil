import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { DuplicateEmailException } from '../common/exceptions/duplicate-email.exception';
import { DuplicateSlugException } from '../common/exceptions/duplicate-slug.exception';
import { InvalidCredentialsException } from '../common/exceptions/invalid-credentials.exception';
import { TokenExpiredException } from '../common/exceptions/token-expired.exception';

const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

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
