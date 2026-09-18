import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Query string untuk GET /api/orders. */
export class QueryOrderDto {
  /** Dipakai customer untuk melihat history ordernya sendiri. */
  @IsOptional()
  @IsUUID('4', { message: 'userId harus UUID user yang valid' })
  userId?: string;

  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `status harus salah satu dari: ${Object.values(OrderStatus).join(', ')}`,
  })
  status?: OrderStatus;

  /** Filter orderan pada satu tanggal pengambilan, format "YYYY-MM-DD". */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'pickupDate harus berformat YYYY-MM-DD',
  })
  pickupDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page harus berupa angka' })
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit harus berupa angka' })
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
