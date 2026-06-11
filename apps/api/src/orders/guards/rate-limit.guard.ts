import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limit = 10;
  private readonly windowSeconds = 60;

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      request.ip ||
      'unknown';
    const key = `rate_limit:orders:${ip}`;

    const current = await this.redis.incr(key);
    if (current === 1) {
      // First request in window — set expiry
      await this.redis.expire(key, this.windowSeconds);
    }
    if (current > this.limit) {
      throw new HttpException(
        'Demasiados pedidos, espera un momento',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
