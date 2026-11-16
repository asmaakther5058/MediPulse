import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CreateDiagnosticCenterDto } from './create-diagnostic-center.dto.js';

// Public sign-up: the login account and the center profile in one request.
// The account's display name is the center name.
export class RegisterDiagnosticCenterDto extends CreateDiagnosticCenterDto {
  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
