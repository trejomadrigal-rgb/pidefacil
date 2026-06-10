import { UnprocessableEntityException } from '@nestjs/common';
export class InvalidFileTypeException extends UnprocessableEntityException {
  constructor() { super('File type not allowed. Use jpg, png or webp'); }
}
