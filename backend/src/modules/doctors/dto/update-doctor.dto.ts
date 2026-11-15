
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateDoctorDto } from './create-doctor.dto.js';

export class UpdateDoctorDto extends PartialType(
  OmitType(CreateDoctorDto, ['userId'] as const),
) {}
