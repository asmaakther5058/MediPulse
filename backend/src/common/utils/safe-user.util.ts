import { User } from '../../modules/users/entities/user.entity.js';

// Link to a user's photo (the stored file path is never exposed)
export function profilePhotoUrl(user: Pick<User, 'id' | 'profileImageUrl'>): string | null {
  return user.profileImageUrl ? `/users/${user.id}/photo` : null;
}

// Public view of a user: never includes passwordHash
export function toSafeUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    profileImageUrl: profilePhotoUrl(user),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Column selection for relations that load a user
export const SAFE_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  profileImageUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Postgres unique_violation
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { code?: string }).code === '23505' ||
      (error as { driverError?: { code?: string } }).driverError?.code === '23505')
  );
}
