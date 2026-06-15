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
import { MenusModule } from './menus/menus.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { FilesModule } from './files/files.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { BranchesModule } from './branches/branches.module';
import { DevicesModule } from './devices/devices.module';
import { LiquidationsModule } from './liquidations/liquidations.module';
import { ShiftsModule } from './shifts/shifts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
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
        FIREBASE_SERVICE_ACCOUNT: Joi.string().optional(),
        EVOLUTION_API_URL: Joi.string().optional().default(''),
        EVOLUTION_API_KEY: Joi.string().optional().default(''),
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    BusinessModule,
    UsersModule,
    PublicModule,
    MenusModule,
    CategoriesModule,
    ProductsModule,
    FilesModule,
    OrdersModule,
    CustomersModule,
    NotificationsModule,
    ReportsModule,
    SuperAdminModule,
    BranchesModule,
    DevicesModule,
    LiquidationsModule,
    ShiftsModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
