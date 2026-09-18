import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * Password tidak diubah lewat endpoint ini — nanti disediakan endpoint
 * ganti password tersendiri agar butuh verifikasi password lama.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}
