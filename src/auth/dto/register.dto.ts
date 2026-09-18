import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Perhatikan: tidak ada field `role` di sini. Siapa pun yang mendaftar lewat
 * endpoint ini otomatis menjadi CUSTOMER, supaya tidak ada yang bisa
 * mengangkat dirinya sendiri menjadi ADMIN.
 */
export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'name tidak boleh kosong' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'format email tidak valid' })
  @MaxLength(150)
  email: string;

  @IsString()
  @MinLength(8, { message: 'password minimal 8 karakter' })
  @MaxLength(72, { message: 'password maksimal 72 karakter' })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{8,20}$/, {
    message: 'phone hanya boleh angka dan simbol telepon, 8-20 karakter',
  })
  phone?: string;
}
