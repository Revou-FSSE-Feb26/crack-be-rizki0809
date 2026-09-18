import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Query string untuk GET /api/products. */
export class QueryProductDto {
  /** Filter berdasarkan slug kategori, contoh ?category=birthday */
  @IsOptional()
  @IsString()
  category?: string;

  /** Pencarian nama menu, contoh ?search=coklat */
  @IsOptional()
  @IsString()
  search?: string;

  /** ?bestSeller=true untuk menampilkan menu favorit saja. */
  @IsOptional()
  @IsBooleanString({ message: 'bestSeller harus "true" atau "false"' })
  bestSeller?: string;

  /** ?includeUnavailable=true dipakai halaman admin agar menu nonaktif ikut tampil. */
  @IsOptional()
  @IsBooleanString({ message: 'includeUnavailable harus "true" atau "false"' })
  includeUnavailable?: string;

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
  limit?: number = 50;
}
