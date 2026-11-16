import { In } from 'typeorm';
import { AppointmentQueryDto } from '../dto/appointment-query.dto.js';
import { AppointmentCategory, CATEGORY_STATUSES } from '../enums/appointment-status.enum.js';

// status wins over category when both are sent
export function appointmentStatusFilter(query: AppointmentQueryDto) {
  if (query.status) return { status: query.status };
  if (query.category) return { status: In(CATEGORY_STATUSES[query.category]) };
  return {};
}

// Upcoming tab: next appointment first. Everything else: newest first.
export function appointmentOrder(query: AppointmentQueryDto) {
  const direction = query.category === AppointmentCategory.UPCOMING && !query.status ? 'ASC' : 'DESC';
  return { appointmentDate: direction, startTime: direction } as const;
}
