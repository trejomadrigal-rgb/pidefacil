import { ConflictException } from '@nestjs/common';
export class DuplicateEmailException extends ConflictException {
  constructor() { super('Email already in use'); }
}
