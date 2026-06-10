import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { BusinessNotFoundException } from '../common/exceptions/business-not-found.exception';
import { DuplicateSlugException } from '../common/exceptions/duplicate-slug.exception';
import { DuplicateEmailException } from '../common/exceptions/duplicate-email.exception';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async getMyBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new BusinessNotFoundException();
    return business;
  }

  async updateMyBusiness(businessId: string, dto: UpdateBusinessDto) {
    if (dto.slug) {
      const existing = await this.prisma.business.findFirst({
        where: { slug: dto.slug, id: { not: businessId } },
      });
      if (existing) throw new DuplicateSlugException();
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: dto,
    });
  }

  async createBusiness(dto: CreateBusinessDto) {
    const [existingSlug, existingEmail] = await Promise.all([
      this.prisma.business.findUnique({ where: { slug: dto.slug } }),
      this.prisma.user.findUnique({ where: { email: dto.ownerEmail } }),
    ]);
    if (existingSlug) throw new DuplicateSlugException();
    if (existingEmail) throw new DuplicateEmailException();

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: dto.businessName, slug: dto.slug, phone: dto.phone },
      });
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          name: dto.ownerName,
          email: dto.ownerEmail,
          passwordHash,
          role: 'OWNER',
        },
      });
      return { business, owner: { id: user.id, email: user.email, role: user.role } };
    });
  }
}
