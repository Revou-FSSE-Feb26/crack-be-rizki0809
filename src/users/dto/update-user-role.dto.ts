import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';

/** Hanya admin yang boleh memakai DTO ini. */
export class UpdateUserRoleDto {
  @IsEnum(Role, { message: 'role harus ADMIN atau CUSTOMER' })
  role: Role;
}
