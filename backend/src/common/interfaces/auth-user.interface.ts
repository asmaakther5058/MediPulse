import { UserRole } from '../enums/user-role.enum.js';

// Shape of request.user after JwtStrategy.validate()
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}
