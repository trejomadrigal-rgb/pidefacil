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
  paymentMethod!: string | null;
  transferConfirmed!: boolean;
  assignedToId!: string | null;
  items!: OrderItemStatusDto[];
  createdAt!: Date;
}
