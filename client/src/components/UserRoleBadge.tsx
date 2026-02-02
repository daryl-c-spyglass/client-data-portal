import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, User } from "lucide-react";

interface UserRoleBadgeProps {
  className?: string;
  size?: "sm" | "default";
}

export function UserRoleBadge({ className, size = "default" }: UserRoleBadgeProps) {
  const { isSuperAdmin, isAdmin, roleDisplayName, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const badgeSize = size === "sm" ? "text-xs px-2 py-0.5" : "";

  if (isSuperAdmin) {
    return (
      <Badge
        className={`bg-purple-600 text-white gap-1 ${badgeSize} ${className || ""}`}
        data-testid="badge-role-super-admin"
      >
        <ShieldCheck className={iconSize} />
        {roleDisplayName}
      </Badge>
    );
  }

  if (isAdmin) {
    return (
      <Badge
        className={`bg-blue-600 text-white gap-1 ${badgeSize} ${className || ""}`}
        data-testid="badge-role-admin"
      >
        <Shield className={iconSize} />
        {roleDisplayName}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={`gap-1 ${badgeSize} ${className || ""}`}
      data-testid="badge-role-agent"
    >
      <User className={iconSize} />
      {roleDisplayName}
    </Badge>
  );
}
