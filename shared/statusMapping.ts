/**
 * Centralized Status Mapping Module
 * 
 * This module provides consistent status handling across the application,
 * matching MLS-native statuses exactly without normalization that would hide listings.
 * 
 * RESO Standard Statuses:
 * - Active: Property is available for sale
 * - Active Under Contract: Property is under contract but still showing
 * - Pending: Property has an accepted offer and is no longer showing
 * - Closed: Property sale has been completed
 */

// MLS-native status codes and their display labels
export const STATUS_CODES = {
  ACTIVE: 'Active',
  ACTIVE_UNDER_CONTRACT: 'Active Under Contract',
  PENDING: 'Pending',
  CLOSED: 'Closed',
} as const;

// Abbreviated codes used by some MLS systems
export const STATUS_ABBREVIATIONS: Record<string, string> = {
  'A': 'Active',
  'AU': 'Active Under Contract',
  'P': 'Pending',
  'C': 'Closed',
  'S': 'Closed', // Sold = Closed
  'Lc': 'Active Under Contract', // Listing contract
  'Sc': 'Active Under Contract', // Seller contract
};

// API query parameter values for different data sources
export const API_STATUS_VALUES = {
  // For unified /api/search endpoint
  unified: {
    active: 'active',
    underContract: 'under_contract',
    pending: 'pending', 
    closed: 'closed',
  },
  // For Repliers API (uses standardStatus field)
  repliers: {
    active: 'Active',
    underContract: 'Active Under Contract',
    pending: 'Pending',
    closed: 'Closed',
  },
  // For MLS Grid API
  mlsGrid: {
    active: 'Active',
    underContract: 'Active Under Contract',
    pending: 'Pending',
    closed: 'Closed',
  },
} as const;

// Badge/display colors for each status
export const STATUS_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  'Active': { 
    bg: 'bg-green-100 dark:bg-green-900/30', 
    text: 'text-green-800 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800'
  },
  'Active Under Contract': { 
    bg: 'bg-amber-100 dark:bg-amber-900/30', 
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800'
  },
  'Pending': { 
    bg: 'bg-blue-100 dark:bg-blue-900/30', 
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800'
  },
  'Closed': { 
    bg: 'bg-gray-100 dark:bg-gray-800/50', 
    text: 'text-gray-800 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700'
  },
};

/**
 * Normalize a status value to the standard MLS display label
 * Handles various input formats: abbreviations, API values, raw codes
 */
export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  
  const normalized = status.trim();
  
  // Check for direct match with standard statuses
  if (Object.values(STATUS_CODES).includes(normalized as any)) {
    return normalized;
  }
  
  // Check for abbreviation
  const fromAbbrev = STATUS_ABBREVIATIONS[normalized];
  if (fromAbbrev) {
    return fromAbbrev;
  }
  
  // Check for API query values (case-insensitive)
  const lower = normalized.toLowerCase();
  switch (lower) {
    case 'active':
      return STATUS_CODES.ACTIVE;
    case 'under_contract':
    case 'active_under_contract':
    case 'active under contract':
    case 'undercontract':
      return STATUS_CODES.ACTIVE_UNDER_CONTRACT;
    case 'pending':
      return STATUS_CODES.PENDING;
    case 'closed':
    case 'sold':
      return STATUS_CODES.CLOSED;
    default:
      // Return as-is if we can't map it
      return normalized;
  }
}

/**
 * Convert a display status to a unified API query value
 */
export function statusToApiValue(status: string): string {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case STATUS_CODES.ACTIVE:
      return 'active';
    case STATUS_CODES.ACTIVE_UNDER_CONTRACT:
      return 'under_contract';
    case STATUS_CODES.PENDING:
      return 'pending';
    case STATUS_CODES.CLOSED:
      return 'closed';
    default:
      return status.toLowerCase().replace(/\s+/g, '_');
  }
}

/**
 * Convert API query values to RESO-compliant standardStatus for Repliers
 */
export function apiValueToRepliersStatus(apiValue: string): string {
  switch (apiValue.toLowerCase()) {
    case 'active':
      return 'Active';
    case 'under_contract':
      return 'Active Under Contract';
    case 'pending':
      return 'Pending';
    case 'closed':
      return 'Closed';
    default:
      return apiValue;
  }
}

/**
 * Get the display color classes for a status
 */
export function getStatusColors(status: string): { bg: string; text: string; border?: string } {
  const normalized = normalizeStatus(status);
  return STATUS_COLORS[normalized] || STATUS_COLORS['Active'];
}

/**
 * Check if a status should be included in "active" searches
 * (includes Active and Active Under Contract)
 */
export function isActiveStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === STATUS_CODES.ACTIVE || normalized === STATUS_CODES.ACTIVE_UNDER_CONTRACT;
}

/**
 * Check if a status represents a completed/closed sale
 */
export function isClosedStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === STATUS_CODES.CLOSED;
}

/**
 * Check if a status represents an under-contract state
 * (includes Active Under Contract and Pending)
 */
export function isUnderContractStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === STATUS_CODES.ACTIVE_UNDER_CONTRACT || normalized === STATUS_CODES.PENDING;
}

/**
 * Get all valid status values for filtering
 */
export function getAllStatuses(): string[] {
  return Object.values(STATUS_CODES);
}

/**
 * Map Repliers API listing data to standardized status
 * Priority: standardStatus > lastStatus mapping > status code
 */
export function mapRepliersStatus(listing: {
  standardStatus?: string;
  status?: string;
  lastStatus?: string;
}): string {
  // Priority 1: RESO-compliant standardStatus field
  if (listing.standardStatus) {
    const standardized = normalizeStatus(listing.standardStatus);
    if (standardized !== 'Unknown') {
      return standardized;
    }
  }
  
  // Priority 2: lastStatus field (for Active Under Contract detection)
  if (listing.lastStatus) {
    const fromLastStatus = STATUS_ABBREVIATIONS[listing.lastStatus];
    if (fromLastStatus) {
      return fromLastStatus;
    }
  }
  
  // Priority 3: status code
  if (listing.status) {
    return normalizeStatus(listing.status);
  }
  
  return 'Unknown';
}
