export type UserRole =
  | 'admin'
  | 'department_officer'
  | 'citizen';

export const ROLES = {
  ADMIN: 'admin' as UserRole,
  DEPARTMENT_OFFICER: 'department_officer' as UserRole,
  CITIZEN: 'citizen' as UserRole,
};

export const ALL_ROLES: UserRole[] = ['admin', 'department_officer', 'citizen'];
