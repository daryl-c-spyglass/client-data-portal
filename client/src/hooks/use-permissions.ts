import { useQuery } from "@tanstack/react-query";
import {
  UserRole,
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAtLeast,
  normalizeRole,
  getRoleDisplayName,
} from "@shared/permissions";

interface UserData {
  id: string;
  email: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  picture?: string | null;
}

export function usePermissions() {
  const { data: user, isLoading } = useQuery<UserData>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const role = normalizeRole(user?.role);

  return {
    user,
    role,
    isLoading,
    isAuthenticated: !!user,
    
    can: (permission: Permission) => hasPermission(role, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(role, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(role, permissions),
    isAtLeast: (requiredRole: UserRole) => isAtLeast(role, requiredRole),
    
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin" || role === "super_admin",
    isAgent: role === "agent",
    
    roleDisplayName: getRoleDisplayName(role),
  };
}
