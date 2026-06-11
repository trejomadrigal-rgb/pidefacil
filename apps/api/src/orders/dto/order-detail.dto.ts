export class OrderItemDetailDto {
  name!: string;
  quantity!: number;
  subtotal!: number;
  notes!: string | null;
}

export class OrderDetailDto {
  id!: string;
  orderNumber!: string;
  status!: string;
  customerName!: string;
  customerPhone!: string;
  deliveryType!: string;
  deliveryAddress!: string | null;
  notes!: string | null;
  subtotal!: number;
  total!: number;
  createdAt!: Date;
  items!: OrderItemDetailDto[];
}
