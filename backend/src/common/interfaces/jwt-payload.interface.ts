import { UserRole } from '../enums/user-role.enum.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  // Issued at (seconds), added by the JWT library
  iat?: number;
}