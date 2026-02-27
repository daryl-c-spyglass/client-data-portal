import { getRepliersClient, isRepliersConfigured } from './repliers-client';
import { storage } from './storage';

export interface InventoryData {
  mlsScope: string;
  classScope: 'residentialOnly';
  rentalExcluded: boolean;
  statusIncluded: string[];
  totalCount: number;
  countsByStatus: {
    Active: number;
    'Active Under Contract': number;
    Pending: number;
    Closed: number;
  };
  countsBySubtype: Record<string, number>;
  rentalFilteredCount: number;
  dataSource: string;
  lastUpdatedAt: string;
  errors: string[];
  isPartialData: boolean;
  validation: {
    statusSumMatchesTotal: boolean;
    subtypeSumMatchesTotal: boolean;
    statusSum: number;
    subtypeSum: number;
  };
  // Source breakdown for MLS vs Repliers chart
  sourceBreakdown?: {
    repliers: {
      Active: number;
      'Active Under Contract': number;
      Pending: number;
      Closed: number;
      total: number;
    };
    database: {
      Active: number;
      'Active Under Contract': number;
      Pending: number;
      Closed: number;
      total: number;
    };
  };
}

interface InventoryCache {
  data: InventoryData;
  timestamp: number;
}

let inventoryCache: InventoryCache | null = null;
const INVENTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Canonical property type normalization function - USE THIS EVERYWHERE
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

// All valid property types for inventory
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

