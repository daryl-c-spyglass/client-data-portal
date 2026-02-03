import { Badge } from '@/components/ui/badge';
import { Code, ShieldCheck, Shield, User } from 'lucide-react';

interface RoleBadgeProps {
  role: string;
  showLabel?: boolean;
}

export function RoleBadge({ role, showLabel = true }: RoleBadgeProps) {
  switch (role) {
    case 'developer':
      return (
        <Badge className="bg-emerald-600 text-white gap-1">
          <Code className="w-3 h-3" />
          {showLabel && 'Developer'}
        </Badge>
      );
    case 'super_admin':
      return (
        <Badge className="bg-purple-600 text-white gap-1">
          <ShieldCheck className="w-3 h-3" />
          {showLabel && 'Super Admin'}
        </Badge>
      );
    case 'admin':
      return (
        <Badge className="bg-blue-600 text-white gap-1">
          <Shield className="w-3 h-3" />
          {showLabel && 'Admin'}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <User className="w-3 h-3" />
          {showLabel && 'Agent'}
        </Badge>
      );
  }
}
