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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { CreateExtraDto } from './dto/create-extra.dto';
import { ReorderProductsDto } from './dto/reorder-products.dto';

@Controller('products')
@Roles(Role.OWNER, Role.ADMIN)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll(user.businessId, categoryId, search);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.businessId, dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(@CurrentUser() user: CurrentUserPayload, @Body() dto: ReorderProductsDto) {
    return this.productsService.reorder(user.businessId, dto.items);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.businessId, id, dto);
  }

  @Patch(':id/availability')
  @HttpCode(HttpStatus.OK)
  toggleAvailability(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.productsService.toggleAvailability(user.businessId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.productsService.remove(user.businessId, id);
  }

  @Post(':id/variants')
  @HttpCode(HttpStatus.CREATED)
  addVariant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productsService.addVariant(user.businessId, id, dto);
  }

  @Delete(':id/variants/:vid')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVariant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('vid') vid: string,
  ) {
    return this.productsService.removeVariant(user.businessId, id, vid);
  }

  @Post(':id/extras')
  @HttpCode(HttpStatus.CREATED)
  addExtra(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateExtraDto,
  ) {
    return this.productsService.addExtra(user.businessId, id, dto);
  }

  @Delete(':id/extras/:eid')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExtra(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('eid') eid: string,
  ) {
    return this.productsService.removeExtra(user.businessId, id, eid);
  }
}
