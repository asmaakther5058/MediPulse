import { IsValidDate } from '../../../common/validators/is-valid-date.decorator.js';

export class SlotsQueryDto {
  @IsValidDate()
  date: string;
}
