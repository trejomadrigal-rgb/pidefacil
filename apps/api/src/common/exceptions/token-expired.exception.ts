import { UnauthorizedException } from '@nestjs/common';
export class TokenExpiredException extends UnauthorizedException {
  constructor() { super('Token expired or revoked'); }
}
