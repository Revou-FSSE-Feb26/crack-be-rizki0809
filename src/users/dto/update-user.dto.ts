import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * Dipakai user untuk mengubah datanya sendiri.
 *
 * `password` dan `role` sengaja dibuang:
 * - password perlu endpoint tersendiri yang memverifikasi password lama,
 * - role hanya boleh diubah admin lewat PATCH /users/:id/role, supaya customer
 *   tidak bisa mengangkat dirinya sendiri menjadi ADMIN.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'role'] as const),
) {}
