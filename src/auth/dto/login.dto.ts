import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'format email tidak valid' })
  @MaxLength(150)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'password tidak boleh kosong' })
  @MaxLength(72)
  password: string;
}
