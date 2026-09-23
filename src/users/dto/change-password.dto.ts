import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'currentPassword wajib diisi' })
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'password baru minimal 8 karakter' })
  @MaxLength(72, { message: 'password baru maksimal 72 karakter' })
  newPassword: string;
}
