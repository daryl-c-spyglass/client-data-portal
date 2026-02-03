export type UserRole = 'developer' | 'super_admin' | 'admin' | 'agent';

export type Permission = 
  | 'developer.all'
  | 'developer.debug'
  | 'developer.manage_super_admins'
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

const ROLE_HIERARCHY: UserRole[] = ['agent', 'admin', 'super_admin', 'developer'];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  developer: [
    'developer.all',
    'developer.debug',
    'developer.manage_super_admins',
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
    developer: 'Developer',
    super_admin: 'Super Admin',
    admin: 'Admin',
    agent: 'Agent',
  };
  return displayNames[role] || 'Agent';
}

export function normalizeRole(role: string | undefined | null): UserRole {
  if (role === 'developer' || role === 'super_admin' || role === 'admin' || role === 'agent') {
    return role;
  }
  return 'agent';
}

export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  const actorLevel = ROLE_HIERARCHY.indexOf(actorRole);
  const targetLevel = ROLE_HIERARCHY.indexOf(targetRole);
  return actorLevel > targetLevel;
}

export const DEVELOPER_EMAILS = [
  'daryl@spyglassrealty.com',
  'ryan@spyglassrealty.com',
];

export const INITIAL_SUPER_ADMIN_EMAILS = [
  'caleb@spyglassrealty.com',
];

export function isDeveloperEmail(email: string): boolean {
  return DEVELOPER_EMAILS.includes(email.toLowerCase());
}

export function isSuperAdminEmail(email: string): boolean {
  return INITIAL_SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export function determineUserRole(user: { email: string; role?: string | null }): UserRole {
  if (user.role === 'developer') return 'developer';
  if (user.role === 'super_admin') return 'super_admin';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'agent') return 'agent';
  
  if (DEVELOPER_EMAILS.includes(user.email.toLowerCase())) {
    return 'developer';
  }
  if (INITIAL_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return 'super_admin';
  }
  
  return 'agent';
}
