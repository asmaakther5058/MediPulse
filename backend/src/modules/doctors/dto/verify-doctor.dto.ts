import { IsEnum } from 'class-validator';
import { VerificationStatus } from '../../../common/enums/verification-status.enum.js';

export class VerifyDoctorDto {
  @IsEnum(VerificationStatus)
  verificationStatus: VerificationStatus;
}