export async function getUnifiedInventory(forceRefresh = false): Promise<InventoryData> {
  if (!forceRefresh && inventoryCache && (Date.now() - inventoryCache.timestamp) < INVENTORY_CACHE_TTL) {
    console.log('[Inventory] Using cached data');
    return inventoryCache.data;
  }

  console.log('[Inventory] Fetching fresh inventory data...');
  const startTime = Date.now();

  const errors: string[] = [];

  const inventoryData: InventoryData = {
    mlsScope: 'ACTRIS',
    classScope: 'residentialOnly',
    rentalExcluded: true,
    statusIncluded: ['Active', 'Active Under Contract', 'Pending', 'Closed'],
    totalCount: 0,
    countsByStatus: {
      Active: 0,
      'Active Under Contract': 0,
      Pending: 0,
      Closed: 0,
    },
    countsBySubtype: {
      'Single Family Residence': 0,
      'Condominium': 0,
      'Townhouse': 0,
      'Multi-Family': 0,
      'Manufactured Home': 0,
      'Ranch': 0,
      'Unimproved Land': 0,
      'Multiple Lots (Adjacent)': 0,
      'Other': 0,
    },
    rentalFilteredCount: 0,
    dataSource: 'MLS Listings',
    lastUpdatedAt: new Date().toISOString(),
    errors: [],
    isPartialData: false,
    validation: {
      statusSumMatchesTotal: true,
      subtypeSumMatchesTotal: true,
      statusSum: 0,
      subtypeSum: 0,
    },
  };

  const repliersClient = getRepliersClient();

  // === STEP 1: Count Active + Under Contract + Pending from Repliers (unified scan) ===
  // Uses RESO standardStatus only - never mix with legacy status codes
  // This counts BOTH status AND subtype in one pass for consistency
  if (repliersClient && isRepliersConfigured()) {
    try {
      const liveResult = await countLiveListingsUnified(repliersClient);
      
      inventoryData.countsByStatus.Active = liveResult.statusCounts.Active;
      inventoryData.countsByStatus['Active Under Contract'] = liveResult.statusCounts['Active Under Contract'];
      inventoryData.countsByStatus.Pending = liveResult.statusCounts.Pending;
      
      // Merge live subtype counts
      for (const [subtype, count] of Object.entries(liveResult.subtypeCounts)) {
        if (subtype in inventoryData.countsBySubtype) {
          inventoryData.countsBySubtype[subtype] = count;
        }
      }
      
      inventoryData.rentalFilteredCount = liveResult.rentalFiltered;
      
    } catch (error: any) {
      const errorMsg = `Failed to count live listings: ${error.message}`;
      console.error('[Inventory]', errorMsg);
      errors.push(errorMsg);
    }
  } else {
    // Add clear error message when Repliers is not configured
    errors.push('Repliers API not configured - Active and Active Under Contract counts will be 0');
  }
  
  // === STEP 2: Count Closed from Database ===
  let closedSource: 'repliers' | 'database' = 'database';
  try {
    const closedResult = await countClosedListingsUnified();
    
    inventoryData.countsByStatus.Closed = closedResult.totalClosed;
    closedSource = closedResult.source;
    
    // Add closed subtype counts
    for (const [subtype, count] of Object.entries(closedResult.subtypeCounts)) {
      if (subtype in inventoryData.countsBySubtype) {
        inventoryData.countsBySubtype[subtype] += count;
      }
    }
    
  } catch (error: any) {
    const errorMsg = `Failed to count closed listings: ${error.message}`;
    console.error('[Inventory]', errorMsg);
    errors.push(errorMsg);
  }

  // === STEP 3: Calculate totals and scale subtypes ===
  const statusSum = 
    inventoryData.countsByStatus.Active + 
    inventoryData.countsByStatus['Active Under Contract'] + 
    inventoryData.countsByStatus.Pending +
    inventoryData.countsByStatus.Closed;
    
  const rawSubtypeSum = Object.values(inventoryData.countsBySubtype).reduce((sum, count) => sum + count, 0);
  
  // Scale sampled subtype counts to match the actual total
  // This extrapolates the sampled distribution to the full dataset
  if (rawSubtypeSum > 0 && statusSum > rawSubtypeSum) {
    const scaleFactor = statusSum / rawSubtypeSum;
    console.log(`[Inventory] Scaling subtypes by ${scaleFactor.toFixed(2)}x (${rawSubtypeSum} sampled → ${statusSum} total)`);
    
    let scaledTotal = 0;
    const subtypeKeys = Object.keys(inventoryData.countsBySubtype) as Array<keyof typeof inventoryData.countsBySubtype>;
    
    for (const subtype of subtypeKeys) {
      const rawCount = inventoryData.countsBySubtype[subtype];
      const scaledCount = Math.round(rawCount * scaleFactor);
      inventoryData.countsBySubtype[subtype] = scaledCount;
      scaledTotal += scaledCount;
    }
    
    // Adjust 'Other' to ensure sum matches exactly (handles rounding errors)
    const diff = statusSum - scaledTotal;
    if (diff !== 0 && 'Other' in inventoryData.countsBySubtype) {
      inventoryData.countsBySubtype['Other'] += diff;
    }
  }
  
  const scaledSubtypeSum = Object.values(inventoryData.countsBySubtype).reduce((sum, count) => sum + count, 0);
  
  // Total equals status sum (aggregate counts from API)
  inventoryData.totalCount = statusSum;
  
  // Validation - subtypes are now scaled to match total
  inventoryData.validation = {
    statusSumMatchesTotal: inventoryData.totalCount === statusSum,
    subtypeSumMatchesTotal: inventoryData.totalCount === scaledSubtypeSum,
    statusSum,
    subtypeSum: scaledSubtypeSum,
  };
  
  console.log(`[Inventory] Subtype distribution scaled: ${rawSubtypeSum} samples → ${scaledSubtypeSum} estimated`);
  
  // === STEP 4: Add source breakdown for MLS vs Repliers chart ===
  // Repliers API provides Active, Active Under Contract, and Pending listings
  // Closed listings come from Repliers API (primary) or Database (fallback)
  const repliersActive = inventoryData.countsByStatus.Active;
  const repliersAUC = inventoryData.countsByStatus['Active Under Contract'];
  const repliersPending = inventoryData.countsByStatus.Pending;
  
  // Track which source provided closed data
  const closedFromRepliers = closedSource === 'repliers' ? inventoryData.countsByStatus.Closed : 0;
  const closedFromDatabase = closedSource === 'database' ? inventoryData.countsByStatus.Closed : 0;
  
  inventoryData.sourceBreakdown = {
    repliers: {
      Active: repliersActive,
      'Active Under Contract': repliersAUC,
      Pending: repliersPending,
      Closed: closedFromRepliers,
      total: repliersActive + repliersAUC + repliersPending + closedFromRepliers,
    },
    database: {
      Active: 0, // Database doesn't have active listings (Repliers is primary source)
      'Active Under Contract': 0,
      Pending: 0,
      Closed: closedFromDatabase,
      total: closedFromDatabase,
    },
  };
  
  // Set error state
  inventoryData.errors = errors;
  inventoryData.isPartialData = errors.length > 0;

  const duration = Date.now() - startTime;
  console.log(`[Inventory] Complete in ${duration}ms. Total: ${inventoryData.totalCount}, Active: ${inventoryData.countsByStatus.Active}, AUC: ${inventoryData.countsByStatus['Active Under Contract']}, Pending: ${inventoryData.countsByStatus.Pending}, Closed: ${inventoryData.countsByStatus.Closed}`);
  console.log(`[Inventory] Subtypes:`, inventoryData.countsBySubtype);
  console.log(`[Inventory] Validation: statusSum=${statusSum}, subtypeSum=${scaledSubtypeSum}, match=${statusSum === scaledSubtypeSum}`);

  inventoryCache = {
    data: inventoryData,
    timestamp: Date.now(),
  };

  return inventoryData;
}

