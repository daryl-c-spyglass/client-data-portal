/**
 * Centralized property type display utilities
 * Ensures consistent property type formatting across all components
 */

/**
 * Canonical property type normalization function - USE THIS EVERYWHERE
 * Must match server/inventory-service.ts normalizePropertyType exactly
 */
export function normalizePropertyType(propertySubType: string | null | undefined): string {
  if (!propertySubType) return 'Other';
  
  const normalized = propertySubType.toLowerCase().trim();
  
  // Single Family
  if (normalized.includes('single family') || normalized === 'sfr' || normalized === 'detached') {
    return 'Single Family Residence';
  }
  
  // Condominium
  if (normalized.includes('condo') || normalized.includes('condominium')) {
    return 'Condominium';
  }
  
  // Townhouse
  if (normalized.includes('townhouse') || normalized.includes('townhome') || normalized.includes('town house')) {
    return 'Townhouse';
  }
  
  // Multi-Family
  if (normalized.includes('multi') || normalized.includes('duplex') || normalized.includes('triplex') || 
      normalized.includes('fourplex') || normalized.includes('apartment')) {
    return 'Multi-Family';
  }
  
  // Manufactured Home
  if (normalized.includes('manufactured') || normalized.includes('mobile') || normalized.includes('modular')) {
    return 'Manufactured Home';
  }
  
  // Ranch
  if (normalized.includes('ranch') && !normalized.includes('single')) {
    return 'Ranch';
  }
  
  // Land
  if (normalized.includes('land') || normalized.includes('lot') || normalized.includes('acreage') ||
      normalized.includes('unimproved') || normalized.includes('vacant')) {
    if (normalized.includes('multiple') || normalized.includes('adjacent')) {
      return 'Multiple Lots (Adjacent)';
    }
    return 'Unimproved Land';
  }
  
  return 'Other';
}

/**
 * All valid property types for inventory - must match server/inventory-service.ts
 */
export const INVENTORY_PROPERTY_TYPES = [
  'Single Family Residence',
  'Condominium',
  'Townhouse',
  'Multi-Family',
  'Manufactured Home',
  'Ranch',
  'Unimproved Land',
  'Multiple Lots (Adjacent)',
  'Other',
] as const;

/**
 * Property type category mappings for unified display
 */
export const PROPERTY_TYPE_DISPLAY_MAP: Record<string, string> = {
  // Single Family variations
  'single family residence': 'Single Family',
  'single family': 'Single Family',
  'single-family': 'Single Family',
  'sfr': 'Single Family',
  'detached': 'Single Family',
  'residential': 'Single Family',
  
  // Condo variations
  'condominium': 'Condo',
  'condo': 'Condo',
  'high rise': 'Condo',
  'mid rise': 'Condo',
  'low rise': 'Condo',
  
  // Townhouse variations
  'townhouse': 'Townhouse',
  'townhome': 'Townhouse',
  'attached': 'Townhouse',
  'row house': 'Townhouse',
  
  // Multi-Family variations
  'multi-family': 'Multi-Family',
  'multi family': 'Multi-Family',
  'multifamily': 'Multi-Family',
  'duplex': 'Multi-Family',
  'triplex': 'Multi-Family',
  'quadruplex': 'Multi-Family',
  
  // Manufactured Home variations
  'manufactured home': 'Manufactured Home',
  'manufactured': 'Manufactured Home',
  'mobile home': 'Manufactured Home',
  'mobile': 'Manufactured Home',
  'modular': 'Manufactured Home',
  
  // Ranch variations (working ranch/farm)
  'ranch': 'Ranch',
  'farm': 'Ranch',
  'farm/ranch': 'Ranch',
  'ranch/farm': 'Ranch',
  'agricultural': 'Ranch',
  
  // Unimproved Land variations
  'unimproved land': 'Land',
  'unimproved': 'Land',
  'vacant land': 'Land',
  'lots and land': 'Land',
  'land': 'Land',
  'lot': 'Land',
  
  // Multiple Lots variations
  'multiple lots': 'Multiple Lots',
  'multiple lots (adjacent)': 'Multiple Lots',
  'adjacent lots': 'Multiple Lots',
  
  // Commercial variations
  'commercial': 'Commercial',
  'retail': 'Commercial',
  'office': 'Commercial',
  'industrial': 'Commercial',
};

/**
 * Property type icons mapping (Lucide icon names)
 */
export const PROPERTY_TYPE_ICONS: Record<string, string> = {
  'Single Family': 'Home',
  'Condo': 'Building2',
  'Townhouse': 'Home',
  'Multi-Family': 'Building',
  'Manufactured Home': 'Container',
  'Ranch': 'Mountain',
  'Land': 'Map',
  'Multiple Lots': 'Grid2X2',
  'Commercial': 'Store',
  'Other': 'HelpCircle',
};

/**
 * Format a raw property sub-type to a standardized display name
 * @param rawType - The raw property type string from API
 * @returns Standardized display name
 */
export function formatPropertyType(rawType: string | null | undefined): string {
  if (!rawType) return 'Other';
  
  const normalized = rawType.toLowerCase().trim();
  
  // Check direct mapping
  if (PROPERTY_TYPE_DISPLAY_MAP[normalized]) {
    return PROPERTY_TYPE_DISPLAY_MAP[normalized];
  }
  
  // Check partial matches
  for (const [key, displayName] of Object.entries(PROPERTY_TYPE_DISPLAY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return displayName;
    }
  }
  
  // Return original with title case if no mapping found
  return rawType.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get a short abbreviation for property type (for compact displays)
 */
export function getPropertyTypeAbbrev(rawType: string | null | undefined): string {
  const formatted = formatPropertyType(rawType);
  
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
 * Get property category for grouping/filtering
 */
export function getPropertyCategory(rawType: string | null | undefined): 'residential' | 'land' | 'commercial' | 'other' {
  const formatted = formatPropertyType(rawType);
  
  if (['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Manufactured Home'].includes(formatted)) {
    return 'residential';
  }
  
  if (['Ranch', 'Land', 'Multiple Lots'].includes(formatted)) {
    return 'land';
  }
  
  if (formatted === 'Commercial') {
    return 'commercial';
  }
  
  return 'other';
}
