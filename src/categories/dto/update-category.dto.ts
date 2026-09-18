import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

/** Semua field opsional — dipakai untuk PATCH. */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
