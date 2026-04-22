import { UserRole } from '../../users/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}
