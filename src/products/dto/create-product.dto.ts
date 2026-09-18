import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'name tidak boleh kosong' })
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'description tidak boleh kosong' })
  @MaxLength(255)
  description: string;

  /** Harga rupiah penuh, contoh 185000. */
  @Type(() => Number)
  @IsInt({ message: 'price harus berupa angka bulat' })
  @Min(1000, { message: 'price minimal Rp 1.000' })
  @Max(100_000_000, { message: 'price maksimal Rp 100.000.000' })
  price: number;

  @IsString()
  @IsNotEmpty({ message: 'emoji tidak boleh kosong' })
  @MaxLength(16)
  emoji: string;

  @IsString()
  @IsNotEmpty({ message: 'tone tidak boleh kosong' })
  @MaxLength(50)
  tone: string;

  @IsUUID('4', { message: 'categoryId harus UUID kategori yang valid' })
  categoryId: string;

  @IsOptional()
  @IsBoolean()
  bestSeller?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
