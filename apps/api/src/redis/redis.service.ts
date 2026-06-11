import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis(this.config.getOrThrow<string>('REDIS_URL'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds != null && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.del(...keys);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /** Sets TTL only if the key has no existing TTL (Redis 7+ EXPIRE … NX). */
  async expireNx(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds, 'NX');
  }

  // TODO: replace with SCAN-based iteration for production use with large keyspaces
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}
