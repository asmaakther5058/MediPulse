import { randomUUID } from 'node:crypto';

export function generatePatientCode(): string {
  return `PAT-${randomUUID().slice(0, 8).toUpperCase()}`;
}
