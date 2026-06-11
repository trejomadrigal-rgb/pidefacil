import { NotFoundException } from '@nestjs/common';
export class BusinessNotFoundPublicException extends NotFoundException {
  constructor() { super('Business not found'); }
}
