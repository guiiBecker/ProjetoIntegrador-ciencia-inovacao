import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './auth.constants';
import { UserRole } from './auth.types';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);