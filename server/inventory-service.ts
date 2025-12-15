import { getRepliersClient, isRepliersConfigured } from './repliers-client';
import { storage } from './storage';

export interface InventoryData {
  mlsScope: string;
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
}

interface InventoryCache {
  data: InventoryData;
  timestamp: number;
}

let inventoryCache: InventoryCache | null = null;
const INVENTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUnifiedInventory(forceRefresh = false): Promise<InventoryData> {
  if (!forceRefresh && inventoryCache && (Date.now() - inventoryCache.timestamp) < INVENTORY_CACHE_TTL) {
    console.log('[Inventory] Using cached data');
    return inventoryCache.data;
  }

  console.log('[Inventory] Fetching fresh inventory data from Repliers...');
  const startTime = Date.now();

  const errors: string[] = [];

  const inventoryData: InventoryData = {
    mlsScope: 'ACTRIS',
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
    dataSource: 'Repliers API',
    lastUpdatedAt: new Date().toISOString(),
    errors: [],
    isPartialData: false,
  };

  const repliersClient = getRepliersClient();

  if (repliersClient && isRepliersConfigured()) {
    try {
      // Fetch Active count - MUST filter by class: 'residential' to match subtype aggregation
      let activeCount = 0;
      try {
        const activeResponse = await repliersClient.searchListings({ 
          status: 'A', 
          class: 'residential',
          resultsPerPage: 1 
        });
        activeCount = activeResponse.count || 0;
      } catch (error: any) {
        const errorMsg = `Failed to fetch Active count: ${error.message}`;
        console.error('[Inventory]', errorMsg);
        errors.push(errorMsg);
      }
      
      // Small delay between calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Fetch Under Contract count - MUST filter by class: 'residential' to match subtype aggregation
      let ucCount = 0;
      try {
        const ucResponse = await repliersClient.searchListings({ 
          status: 'U', 
          class: 'residential',
          resultsPerPage: 1 
        });
        ucCount = ucResponse.count || 0;
      } catch (error: any) {
        const errorMsg = `Failed to fetch Under Contract count: ${error.message}`;
        console.error('[Inventory]', errorMsg);
        errors.push(errorMsg);
      }
      
      // Fetch database counts - DO NOT silently swallow errors
      let closedCount = 0;
      let subtypeCounts: Record<string, number> = {};
      let closedSubtypeCounts: Record<string, number> = {};

      try {
        closedCount = await storage.getClosedPropertyCount();
      } catch (error: any) {
        const errorMsg = `Failed to fetch Closed count from database: ${error.message}`;
        console.error('[Inventory]', errorMsg);
        errors.push(errorMsg);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        subtypeCounts = await repliersClient.aggregateResidentialSubtypeCounts();
      } catch (error: any) {
        const errorMsg = `Failed to fetch subtype counts from Repliers: ${error.message}`;
        console.error('[Inventory]', errorMsg);
        errors.push(errorMsg);
      }

      try {
        closedSubtypeCounts = await storage.getClosedPropertyCountsBySubtype();
      } catch (error: any) {
        const errorMsg = `Failed to fetch closed subtype counts from database: ${error.message}`;
        console.error('[Inventory]', errorMsg);
        errors.push(errorMsg);
      }

      inventoryData.countsByStatus.Active = activeCount;
      inventoryData.countsByStatus['Under Contract'] = ucCount;
      inventoryData.countsByStatus.Closed = closedCount || 0;
      
      inventoryData.totalCount = 
        inventoryData.countsByStatus.Active + 
        inventoryData.countsByStatus['Under Contract'] + 
        inventoryData.countsByStatus.Closed;

      // Merge Repliers subtypes with closed subtypes from database
      const allSubtypes = [
        'Single Family Residence',
        'Condominium',
        'Townhouse',
        'Multi-Family',
        'Manufactured Home',
        'Ranch',
        'Unimproved Land',
        'Multiple Lots (Adjacent)',
        'Other',
      ];

      const typedSubtypeCounts = subtypeCounts as Record<string, number>;
      const typedClosedSubtypeCounts = closedSubtypeCounts as Record<string, number>;

      for (const subtype of allSubtypes) {
        const repliersCount = typedSubtypeCounts[subtype] || 0;
        const closedSubtypeCount = typedClosedSubtypeCounts[subtype] || 0;
        inventoryData.countsBySubtype[subtype] = repliersCount + closedSubtypeCount;
      }

      // Calculate sum of all subtypes for validation
      const subtypeTotal = Object.values(inventoryData.countsBySubtype).reduce((sum, count) => sum + count, 0);
      const statusTotal = inventoryData.countsByStatus.Active + 
                          inventoryData.countsByStatus['Under Contract'] + 
                          inventoryData.countsByStatus.Closed;
      
      // DESIGN DECISION: Per user requirement, "totalProperties must equal sum(countsByType/Subtype)"
      // The subtype breakdown IS the authoritative breakdown shown in Property Inventory by Type UI.
      // Status counts (Active/UC/Closed) come from Repliers count endpoints and may differ slightly
      // from subtype aggregates due to how Repliers categorizes properties internally.
      // We use subtypeTotal for totalCount to guarantee UI consistency.
      inventoryData.totalCount = subtypeTotal;
      
      // Dev-only debug logging (only in development environment)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Inventory] MLS Scope: ${inventoryData.mlsScope}`);
        console.log(`[Inventory] Counts by status: Active=${inventoryData.countsByStatus.Active}, UC=${inventoryData.countsByStatus['Under Contract']}, Closed=${inventoryData.countsByStatus.Closed}`);
        console.log(`[Inventory] Sum from status counts: ${statusTotal}`);
        console.log(`[Inventory] Sum of subtypes (authoritative): ${subtypeTotal}`);
        console.log(`[Inventory] Counts by subtype:`, inventoryData.countsBySubtype);
        console.log(`[Inventory] Rental filtered count: ${inventoryData.rentalFilteredCount}`);
        
        if (subtypeTotal !== statusTotal) {
          console.warn(`[Inventory] Note: Status sum (${statusTotal}) differs from subtype sum (${subtypeTotal}). This is expected due to Repliers API aggregation differences.`);
        }
      }

    } catch (error: any) {
      const errorMsg = `Critical error fetching from Repliers: ${error.message}`;
      console.error('[Inventory]', errorMsg);
      errors.push(errorMsg);
      inventoryData.dataSource = 'Database (fallback)';
      
      try {
        inventoryData.totalCount = await storage.getPropertyCount();
      } catch (dbError: any) {
        errors.push(`Database fallback failed for totalCount: ${dbError.message}`);
      }
      
      try {
        inventoryData.countsByStatus.Closed = await storage.getClosedPropertyCount();
      } catch (dbError: any) {
        errors.push(`Database fallback failed for closedCount: ${dbError.message}`);
      }
    }
  } else {
    inventoryData.dataSource = 'Database';
    
    try {
      inventoryData.totalCount = await storage.getPropertyCount();
    } catch (error: any) {
      errors.push(`Database query failed for totalCount: ${error.message}`);
    }
    
    try {
      inventoryData.countsByStatus.Closed = await storage.getClosedPropertyCount();
    } catch (error: any) {
      errors.push(`Database query failed for closedCount: ${error.message}`);
    }
  }

  // Set error state
  inventoryData.errors = errors;
  inventoryData.isPartialData = errors.length > 0;

  const duration = Date.now() - startTime;
  console.log(`[Inventory] Fetch complete in ${duration}ms. Total: ${inventoryData.totalCount}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`);

  inventoryCache = {
    data: inventoryData,
    timestamp: Date.now(),
  };

  return inventoryData;
}

export function clearInventoryCache() {
  inventoryCache = null;
  console.log('[Inventory] Cache cleared');
}

// Debug endpoint data for side-by-side comparison
export async function getInventoryDebugData(): Promise<{
  inventory: InventoryData;
  validation: {
    totalMatchesSubtypeSum: boolean;
    subtypeSum: number;
    statusSum: number;
    discrepancy: number;
  };
}> {
  const inventory = await getUnifiedInventory(true); // Force refresh for debug
  
  const subtypeSum = Object.values(inventory.countsBySubtype).reduce((sum, count) => sum + count, 0);
  const statusSum = inventory.countsByStatus.Active + 
                    inventory.countsByStatus['Under Contract'] + 
                    inventory.countsByStatus.Closed;
  
  return {
    inventory,
    validation: {
      totalMatchesSubtypeSum: inventory.totalCount === subtypeSum,
      subtypeSum,
      statusSum,
      discrepancy: Math.abs(subtypeSum - statusSum),
    },
  };
}
