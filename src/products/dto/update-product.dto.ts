import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/** Semua field opsional — dipakai untuk PATCH. */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
