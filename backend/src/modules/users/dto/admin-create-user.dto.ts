import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { UserRole } from '../../../common/enums/user-role.enum.js';

// Admin creates a Diagnostic Center or Admin login.
// Doctors self-register via POST /doctors/register; patients via POST /auth/register.
export class AdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsIn([UserRole.DOCTOR, UserRole.DIAGNOSTIC_CENTER, UserRole.ADMIN])
  role: UserRole;
}
