import { In } from 'typeorm';
import { AppointmentQueryDto } from '../dto/appointment-query.dto.js';
import { CATEGORY_STATUSES } from '../enums/appointment-status.enum.js';

// status wins over category when both are sent
export function appointmentStatusFilter(query: AppointmentQueryDto) {
  if (query.status) return { status: query.status };
  if (query.category) return { status: In(CATEGORY_STATUSES[query.category]) };
  return {};
}
