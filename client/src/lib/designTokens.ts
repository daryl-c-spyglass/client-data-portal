/**
 * Design Token Reference — Client Data Portal
 * 
 * 60-30-10 Color System:
 * - 60% Dominant: --background, --card, --muted (warm neutrals)
 * - 30% Secondary: --sidebar, --border, --secondary (structure)
 * - 10% Accent: --primary (#EF4923 Spyglass Orange)
 * 
 * Semantic Colors:
 * - Primary: Brand orange for CTAs and key actions
 * - Destructive: Red for delete/danger actions
 * - Success: Green for positive states
 * - Warning: Yellow/amber for caution states
 * - Info: Blue for informational states
 * 
 * Property Status Colors:
 * - Subject: Blue (info)
 * - Active: Green (success)
 * - Under Contract: Orange (primary/brand)
 * - Closed: Red (destructive)
 * - Pending: Gray (muted)
 * 
 * Usage:
 * - Always use Tailwind classes: bg-primary, text-success, etc.
 * - Never hardcode hex values in components
 * - For custom colors, add to tailwind.config.ts first
 */

export const BRAND_COLORS = {
  primary: '#EF4923',
  primaryHover: '#C93B1C',
  primaryLight: '#FEF2EF',
} as const;

export const STATUS_HEX = {
  subject: '#3b82f6',
  active: '#22c55e',
  underContract: '#EF4923',
  closed: '#ef4444',
  pending: '#6b7280',
} as const;
