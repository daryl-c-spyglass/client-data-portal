// Re-export from statusColors for backwards compatibility
// Use statusColors.ts as the single source of truth
import { STATUS_COLORS, getStatusHexFromMLS, getStatusFromMLS, StatusKey } from './statusColors';

// Single source of truth for all map marker colors (aligned with statusColors.ts)
export const MAP_MARKER_COLORS = {
  subject: STATUS_COLORS.subject.hex,      // Blue - Subject Property
  active: STATUS_COLORS.active.hex,        // Green - Active
  underContract: STATUS_COLORS.underContract.hex, // Orange - Under Contract  
  pending: STATUS_COLORS.pending.hex,      // Gray - Pending
  closed: STATUS_COLORS.closed.hex,        // Red - Closed/Sold
} as const;

export { STATUS_COLORS, getStatusHexFromMLS, getStatusFromMLS };
export type { StatusKey };

export const MAP_MARKER_LABELS = {
  subject: 'Subject Property',
  active: 'Active',
  underContract: 'Under Contract',
  pending: 'Pending',
  closed: 'Closed',
} as const;

// Map styles for Mapbox
export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

// Helper to get color from MLS status
export function getMarkerColorFromStatus(status: string, isSubject: boolean = false): string {
  if (isSubject) return MAP_MARKER_COLORS.subject;
  
  const normalizedStatus = status?.toLowerCase().trim();
  
  switch (normalizedStatus) {
    case 'active':
      return MAP_MARKER_COLORS.active;
    case 'active under contract':
      return MAP_MARKER_COLORS.underContract;
    case 'pending':
      return MAP_MARKER_COLORS.pending;
    case 'under contract':
      return MAP_MARKER_COLORS.underContract;
    case 'closed':
    case 'sold':
      return MAP_MARKER_COLORS.closed;
    default:
      return MAP_MARKER_COLORS.active;
  }
}

// Helper to get status label
export function getStatusLabel(status: string): string {
  const normalizedStatus = status?.toLowerCase().trim();
  
  switch (normalizedStatus) {
    case 'active':
      return MAP_MARKER_LABELS.active;
    case 'active under contract':
      return MAP_MARKER_LABELS.underContract;
    case 'pending':
      return MAP_MARKER_LABELS.pending;
    case 'under contract':
      return MAP_MARKER_LABELS.underContract;
    case 'closed':
    case 'sold':
      return MAP_MARKER_LABELS.closed;
    default:
      return status || 'Unknown';
  }
}
