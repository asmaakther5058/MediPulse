import { BadRequestException } from '@nestjs/common';
import { DAYS_BY_INDEX, DayOfWeek } from '../enums/day-of-week.enum.js';

// The platform operates in Bangladesh time (UTC+6, no DST).
export const APP_TIME_ZONE = 'Asia/Dhaka';
export const APP_UTC_OFFSET = '+06:00';

export function todayInAppZone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Validates YYYY-MM-DD and returns the weekday
export function weekdayOf(date: string): DayOfWeek {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new BadRequestException('Date must be a valid YYYY-MM-DD date');
  }

  return DAYS_BY_INDEX[parsed.getUTCDay()];
}

// Start of a slot on a date, as an absolute instant
export function slotStartInstant(date: string, time: string): Date {
  const hhmmss = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${hhmmss}${APP_UTC_OFFSET}`);
}
