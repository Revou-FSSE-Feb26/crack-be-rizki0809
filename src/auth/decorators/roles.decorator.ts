import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Membatasi endpoint hanya untuk role tertentu.
 * Contoh: @Roles(Role.ADMIN) pada endpoint tambah menu.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
