import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  // The token from the reset link (?token=...)
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Invalid or expired reset link' })
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
