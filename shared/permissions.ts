export type UserRole = 'super_admin' | 'admin' | 'agent';

export type Permission = 
  | 'presentation_library.view'
  | 'presentation_library.manage'
  | 'user_management.view'
  | 'user_management.manage'
  | 'templates.create'
  | 'templates.manage'
  | 'cma.create'
  | 'cma.edit_own'
  | 'presentations.create'
  | 'presentations.use_global_slides'
  | 'settings.manage_company'
  | 'settings.manage_display'
  | 'analytics.view';

const ROLE_HIERARCHY: UserRole[] = ['agent', 'admin', 'super_admin'];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'presentation_library.view',
    'presentation_library.manage',
    'user_management.view',
    'user_management.manage',
    'templates.create',
    'templates.manage',
    'cma.create',
    'cma.edit_own',
    'presentations.create',
    'presentations.use_global_slides',
    'settings.manage_company',
    'settings.manage_display',
    'analytics.view',
  ],
  admin: [
    'presentation_library.view',
    'templates.create',
    'cma.create',
    'cma.edit_own',
    'presentations.create',
    'presentations.use_global_slides',
    'settings.manage_display',
    'analytics.view',
  ],
  agent: [
    'cma.create',
    'cma.edit_own',
    'presentations.create',
    'presentations.use_global_slides',
    'analytics.view',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

export function isAtLeast(role: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(requiredRole);
}

export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    agent: 'Agent',
  };
  return displayNames[role] || 'Agent';
}

export function normalizeRole(role: string | undefined | null): UserRole {
  if (role === 'super_admin' || role === 'admin' || role === 'agent') {
    return role;
  }
  return 'agent';
}

export const SUPER_ADMIN_EMAILS = [
  'ryan@spyglassrealty.com',
  'daryl@spyglassrealty.com',
  'caleb@spyglassrealty.com',
];

export function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
