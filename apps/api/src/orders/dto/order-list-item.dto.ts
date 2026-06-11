export class OrderListItemDto {
  id!: string;
  orderNumber!: string;
  status!: string;
  customerName!: string;
  customerPhone!: string;
  deliveryType!: string;
  total!: number;
  itemCount!: number;
  createdAt!: Date;
}
