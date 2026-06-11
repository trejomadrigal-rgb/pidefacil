import { NotFoundException } from '@nestjs/common';
export class BusinessNotFoundException extends NotFoundException {
  constructor() { super('Business not found'); }
}
