import { IsIn } from 'class-validator';
import { VerificationStatus } from '../../../common/enums/verification-status.enum.js';

export class VerifyDiagnosticCenterDto {
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  verificationStatus: VerificationStatus;
}
