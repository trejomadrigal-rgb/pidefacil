import { UnprocessableEntityException } from '@nestjs/common';
export class MenuNotDeletableException extends UnprocessableEntityException {
  constructor() { super('Cannot delete a published menu'); }
}
