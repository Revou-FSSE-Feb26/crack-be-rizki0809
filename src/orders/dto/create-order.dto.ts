import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsUUID('4', { message: 'productId harus UUID menu yang valid' })
  productId: string;

  @Type(() => Number)
  @IsInt({ message: 'quantity harus berupa angka bulat' })
  @Min(1, { message: 'quantity minimal 1' })
  @Max(50, { message: 'quantity maksimal 50 per menu' })
  quantity: number;
}

export class CreateOrderDto {
  /**
   * Sementara dikirim dari body. Setelah JWT dipasang, nilai ini diambil dari
   * token supaya customer tidak bisa memesan atas nama orang lain.
   */
  @IsUUID('4', { message: 'userId harus UUID user yang valid' })
  userId: string;

  /** Tanggal pengambilan, format "YYYY-MM-DD". Minimal H+1 dari hari ini. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'pickupDate harus berformat YYYY-MM-DD',
  })
  pickupDate: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'order harus berisi minimal 1 menu' })
  @ArrayMaxSize(20, { message: 'order maksimal 20 jenis menu' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'notes maksimal 255 karakter' })
  notes?: string;
}