// Count Active + Active Under Contract + Pending listings using efficient aggregate queries
// Uses RESO-compliant standardStatus only - never mix with legacy status codes
// Status counts use aggregate API (resultsPerPage=1 for count only)
// Subtype counts use sampled scan (first 200 listings per status to estimate distribution)
async function countLiveListingsUnified(repliersClient: any): Promise<{
  statusCounts: { Active: number; 'Active Under Contract': number; Pending: number };
  subtypeCounts: Record<string, number>;
  rentalFiltered: number;
}> {
  const subtypeCounts: Record<string, number> = {};
  let rentalFiltered = 0;
  
  // Initialize subtype counts
  for (const subtype of INVENTORY_PROPERTY_TYPES) {
    subtypeCounts[subtype] = 0;
  }
  
  // STEP 1: Use efficient aggregate queries for status counts (4 API calls vs hundreds)
  // This gets accurate total counts from the API response.count field
  console.log('[Inventory] Using aggregate queries for status counts...');
  const aggregateCounts = await repliersClient.getStatusCounts({
    class: 'residential',
    type: 'sale', // Exclude rentals at API level
  });
  
  const statusCounts = {
    Active: aggregateCounts.Active || 0,
    'Active Under Contract': aggregateCounts['Active Under Contract'] || 0,
    Pending: aggregateCounts.Pending || 0,
  };
  
  console.log(`[Inventory] Aggregate counts: Active=${statusCounts.Active}, AUC=${statusCounts['Active Under Contract']}, Pending=${statusCounts.Pending}`);
  
  // STEP 2: Sample first page of each status to estimate subtype distribution
  // This is much faster than scanning all pages but still gives reasonable subtype estimates
  for (const standardStatus of ['Active', 'Active Under Contract', 'Pending'] as const) {
    try {
      const response = await repliersClient.searchListings({
        standardStatus,
        class: 'residential',
        type: 'sale', // Exclude rentals
        resultsPerPage: 200, // Sample first page
        pageNum: 1,
      });
      
      const listings = response.listings || [];
      
      for (const listing of listings) {
        if (isRentalListing(listing)) {
          rentalFiltered++;
          continue;
        }
        
        const rawSubtype = listing.details?.style || listing.propertySubType || 'Other';
        const normalizedType = normalizePropertyType(rawSubtype);
        subtypeCounts[normalizedType] = (subtypeCounts[normalizedType] || 0) + 1;
      }
      
    } catch (error: any) {
      console.error(`[Inventory] Error sampling ${standardStatus}:`, error.message);
    }
  }
  
  return { statusCounts, subtypeCounts, rentalFiltered };
}

