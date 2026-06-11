export class OrderItemStatusDto {
  name!: string;
  quantity!: number;
  subtotal!: number;
}

export class OrderStatusDto {
  orderNumber!: string;
  status!: string;
  total!: number;
  deliveryType!: string;
  items!: OrderItemStatusDto[];
  createdAt!: Date;
}
