import { UnprocessableEntityException } from '@nestjs/common';
export class MenuNotPublishableException extends UnprocessableEntityException {
  constructor() { super('Menu has no available products'); }
}