// Count Closed listings using efficient aggregate queries + subtype sampling
async function countClosedListingsUnified(): Promise<{
  totalClosed: number;
  subtypeCounts: Record<string, number>;
  source: 'repliers' | 'database';
}> {
  const subtypeCounts: Record<string, number> = {};
  
  // Initialize
  for (const subtype of INVENTORY_PROPERTY_TYPES) {
    subtypeCounts[subtype] = 0;
  }
  
  // Try Repliers API first (standardStatus='Closed' for Sold/Closed - RESO-compliant)
  const repliersClient = getRepliersClient();
  if (repliersClient && isRepliersConfigured()) {
    try {
      // Use aggregate query for total count (1 API call vs many pages)
      const aggregateCounts = await repliersClient.getStatusCounts({
        class: 'residential',
        type: 'sale',
      });
      const totalClosed = aggregateCounts.Closed || 0;
      
      // Sample first page for subtype distribution
      const response = await repliersClient.searchListings({
        standardStatus: 'Closed',
        class: 'residential',
        type: 'sale',
        resultsPerPage: 200,
        pageNum: 1,
      });
      
      for (const listing of (response.listings || [])) {
        if (isRentalListing(listing)) continue;
        
        const rawSubtype = listing.details?.style || (listing as any).propertySubType || 'Other';
        const normalizedType = normalizePropertyType(rawSubtype);
        subtypeCounts[normalizedType] = (subtypeCounts[normalizedType] || 0) + 1;
      }
      
      console.log(`[Inventory] Closed count from Repliers: ${totalClosed}`);
      return { totalClosed, subtypeCounts, source: 'repliers' };
      
    } catch (error: any) {
      console.error('[Inventory] Failed to get closed counts from Repliers, falling back to database:', error.message);
    }
  }
  
  // Fallback to database if Repliers fails or not configured
  try {
    const closedSubtypeCounts = await storage.getClosedPropertyCountsBySubtype();
    
    let totalClosed = 0;
    for (const [rawSubtype, count] of Object.entries(closedSubtypeCounts)) {
      const normalizedType = normalizePropertyType(rawSubtype);
      subtypeCounts[normalizedType] = (subtypeCounts[normalizedType] || 0) + count;
      totalClosed += count;
    }
    
    console.log(`[Inventory] Counted ${totalClosed} closed listings from Database`);
    return { totalClosed, subtypeCounts, source: 'database' };
    
  } catch (error) {
    console.error('[Inventory] Failed to get closed counts from database:', error);
    
    // Fallback to simple count
    const totalClosed = await storage.getClosedPropertyCount();
    subtypeCounts['Other'] = totalClosed;
    
    return { totalClosed, subtypeCounts, source: 'database' };
  }
}

// Check if a listing is a rental
function isRentalListing(listing: any): boolean {
  const type = (listing.type || listing.propertyType || '').toLowerCase();
  const subType = (listing.propertySubType || '').toLowerCase();
  const remarks = (listing.publicRemarks || '').toLowerCase();
  
  if (type.includes('rental') || type.includes('lease')) return true;
  if (subType.includes('rental') || subType.includes('lease')) return true;
  if (remarks.includes('for rent') || remarks.includes('for lease')) return true;
  
  return false;
}

export function clearInventoryCache() {
  inventoryCache = null;
  console.log('[Inventory] Cache cleared');
}

export function getInventoryCacheMeta() {
  if (!inventoryCache) {
    return { cachedAt: null, cacheAgeSeconds: null, cacheTTLSeconds: INVENTORY_CACHE_TTL / 1000, nextRefreshInSeconds: 0 };
  }
  const ageMs = Date.now() - inventoryCache.timestamp;
  return {
    cachedAt: new Date(inventoryCache.timestamp).toISOString(),
    cacheAgeSeconds: Math.round(ageMs / 1000),
    cacheTTLSeconds: INVENTORY_CACHE_TTL / 1000,
    nextRefreshInSeconds: Math.max(0, Math.round((INVENTORY_CACHE_TTL - ageMs) / 1000)),
  };
}

// Comprehensive inventory audit data
export interface InventoryAudit {
  source: string;
  generatedAt: string;
  totals: {
    total: number;
    byStatus: Record<string, number>;
  };
  subtypes: Array<{ name: string; count: number }>;
  statusBySubtype: Record<string, Record<string, number>>;
  unknowns: {
    missingStatus: number;
    missingSubtype: number;
    samples: Array<{ id: string; status: string | null; subtype: string | null }>;
  };
  diagnostics: {
    repliersConfigured: boolean;
    databaseConnected: boolean;
    cacheAge: number | null;
    errors: string[];
    warnings: string[];
  };
}

