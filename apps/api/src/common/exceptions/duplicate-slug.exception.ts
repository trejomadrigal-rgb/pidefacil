import { ConflictException } from '@nestjs/common';
export class DuplicateSlugException extends ConflictException {
  constructor() { super('Slug already in use'); }
}
