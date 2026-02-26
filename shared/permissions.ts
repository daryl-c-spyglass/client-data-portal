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

export function normalizeRole(user: { isAdmin?: string | boolean; isSuperAdmin?: boolean } | string | undefined | null): UserRole {
  // Handle legacy string-based role
  if (typeof user === 'string') {
    if (user === 'developer' || user === 'super_admin' || user === 'admin' || user === 'agent') {
      return user;
    }
    return 'agent';
  }
  
  // Handle new boolean-based role structure
  if (user && typeof user === 'object') {
    return getUserRole(user);
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
];

export const INITIAL_SUPER_ADMIN_EMAILS = [
  'ryan@spyglassrealty.com',
  'caleb@spyglassrealty.com',
];

export function isDeveloperEmail(email: string): boolean {
  return DEVELOPER_EMAILS.includes(email.toLowerCase());
}

export function isSuperAdminEmail(email: string): boolean {
  return INITIAL_SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export function getUserRole(user: { isAdmin?: string | boolean; isSuperAdmin?: boolean }): UserRole {
  if (user.isSuperAdmin) return 'super_admin';
  if (user.isAdmin && user.isAdmin !== 'false') return 'admin';
  return 'agent';
}

export function determineUserRole(user: { email: string; isAdmin?: string | boolean; isSuperAdmin?: boolean }): UserRole {
  if (DEVELOPER_EMAILS.includes(user.email.toLowerCase())) {
    return 'developer';
  }

  if (user.isSuperAdmin) return 'super_admin';
  if (user.isAdmin && user.isAdmin !== 'false') return 'admin';
  
  if (INITIAL_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return 'super_admin';
  }
  
  return 'agent';
}
