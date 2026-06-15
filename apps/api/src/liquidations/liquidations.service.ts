import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

/**
 * LiquidationsService — STUB
 *
 * The Liquidation schema was refactored as part of the repartidores module
 * (Phase 4b). Old columns (branchId, deliveryUserId, receivedById, amount,
 * settledAt) no longer exist.  The full implementation will be delivered in
 * the repartidores task that owns this module.
 *
 * Until then every method throws 501 Not Implemented so the app compiles and
 * starts without referencing deleted Prisma fields.
 */
@Injectable()
export class LiquidationsService {
  create(..._args: unknown[]): never {
    throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED);
  }

  findAll(..._args: unknown[]): never {
    throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED);
  }
}
