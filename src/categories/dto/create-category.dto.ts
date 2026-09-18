import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'slug tidak boleh kosong' })
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung',
  })
  slug: string;

  @IsString()
  @IsNotEmpty({ message: 'name tidak boleh kosong' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'emoji tidak boleh kosong' })
  @MaxLength(16)
  emoji: string;

  @IsString()
  @IsNotEmpty({ message: 'tone tidak boleh kosong' })
  @MaxLength(50)
  tone: string;
}
