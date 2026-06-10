import { NotFoundException } from '@nestjs/common';
export class MenuNotFoundException extends NotFoundException {
  constructor() { super('Menu not found'); }
}
