/**
 * Property Type Guard - Server-Side Property Classification Filter
 * 
 * ROOT CAUSE: Repliers API uses 'class' parameter which only supports broad categories
 * (residential, condo, commercial). Within 'residential', Land/Lots are included.
 * When user selects "Single Family", we must post-filter to exclude Land/Lots.
 * 
 * This guard is used by ALL listing queries to ensure consistent property type filtering:
 * - /api/search (unified search)
 * - /api/properties/search/polygon (map polygon search)
 * - CMA queries
 * - Dashboard counts
 */

// Land/Lot indicators - if any of these appear in propertyType/propertySubType, it's land
export const LAND_INDICATORS = [
  'land',
  'lot',
  'lots',
  'acreage',
  'unimproved',
  'vacant',
  'vacant land',
  'residential lot',
  'residential lots',
  'farm/ranch',
  'agricultural',
] as const;

// UI property type selections and what they should exclude
export const PROPERTY_TYPE_EXCLUSIONS: Record<string, string[]> = {
  'single-family': LAND_INDICATORS as unknown as string[],
  'single family': LAND_INDICATORS as unknown as string[],
  'single family residence': LAND_INDICATORS as unknown as string[],  // Matches UI dropdown value
  'single_family': LAND_INDICATORS as unknown as string[],
  'sfr': LAND_INDICATORS as unknown as string[],
  'detached': LAND_INDICATORS as unknown as string[],
  'condo': LAND_INDICATORS as unknown as string[],
  'condominium': LAND_INDICATORS as unknown as string[],
  'townhouse': LAND_INDICATORS as unknown as string[],
  'townhome': LAND_INDICATORS as unknown as string[],
  'multi-family': LAND_INDICATORS as unknown as string[],
  'multifamily': LAND_INDICATORS as unknown as string[],
  'duplex': LAND_INDICATORS as unknown as string[],
  'triplex': LAND_INDICATORS as unknown as string[],
  'manufactured': LAND_INDICATORS as unknown as string[],
  'mobile': LAND_INDICATORS as unknown as string[],
};

// What UI selections map to for Repliers class parameter
export const UI_TO_REPLIERS_CLASS: Record<string, string> = {
  'single-family': 'residential',
  'single family': 'residential',
  'single_family': 'residential',
  'sfr': 'residential',
  'detached': 'residential',
  'condo': 'condo',
  'condominium': 'condo',
  'townhouse': 'residential',
  'townhome': 'residential',
  'multi-family': 'residential',
  'multifamily': 'residential',
  'duplex': 'residential',
  'triplex': 'residential',
  'manufactured': 'residential',
  'mobile': 'residential',
  'land': 'residential',
  'lots': 'residential',
  'ranch': 'residential',
  'farm': 'residential',
};

/**
 * Check if a listing is a Land/Lot based on its type fields
 */
