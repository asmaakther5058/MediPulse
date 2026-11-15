import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePrescriptionDto } from './create-prescription.dto.js';

// The appointment cannot change; everything else is optional
export class UpdatePrescriptionDto extends PartialType(
  OmitType(CreatePrescriptionDto, ['appointmentId'] as const),
) {}
