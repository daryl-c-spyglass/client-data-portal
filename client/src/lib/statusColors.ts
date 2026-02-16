/**
 * SINGLE SOURCE OF TRUTH - Property Status Colors
 * Use these colors consistently across the entire Client Data Portal:
 * - Maps (markers, legends)
 * - Property cards
 * - Tables/lists
 * - Badges/chips
 * - Charts/graphs
 * - PDF exports
 */

export const STATUS_COLORS = {
  subject: {
    name: 'Subject Property',
    hex: '#3b82f6',
    bg: 'bg-info',
    bgLight: 'bg-info/10',
    text: 'text-info',
    textDark: 'text-info',
    border: 'border-info',
    ring: 'ring-info',
  },
  active: {
    name: 'Active',
    hex: '#22c55e',
    bg: 'bg-success',
    bgLight: 'bg-success/10',
    text: 'text-success',
    textDark: 'text-success',
    border: 'border-success',
    ring: 'ring-success',
  },
  underContract: {
    name: 'Under Contract',
    hex: '#EF4923',
    bg: 'bg-primary',
    bgLight: 'bg-spyglass-orange-light',
    text: 'text-primary',
    textDark: 'text-primary',
    border: 'border-primary',
    ring: 'ring-primary',
  },
  closed: {
    name: 'Closed',
    hex: '#ef4444',
    bg: 'bg-destructive',
    bgLight: 'bg-destructive/10',
    text: 'text-destructive',
    textDark: 'text-destructive',
    border: 'border-destructive',
    ring: 'ring-destructive',
  },
  pending: {
    name: 'Pending',
    hex: '#6b7280',
    bg: 'bg-muted-foreground',
    bgLight: 'bg-muted',
    text: 'text-muted-foreground',
    textDark: 'text-muted-foreground',
    border: 'border-muted-foreground',
    ring: 'ring-muted-foreground',
  },
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

/**
 * Get status info from MLS status string
 */
export function getStatusFromMLS(mlsStatus: string, isSubject: boolean = false): StatusKey {
  if (isSubject) return 'subject';
  
  const normalized = mlsStatus?.toLowerCase().trim();
  
  switch (normalized) {
    case 'active':
      return 'active';
    case 'active under contract':
    case 'under contract':
      return 'underContract';
    case 'closed':
    case 'sold':
      return 'closed';
    case 'pending':
      return 'pending';
    default:
      return 'active';
  }
}

/**
 * Get hex color for map markers
 */
export function getStatusHex(status: StatusKey): string {
  return STATUS_COLORS[status].hex;
}

/**
 * Get hex color from MLS status string (convenience function)
 */
export function getStatusHexFromMLS(mlsStatus: string, isSubject: boolean = false): string {
  const status = getStatusFromMLS(mlsStatus, isSubject);
  return STATUS_COLORS[status].hex;
}

/**
 * Get Tailwind classes for status badge (light background)
 */
export function getStatusBadgeClasses(status: StatusKey): string {
  const colors = STATUS_COLORS[status];
  return `${colors.bgLight} ${colors.text}`;
}

/**
 * Get Tailwind classes for solid status badge (solid background with white text)
 */
export function getStatusBadgeSolidClasses(status: StatusKey): string {
  const colors = STATUS_COLORS[status];
  return `${colors.bg} text-white`;
}

/**
 * Get status config object for a given MLS status (replaces legacy statusConfig)
 */
export function getStatusConfig(mlsStatus: string) {
  const status = getStatusFromMLS(mlsStatus);
  const colors = STATUS_COLORS[status];
  return {
    color: colors.bg,
    textColor: 'text-white',
    hex: colors.hex,
  };
}

/**
 * Get all statuses for legends/filters
 */
export function getAllStatuses(): Array<{ key: StatusKey; name: string; hex: string }> {
  return Object.entries(STATUS_COLORS).map(([key, value]) => ({
    key: key as StatusKey,
    name: value.name,
    hex: value.hex,
  }));
}

/**
 * Get statuses for map legend (excludes subject in some contexts)
 */
export function getMapLegendStatuses(includeSubject: boolean = true): Array<{ key: StatusKey; name: string; hex: string }> {
  const all = getAllStatuses();
  return includeSubject ? all : all.filter(s => s.key !== 'subject');
}

/**
 * Map styles for Mapbox (re-exported for convenience)
 */
export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;
