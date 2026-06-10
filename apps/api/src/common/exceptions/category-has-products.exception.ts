import { UnprocessableEntityException } from '@nestjs/common';
export class CategoryHasProductsException extends UnprocessableEntityException {
  constructor() { super('Cannot delete category with active products'); }
}
