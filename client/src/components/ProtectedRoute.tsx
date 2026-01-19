import { Redirect } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import { Permission, UserRole } from "@shared/permissions";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: Permission;
  minimumRole?: UserRole;
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  permission,
  minimumRole,
  fallbackPath = "/",
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, can, isAtLeast } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-protected-route">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (permission && !can(permission)) {
    return <Redirect to={fallbackPath} />;
  }

  if (minimumRole && !isAtLeast(minimumRole)) {
    return <Redirect to={fallbackPath} />;
  }

  return <>{children}</>;
}
