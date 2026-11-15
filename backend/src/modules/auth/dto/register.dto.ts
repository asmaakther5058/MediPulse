import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

import { Gender } from '../../../common/enums/gender.enum.js';
import { IsValidDate } from '../../../common/validators/is-valid-date.decorator.js';

// Public patient self-registration
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsValidDate({ past: true })
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(Object.values(Gender))
  gender?: Gender;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;
}
