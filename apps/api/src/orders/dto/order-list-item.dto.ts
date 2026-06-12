import { DeliveryType, OrderStatus, TrustLevel } from '@prisma/client';

export class OrderListItemDto {
  id!: string;
  orderNumber!: string;
  status!: OrderStatus;
  customerName!: string;
  customerPhone!: string;
  deliveryType!: DeliveryType;
  total!: number;
  itemCount!: number;
  createdAt!: Date;
  customerTrustLevel!: TrustLevel | null;
}
