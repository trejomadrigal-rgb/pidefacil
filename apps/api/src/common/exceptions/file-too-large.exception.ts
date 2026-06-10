import { UnprocessableEntityException } from '@nestjs/common';
export class FileTooLargeException extends UnprocessableEntityException {
  constructor() { super('File exceeds maximum size of 5MB'); }
}
