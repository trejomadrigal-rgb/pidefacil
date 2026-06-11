import { DeliveryType, OrderStatus } from '@prisma/client';

export class OrderItemDetailDto {
  name!: string;
  quantity!: number;
  subtotal!: number;
  notes!: string | null;
}

export class OrderDetailDto {
  id!: string;
  orderNumber!: string;
  status!: OrderStatus;
  customerName!: string;
  customerPhone!: string;
  deliveryType!: DeliveryType;
  deliveryAddress!: string | null;
  notes!: string | null;
  subtotal!: number;
  total!: number;
  createdAt!: Date;
  items!: OrderItemDetailDto[];
}
