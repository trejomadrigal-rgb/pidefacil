import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

export class ProductAvailabilityItemDto {
  @IsString()
  productId!: string;

  @IsBoolean()
  isAvailable!: boolean;
}

export class UpdateProductAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAvailabilityItemDto)
  items!: ProductAvailabilityItemDto[];
}
