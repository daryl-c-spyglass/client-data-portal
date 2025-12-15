/**
 * Shared Neighborhood Utilities
 * Used across client and server for consistent neighborhood and property type handling
 */

export interface NeighborhoodInfo {
  name: string | null;
  city?: string | null;
  boundaryId?: string | null;
  source: 'repliers' | 'cached' | 'none';
}

export interface PropertyLocationInfo {
  neighborhood: NeighborhoodInfo;
  subdivision: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

/**
 * Resolve neighborhood info from a listing/property object
 * Priority: neighborhood field > cached boundary lookup
 */
export function resolveNeighborhoodForListing(listing: {
  neighborhood?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): NeighborhoodInfo {
  if (listing.neighborhood) {
    return {
      name: listing.neighborhood,
      city: listing.city || null,
      source: 'cached',
    };
  }
  
  return {
    name: null,
    city: listing.city || null,
    source: 'none',
  };
}

/**
 * Extract complete location info from a property/listing
 */
export function extractPropertyLocation(property: {
  neighborhood?: string | null;
  subdivision?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): PropertyLocationInfo {
  return {
    neighborhood: resolveNeighborhoodForListing(property),
    subdivision: property.subdivision || null,
    city: property.city || null,
    state: property.stateOrProvince || null,
    postalCode: property.postalCode || null,
  };
}

/**
 * Property type normalization mapping
 */
export const PROPERTY_TYPE_DISPLAY_MAP: Record<string, string> = {
  'single family residence': 'Single Family',
  'single family': 'Single Family',
  'single-family': 'Single Family',
  'sfr': 'Single Family',
  'detached': 'Single Family',
  'residential': 'Single Family',
  'condominium': 'Condo',
  'condo': 'Condo',
  'high rise': 'Condo',
  'mid rise': 'Condo',
  'low rise': 'Condo',
  'townhouse': 'Townhouse',
  'townhome': 'Townhouse',
  'attached': 'Townhouse',
  'row house': 'Townhouse',
  'multi-family': 'Multi-Family',
  'multi family': 'Multi-Family',
  'multifamily': 'Multi-Family',
  'duplex': 'Multi-Family',
  'triplex': 'Multi-Family',
  'quadruplex': 'Multi-Family',
  'manufactured home': 'Manufactured Home',
  'manufactured': 'Manufactured Home',
  'mobile home': 'Manufactured Home',
  'mobile': 'Manufactured Home',
  'modular': 'Manufactured Home',
  'ranch': 'Ranch',
  'farm': 'Ranch',
  'farm/ranch': 'Ranch',
  'ranch/farm': 'Ranch',
  'agricultural': 'Ranch',
  'unimproved land': 'Land',
  'unimproved': 'Land',
  'vacant land': 'Land',
  'lots and land': 'Land',
  'land': 'Land',
  'lot': 'Land',
  'multiple lots': 'Multiple Lots',
  'multiple lots (adjacent)': 'Multiple Lots',
  'adjacent lots': 'Multiple Lots',
  'commercial': 'Commercial',
  'retail': 'Commercial',
  'office': 'Commercial',
  'industrial': 'Commercial',
};

/**
 * Normalize property type to a standardized display name
 * USE THIS EVERYWHERE for consistent property type display
 */
export function normalizePropertyType(rawType: string | null | undefined): string {
  if (!rawType) return 'Other';
  
  const normalized = rawType.toLowerCase().trim();
  
  if (PROPERTY_TYPE_DISPLAY_MAP[normalized]) {
    return PROPERTY_TYPE_DISPLAY_MAP[normalized];
  }
  
  for (const [key, displayName] of Object.entries(PROPERTY_TYPE_DISPLAY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return displayName;
    }
  }
  
  return rawType.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get short abbreviation for property type
 */
export function getPropertyTypeAbbrev(rawType: string | null | undefined): string {
  const formatted = normalizePropertyType(rawType);
  
  const abbreviations: Record<string, string> = {
    'Single Family': 'SFR',
    'Condo': 'Condo',
    'Townhouse': 'TH',
    'Multi-Family': 'MF',
    'Manufactured Home': 'MH',
    'Ranch': 'Ranch',
    'Land': 'Land',
    'Multiple Lots': 'Lots',
    'Commercial': 'Comm',
    'Other': 'Other',
  };
  
  return abbreviations[formatted] || formatted;
}

/**
 * Format neighborhood display with fallback
 */
export function formatNeighborhoodDisplay(neighborhood: string | null | undefined): string {
  if (!neighborhood) {
    return 'Not available';
  }
  return neighborhood;
}

/**
 * Format location summary line
 */
export function formatLocationSummary(location: PropertyLocationInfo): string {
  const parts: string[] = [];
  
  if (location.neighborhood.name) {
    parts.push(location.neighborhood.name);
  }
  
  if (location.city) {
    parts.push(location.city);
  }
  
  if (location.state) {
    parts.push(location.state);
  }
  
  return parts.join(', ') || 'Location unavailable';
}

/**
 * Debug logging for neighborhood resolution (dev only)
 */
export function logNeighborhoodResolution(
  listingId: string,
  resolved: NeighborhoodInfo,
  debugEnabled: boolean = false
): void {
  if (!debugEnabled) return;
  
  if (resolved.name) {
    console.log(`[Neighborhood] Resolved: ${listingId} → ${resolved.name} (${resolved.source})`);
  } else {
    console.log(`[Neighborhood] Missing: ${listingId} → no neighborhood data`);
  }
}
