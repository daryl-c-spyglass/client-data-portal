import { STATUS_COLORS, StatusKey, getStatusFromMLS } from '@/lib/statusColors';

interface StatusBadgeProps {
  status: StatusKey | string;
  isSubject?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ 
  status, 
  isSubject = false, 
  size = 'md',
  showDot = true,
  className = '' 
}: StatusBadgeProps) {
  const statusKey: StatusKey = typeof status === 'string' && !(status in STATUS_COLORS)
    ? getStatusFromMLS(status, isSubject)
    : (isSubject ? 'subject' : status as StatusKey);
  
  const colors = STATUS_COLORS[statusKey];
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };
  
  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };
  
  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${colors.bgLight} ${colors.text} dark:bg-opacity-20 ${sizeClasses[size]} ${className}`}
      data-testid={`status-badge-${statusKey}`}
    >
      {showDot && (
        <span 
          className={`rounded-full ${dotSizes[size]}`}
          style={{ backgroundColor: colors.hex }}
        />
      )}
      {colors.name}
    </span>
  );
}
