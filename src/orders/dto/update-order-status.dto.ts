import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

/** Admin mengatur status orderan. */
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, {
    message: `status harus salah satu dari: ${Object.values(OrderStatus).join(', ')}`,
  })
  status: OrderStatus;
}
