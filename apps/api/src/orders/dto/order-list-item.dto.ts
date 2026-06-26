import { DeliveryType, OrderStatus, PaymentMethod, TrustLevel } from '@prisma/client';

export class OrderListItemDto {
  id!: string;
  orderNumber!: string;
  status!: OrderStatus;
  customerName!: string;
  customerPhone!: string;
  deliveryType!: DeliveryType;
  deliveryAddress!: string | null;
  paymentMethod!: PaymentMethod | null;
  transferConfirmed!: boolean;
  liquidationId!: string | null;
  total!: number;
  itemCount!: number;
  createdAt!: Date;
  customerTrustLevel!: TrustLevel | null;
}
