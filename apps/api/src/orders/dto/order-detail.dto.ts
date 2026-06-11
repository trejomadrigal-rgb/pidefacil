import { DeliveryType, OrderStatus } from '@prisma/client';

export class OrderItemDetailDto {
  name!: string;
  quantity!: number;
  price!: number;
  subtotal!: number;
  notes!: string | null;
}

export class CustomerSnippetDto {
  id!: string;
  name!: string;
  phone!: string;
  notes!: string | null;
  trustLevel!: string;
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
  customer!: CustomerSnippetDto | null;
}
