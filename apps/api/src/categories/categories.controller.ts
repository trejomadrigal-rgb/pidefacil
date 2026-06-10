import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';

@Controller('categories')
@Roles(Role.OWNER, Role.ADMIN)
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('menuId') menuId?: string,
  ) {
    return this.categoriesService.findAll(user.businessId, menuId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.businessId, dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(@CurrentUser() user: CurrentUserPayload, @Body() dto: ReorderCategoriesDto) {
    return this.categoriesService.reorder(user.businessId, dto.items);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.categoriesService.remove(user.businessId, id);
  }
}
