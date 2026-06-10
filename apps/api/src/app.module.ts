import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { UsersModule } from './users/users.module';
import { PublicModule } from './public/public.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        MINIO_ENDPOINT: Joi.string().default('http://localhost:9000'),
        MINIO_ACCESS_KEY: Joi.string().default('minioadmin'),
        MINIO_SECRET_KEY: Joi.string().default('minioadmin'),
        MINIO_BUCKET: Joi.string().default('pidefacil'),
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    BusinessModule,
    UsersModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
