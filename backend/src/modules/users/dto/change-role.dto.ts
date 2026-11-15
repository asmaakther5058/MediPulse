import { IsEnum } from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum.js';

export class ChangeRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
