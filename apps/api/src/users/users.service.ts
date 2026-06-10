import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserNotFoundException } from '../common/exceptions/user-not-found.exception';
import { DuplicateEmailException } from '../common/exceptions/duplicate-email.exception';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  listUsers(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getUser(businessId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new UserNotFoundException();
    return user;
  }

  async createUser(businessId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new DuplicateEmailException();

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { businessId, name: dto.name, email: dto.email, passwordHash, role: dto.role },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
  }

  async updateUser(businessId: string, userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, businessId } });
    if (!user) throw new UserNotFoundException();

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new DuplicateEmailException();
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, name: true, email: true, role: true, status: true, updatedAt: true },
    });
  }

  async deactivateUser(businessId: string, userId: string, requestingUserId: string) {
    if (userId === requestingUserId) {
      throw new UnprocessableEntityException('You cannot deactivate your own account');
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, businessId } });
    if (!user) throw new UserNotFoundException();

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.INACTIVE },
    });
  }
}