export function isLandOrLot(listing: {
  propertyType?: string | null;
  propertySubType?: string | null;
  style?: string | null;
  class?: string | null;
  details?: {
    propertyType?: string | null;
    style?: string | null;
  } | null;
  raw?: any;
}): boolean {
  // Combine all relevant fields
  const fields = [
    listing.propertyType,
    listing.propertySubType,
    listing.style,
    listing.class,
    listing.details?.propertyType,
    listing.details?.style,
    listing.raw?.propertyType,
    listing.raw?.propertySubType,
    listing.raw?.PropertyType,
    listing.raw?.PropertySubType,
  ].filter(Boolean).map(s => (s as string).toLowerCase());
  
  const combined = fields.join(' ');
  
  // Check for land indicators
  for (const indicator of LAND_INDICATORS) {
    if (combined.includes(indicator)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a listing matches the requested property subtype
 */
export function matchesPropertySubtype(
  listing: {
    propertyType?: string | null;
    propertySubType?: string | null;
    style?: string | null;
    details?: {
      propertyType?: string | null;
      style?: string | null;
    } | null;
  },
  requestedSubtype: string
): boolean {
  const subtypeLower = requestedSubtype.toLowerCase().trim();
  
  // Get all relevant type fields
  const fields = [
    listing.propertySubType,
    listing.propertyType,
    listing.style,
    listing.details?.propertyType,
    listing.details?.style,
  ].filter(Boolean).map(s => (s as string).toLowerCase());
  
  const combined = fields.join(' ');
  
  // Handle different subtype patterns
  // Note: UI dropdown sends "Single Family Residence", so must check for that too
  if (subtypeLower === 'single-family' || subtypeLower === 'single family' || 
      subtypeLower === 'single family residence' || subtypeLower === 'sfr') {
    // Must have explicit Single Family markers AND not be land/condo/multi/townhouse/manufactured
    // CRITICAL: Do NOT match generic "residential" or "residence" - it includes all property types
    // We specifically match "single family residence" (which has 'single family' in it) but NOT just 'residence'
    const hasSingleFamilyMarker = combined.includes('single family') || 
                                   combined.includes('single-family') ||
                                   combined.includes('sfr') ||
                                   combined.includes('single fam') ||
                                   combined.includes('detached');
    
    // Exclude non-single-family types using PRECISE patterns (word boundaries)
    // Avoid false negatives: "multi-level single family" should NOT be excluded
    // Use regex word boundaries or specific phrase matching
    const isExcludedType = 
      // Condo/condominium
      /\bcondo(minium)?\b/i.test(combined) ||
      // Townhouse/townhome - but NOT "single family with attached garage"
      (/\btownhou?se?\b/i.test(combined) || /\btownhome\b/i.test(combined)) ||
      // Multi-family (not multi-level, multi-story)
      /\bmulti[- ]?family\b/i.test(combined) ||
      // Duplex/triplex/fourplex
      /\b(duplex|triplex|fourplex|quadplex)\b/i.test(combined) ||
      // Manufactured/mobile home
      /\b(manufactured|mobile|modular)\s*(home|house)?\b/i.test(combined);
    
    return hasSingleFamilyMarker && !isLandOrLot(listing) && !isExcludedType;
  }
  
  if (subtypeLower === 'condo' || subtypeLower === 'condominium') {
    return combined.includes('condo') || combined.includes('condominium');
  }
  
  if (subtypeLower === 'townhouse' || subtypeLower === 'townhome') {
    return combined.includes('townhouse') || combined.includes('townhome') || combined.includes('attached');
  }
  
  if (subtypeLower === 'multi-family' || subtypeLower === 'multifamily') {
    return combined.includes('multi') || combined.includes('duplex') || 
           combined.includes('triplex') || combined.includes('fourplex');
  }
  
  if (subtypeLower === 'manufactured' || subtypeLower === 'mobile') {
    return combined.includes('manufactured') || combined.includes('mobile') || combined.includes('modular');
  }
  
  if (subtypeLower === 'land' || subtypeLower === 'lots') {
    return isLandOrLot(listing);
  }
  
  if (subtypeLower === 'ranch' || subtypeLower === 'farm') {
    return combined.includes('ranch') || combined.includes('farm') || combined.includes('agricultural');
  }
  
  // Default: check if any field contains the requested subtype
  return combined.includes(subtypeLower);
}

/**
 * Filter listings by property subtype - the main guard function
 * Use this after fetching from Repliers API to apply subtype filtering
 */
export function filterByPropertySubtype<T extends {
  propertyType?: string | null;
  propertySubType?: string | null;
  style?: string | null;
  details?: {
    propertyType?: string | null;
    style?: string | null;
  } | null;
  raw?: any;
}>(
  listings: T[],
  requestedSubtype: string | null | undefined
): T[] {
  if (!requestedSubtype) {
    return listings;
  }
  
  const subtypeLower = requestedSubtype.toLowerCase().trim();
  
  // Special handling for "all" or empty - return all
  if (!subtypeLower || subtypeLower === 'all' || subtypeLower === 'any') {
    return listings;
  }
  
  console.log(`[PropertyTypeGuard] Filtering ${listings.length} listings for subtype: "${requestedSubtype}"`);
  
  const filtered = listings.filter(listing => matchesPropertySubtype(listing, requestedSubtype));
  
  const excluded = listings.length - filtered.length;
  if (excluded > 0) {
    console.log(`[PropertyTypeGuard] Excluded ${excluded} listings that didn't match subtype "${requestedSubtype}"`);
  }
  
  return filtered;
}

/**
 * Exclude Land/Lots from listings (for when subtype is any residential type)
 */
export function excludeLandLots<T extends {
  propertyType?: string | null;
  propertySubType?: string | null;
  style?: string | null;
  details?: {
    propertyType?: string | null;
    style?: string | null;
  } | null;
  raw?: any;
}>(
  listings: T[],
  requestedSubtype: string | null | undefined
): T[] {
  // Only exclude land if a specific non-land subtype is requested
  if (!requestedSubtype) {
    return listings;
  }
  
  const subtypeLower = requestedSubtype.toLowerCase().trim();
  
  // If explicitly requesting land, don't exclude
  if (subtypeLower === 'land' || subtypeLower === 'lots' || 
      subtypeLower === 'unimproved' || subtypeLower === 'vacant') {
    return listings;
  }
  
  // For residential subtypes, exclude land
  if (subtypeLower in PROPERTY_TYPE_EXCLUSIONS) {
    const before = listings.length;
    const filtered = listings.filter(listing => !isLandOrLot(listing));
    const excluded = before - filtered.length;
    if (excluded > 0) {
      console.log(`[PropertyTypeGuard] Excluded ${excluded} Land/Lot listings for subtype "${requestedSubtype}"`);
    }
    return filtered;
  }
  
  return listings;
}

/**
 * Build Repliers API query parameters for property type
 * Returns the class parameter and any needed post-filter flags
 */
export function buildPropertyTypeParams(uiSelection: string | null | undefined): {
  class: string;
  needsSubtypeFilter: boolean;
  subtypeFilter: string | null;
} {
  if (!uiSelection) {
    return { class: 'residential', needsSubtypeFilter: false, subtypeFilter: null };
  }
  
  const selectionLower = uiSelection.toLowerCase().trim();
  
  // Determine Repliers class
  const repliersClass = UI_TO_REPLIERS_CLASS[selectionLower] || 'residential';
  
  // Check if we need post-fetch subtype filtering
  const needsSubtypeFilter = selectionLower !== 'all' && 
                              selectionLower !== 'any' && 
                              selectionLower !== 'residential';
  
  return {
    class: repliersClass,
    needsSubtypeFilter,
    subtypeFilter: needsSubtypeFilter ? uiSelection : null,
  };
}

/**
 * Diagnostic helper - get property type info for debugging
 */
export function getPropertyTypeInfo(listing: any): {
  propertyType: string | null;
  propertySubType: string | null;
  style: string | null;
  detailsType: string | null;
  detailsStyle: string | null;
  rawType: string | null;
  rawSubType: string | null;
  isLand: boolean;
  classification: string;
} {
  return {
    propertyType: listing.propertyType || null,
    propertySubType: listing.propertySubType || null,
    style: listing.style || null,
    detailsType: listing.details?.propertyType || null,
    detailsStyle: listing.details?.style || null,
    rawType: listing.raw?.propertyType || listing.raw?.PropertyType || null,
    rawSubType: listing.raw?.propertySubType || listing.raw?.PropertySubType || null,
    isLand: isLandOrLot(listing),
    classification: classifyPropertyType(listing),
  };
}

/**
 * Classify a listing into a canonical property type
 */
export function classifyPropertyType(listing: any): string {
  const combined = [
    listing.propertyType,
    listing.propertySubType,
    listing.style,
    listing.details?.propertyType,
    listing.details?.style,
    listing.raw?.propertyType,
    listing.raw?.propertySubType,
  ].filter(Boolean).join(' ').toLowerCase();
  
  if (isLandOrLot(listing)) {
    if (combined.includes('multiple') || combined.includes('adjacent')) {
      return 'Multiple Lots (Adjacent)';
    }
    return 'Unimproved Land';
  }
  
  if (combined.includes('manufactured') || combined.includes('mobile') || combined.includes('modular')) {
    return 'Manufactured Home';
  }
  
  if (combined.includes('condo') || combined.includes('condominium')) {
    return 'Condominium';
  }
  
  if (combined.includes('townhouse') || combined.includes('townhome') || combined.includes('attached')) {
    return 'Townhouse';
  }
  
  if (combined.includes('multi') || combined.includes('duplex') || 
      combined.includes('triplex') || combined.includes('fourplex')) {
    return 'Multi-Family';
  }
  
  if (combined.includes('ranch') || combined.includes('farm')) {
    return 'Ranch';
  }
  
  // Default to Single Family for residential
  return 'Single Family Residence';
}
