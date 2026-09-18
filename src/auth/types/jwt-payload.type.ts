import { Role } from '@prisma/client';

/**
 * Isi (payload) di dalam token JWT.
 * `sub` (subject) adalah nama standar JWT untuk id pemilik token.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/** Data user yang ditempelkan ke request setelah tokennya terbukti valid. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
