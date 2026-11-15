import { IsEnum, Matches } from 'class-validator';
import { DayOfWeek } from '../../../common/enums/day-of-week.enum.js';

// A schedule block; the server splits it into 20-minute slot rows
export class CreateDoctorAvailabilityDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Start time must be in HH:mm format',
  })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'End time must be in HH:mm format',
  })
  endTime: string;
}
