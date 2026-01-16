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
    hex: '#3b82f6',        // Blue
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-100',
    text: 'text-blue-500',
    textDark: 'text-blue-400',
    border: 'border-blue-500',
    ring: 'ring-blue-500',
  },
  active: {
    name: 'Active',
    hex: '#22c55e',        // Green
    bg: 'bg-green-500',
    bgLight: 'bg-green-100',
    text: 'text-green-500',
    textDark: 'text-green-400',
    border: 'border-green-500',
    ring: 'ring-green-500',
  },
  underContract: {
    name: 'Under Contract',
    hex: '#f97316',        // Orange
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-100',
    text: 'text-orange-500',
    textDark: 'text-orange-400',
    border: 'border-orange-500',
    ring: 'ring-orange-500',
  },
  closed: {
    name: 'Closed',
    hex: '#ef4444',        // Red
    bg: 'bg-red-500',
    bgLight: 'bg-red-100',
    text: 'text-red-500',
    textDark: 'text-red-400',
    border: 'border-red-500',
    ring: 'ring-red-500',
  },
  pending: {
    name: 'Pending',
    hex: '#6b7280',        // Gray
    bg: 'bg-gray-500',
    bgLight: 'bg-gray-100',
    text: 'text-gray-500',
    textDark: 'text-gray-400',
    border: 'border-gray-500',
    ring: 'ring-gray-500',
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
      return 'active'; // Default fallback
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
  return `${colors.bgLight} ${colors.text} dark:bg-opacity-20 dark:${colors.textDark}`;
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
