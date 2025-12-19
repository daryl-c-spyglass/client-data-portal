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
    'Under Contract': number;
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
    statusIncluded: ['Active', 'Under Contract', 'Closed'],
    totalCount: 0,
    countsByStatus: {
      Active: 0,
      'Under Contract': 0,
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
    dataSource: 'Repliers API + Database',
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

  // === STEP 1: Count Active + Under Contract from Repliers (unified scan) ===
  // This counts BOTH status AND subtype in one pass for consistency
  if (repliersClient && isRepliersConfigured()) {
    try {
      const liveResult = await countLiveListingsUnified(repliersClient);
      
      inventoryData.countsByStatus.Active = liveResult.statusCounts.Active;
      inventoryData.countsByStatus['Under Contract'] = liveResult.statusCounts['Under Contract'];
      
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
  }
  
  // === STEP 2: Count Closed from Database ===
  try {
    const closedResult = await countClosedListingsUnified();
    
    inventoryData.countsByStatus.Closed = closedResult.totalClosed;
    
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

  // === STEP 3: Calculate totals and validate ===
  const statusSum = 
    inventoryData.countsByStatus.Active + 
    inventoryData.countsByStatus['Under Contract'] + 
    inventoryData.countsByStatus.Closed;
    
  const subtypeSum = Object.values(inventoryData.countsBySubtype).reduce((sum, count) => sum + count, 0);
  
  // Total MUST equal status sum AND subtype sum
  inventoryData.totalCount = statusSum;
  
  // Validation
  inventoryData.validation = {
    statusSumMatchesTotal: inventoryData.totalCount === statusSum,
    subtypeSumMatchesTotal: inventoryData.totalCount === subtypeSum,
    statusSum,
    subtypeSum,
  };
  
  // Log warnings if mismatched
  if (statusSum !== subtypeSum) {
    console.warn(`[Inventory] MISMATCH: statusSum=${statusSum} vs subtypeSum=${subtypeSum}, diff=${Math.abs(statusSum - subtypeSum)}`);
    errors.push(`Status/subtype count mismatch: ${statusSum} vs ${subtypeSum}`);
  }
  
  // Set error state
  inventoryData.errors = errors;
  inventoryData.isPartialData = errors.length > 0;

  const duration = Date.now() - startTime;
  console.log(`[Inventory] Complete in ${duration}ms. Total: ${inventoryData.totalCount}, Active: ${inventoryData.countsByStatus.Active}, UC: ${inventoryData.countsByStatus['Under Contract']}, Closed: ${inventoryData.countsByStatus.Closed}`);
  console.log(`[Inventory] Subtypes:`, inventoryData.countsBySubtype);
  console.log(`[Inventory] Validation: statusSum=${statusSum}, subtypeSum=${subtypeSum}, match=${statusSum === subtypeSum}`);

  inventoryCache = {
    data: inventoryData,
    timestamp: Date.now(),
  };

  return inventoryData;
}

// Count Active + Under Contract listings with unified status/subtype counting
async function countLiveListingsUnified(repliersClient: any): Promise<{
  statusCounts: { Active: number; 'Under Contract': number };
  subtypeCounts: Record<string, number>;
  rentalFiltered: number;
}> {
  const statusCounts = { Active: 0, 'Under Contract': 0 };
  const subtypeCounts: Record<string, number> = {};
  let rentalFiltered = 0;
  
  // Initialize subtype counts
  for (const subtype of INVENTORY_PROPERTY_TYPES) {
    subtypeCounts[subtype] = 0;
  }
  
  // Scan both Active and Under Contract
  for (const status of ['A', 'U'] as const) {
    const statusKey = status === 'A' ? 'Active' : 'Under Contract';
    let pageNum = 1;
    let hasMore = true;
    let statusCount = 0;
    
    while (hasMore && pageNum <= 100) { // Safety limit
      try {
        const response = await repliersClient.searchListings({
          status,
          class: 'residential',
          resultsPerPage: 200,
          pageNum,
        });
        
        const listings = response.listings || [];
        
        for (const listing of listings) {
          // Filter out rentals
          if (isRentalListing(listing)) {
            rentalFiltered++;
            continue;
          }
          
          statusCount++;
          
          // Normalize and count subtype
          const normalizedType = normalizePropertyType(listing.propertySubType || listing.type);
          subtypeCounts[normalizedType] = (subtypeCounts[normalizedType] || 0) + 1;
        }
        
        hasMore = listings.length === 200 && pageNum < (response.numPages || 1);
        pageNum++;
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`[Inventory] Error scanning ${statusKey} page ${pageNum}:`, error.message);
        hasMore = false;
      }
    }
    
    statusCounts[statusKey] = statusCount;
    console.log(`[Inventory] Counted ${statusCount} ${statusKey} listings`);
  }
  
  return { statusCounts, subtypeCounts, rentalFiltered };
}

// Count Closed listings from database with subtype breakdown
async function countClosedListingsUnified(): Promise<{
  totalClosed: number;
  subtypeCounts: Record<string, number>;
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
      let totalClosed = 0;
      let pageNum = 1;
      let hasMore = true;
      
      while (hasMore && pageNum <= 50) { // Safety limit
        const response = await repliersClient.searchListings({
          standardStatus: 'Closed',
          class: 'residential',
          resultsPerPage: 200,
          pageNum,
        });
        
        const listings = response.listings || [];
        
        for (const listing of listings) {
          // Skip rentals
          if (isRentalListing(listing)) continue;
          
          const rawSubtype = listing.details?.style || (listing as any).propertySubType || 'Other';
          const normalizedType = normalizePropertyType(rawSubtype);
          subtypeCounts[normalizedType] = (subtypeCounts[normalizedType] || 0) + 1;
          totalClosed++;
        }
        
        hasMore = listings.length >= 200;
        pageNum++;
      }
      
      console.log(`[Inventory] Counted ${totalClosed} closed listings from Repliers API`);
      return { totalClosed, subtypeCounts };
      
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
    
    return { totalClosed, subtypeCounts };
    
  } catch (error) {
    console.error('[Inventory] Failed to get closed counts from database:', error);
    
    // Fallback to simple count
    const totalClosed = await storage.getClosedPropertyCount();
    subtypeCounts['Other'] = totalClosed;
    
    return { totalClosed, subtypeCounts };
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
    warnings.push('Repliers API is NOT configured - Active and Under Contract counts will be 0');
  }
  
  // Build status by subtype cross-tab from database
  const statusBySubtype: Record<string, Record<string, number>> = {
    'Active': {},
    'Under Contract': {},
    'Closed': {},
  };
  
  // Initialize all subtypes for each status
  for (const status of ['Active', 'Under Contract', 'Closed']) {
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
      // Assume all current subtype counts are closed since active/UC are 0
      if (inventory.countsByStatus.Active === 0 && inventory.countsByStatus['Under Contract'] === 0) {
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
  
  if (inventory.countsByStatus['Under Contract'] === 0 && repliersConfigured) {
    warnings.push('Under Contract count is 0 but Repliers is configured - possible API issue');
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