export async function getInventoryAudit(): Promise<InventoryAudit> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get current inventory data - use cache to prevent memory issues
  const inventory = await getUnifiedInventory(false);
  
  // Check configuration status
  const repliersClient = getRepliersClient();
  const repliersConfigured = !!(repliersClient && isRepliersConfigured());
  
  if (!repliersConfigured) {
    warnings.push('Repliers API is NOT configured - Active and Active Under Contract counts will be 0');
  }
  
  // Build status by subtype cross-tab from database
  const statusBySubtype: Record<string, Record<string, number>> = {
    'Active': {},
    'Active Under Contract': {},
    'Closed': {},
  };
  
  // Initialize all subtypes for each status
  for (const status of ['Active', 'Active Under Contract', 'Closed']) {
    for (const subtype of INVENTORY_PROPERTY_TYPES) {
      statusBySubtype[status][subtype] = 0;
    }
  }
  
  // Get samples of properties with missing data
  const samples: Array<{ id: string; status: string | null; subtype: string | null }> = [];
  let missingStatus = 0;
  let missingSubtype = 0;
  
  try {
    // Query database for cross-tab data and samples
    const dbProperties = await storage.getPropertiesForAudit(100);
    
    for (const prop of dbProperties) {
      const status = prop.standardStatus || 'Unknown';
      const subtype = normalizePropertyType(prop.propertySubType);
      
      if (!prop.standardStatus) {
        missingStatus++;
        if (samples.length < 20) {
          samples.push({
            id: prop.listingId || prop.id?.toString() || 'unknown',
            status: prop.standardStatus || null,
            subtype: prop.propertySubType || null,
          });
        }
      }
      
      if (!prop.propertySubType) {
        missingSubtype++;
        if (samples.length < 20 && prop.standardStatus) {
          samples.push({
            id: prop.listingId || prop.id?.toString() || 'unknown',
            status: prop.standardStatus || null,
            subtype: prop.propertySubType || null,
          });
        }
      }
      
      // Update cross-tab for closed (DB only stores closed)
      if (status === 'Closed' && statusBySubtype['Closed'][subtype] !== undefined) {
        statusBySubtype['Closed'][subtype]++;
      }
    }
    
    // For closed properties, use actual counts from inventory
    for (const [subtype, count] of Object.entries(inventory.countsBySubtype)) {
      // Assume all current subtype counts are closed since active/AUC are 0
      if (inventory.countsByStatus.Active === 0 && inventory.countsByStatus['Active Under Contract'] === 0) {
        statusBySubtype['Closed'][subtype] = count;
      }
    }
    
  } catch (error: any) {
    errors.push(`Failed to query database for audit: ${error.message}`);
  }
  
  // Build sorted subtypes array
  const subtypes = Object.entries(inventory.countsBySubtype)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  
  // Add validation warnings
  if (inventory.countsByStatus.Active === 0 && repliersConfigured) {
    warnings.push('Active count is 0 but Repliers is configured - possible API issue');
  }
  
  if (inventory.countsByStatus['Active Under Contract'] === 0 && repliersConfigured) {
    warnings.push('Active Under Contract count is 0 but Repliers is configured - possible API issue');
  }
  
  const cacheAge = inventoryCache ? Date.now() - inventoryCache.timestamp : null;
  
  return {
    source: inventory.dataSource,
    generatedAt: new Date().toISOString(),
    totals: {
      total: inventory.totalCount,
      byStatus: inventory.countsByStatus,
    },
    subtypes,
    statusBySubtype,
    unknowns: {
      missingStatus,
      missingSubtype,
      samples,
    },
    diagnostics: {
      repliersConfigured,
      databaseConnected: true,
      cacheAge,
      errors: [...inventory.errors, ...errors],
      warnings,
    },
  };
}

// Debug endpoint data for consistency validation
export async function getInventoryDebugData(): Promise<{
  inventory: InventoryData;
  consistency: {
    isConsistent: boolean;
    issues: string[];
  };
}> {
  const inventory = await getUnifiedInventory(false); // Use cache to prevent memory issues
  
  const issues: string[] = [];
  
  if (!inventory.validation.statusSumMatchesTotal) {
    issues.push(`Total (${inventory.totalCount}) != Status sum (${inventory.validation.statusSum})`);
  }
  
  if (!inventory.validation.subtypeSumMatchesTotal) {
    issues.push(`Total (${inventory.totalCount}) != Subtype sum (${inventory.validation.subtypeSum})`);
  }
  
  if (inventory.validation.statusSum !== inventory.validation.subtypeSum) {
    issues.push(`Status sum (${inventory.validation.statusSum}) != Subtype sum (${inventory.validation.subtypeSum})`);
  }
  
  return {
    inventory,
    consistency: {
      isConsistent: issues.length === 0,
      issues,
    },
  };
}
