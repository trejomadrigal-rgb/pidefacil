export class OrderItemStatusDto {
  name!: string;
  quantity!: number;
  subtotal!: number;
}

export class OrderStatusDto {
  id!: string;
  orderNumber!: string;
  status!: string;
  total!: number;
  deliveryType!: string;
  paymentMethod!: string | null;
  transferConfirmed!: boolean;
  assignedToId!: string | null;
  paymentMethodLabel!: string | null;
  requiresConfirmation!: boolean;
  items!: OrderItemStatusDto[];
  createdAt!: Date;
}
