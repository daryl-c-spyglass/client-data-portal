import { getRepliersClient, isRepliersConfigured } from './repliers-client';
import { storage } from './storage';

export interface InventoryData {
  totalCount: number;
  countsByStatus: {
    Active: number;
    'Under Contract': number;
    Closed: number;
  };
  countsBySubtype: Record<string, number>;
  dataSource: string;
  lastUpdatedAt: string;
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

  const inventoryData: InventoryData = {
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
    dataSource: 'Repliers API',
    lastUpdatedAt: new Date().toISOString(),
  };

  const repliersClient = getRepliersClient();

  if (repliersClient && isRepliersConfigured()) {
    try {
      const [activeResponse, ucResponse, closedCount, subtypeCounts, closedSubtypeCounts] = await Promise.all([
        repliersClient.searchListings({ status: 'A', resultsPerPage: 1 }).catch(() => ({ count: 0 })),
        repliersClient.searchListings({ status: 'U', resultsPerPage: 1 }).catch(() => ({ count: 0 })),
        storage.getClosedPropertyCount().catch(() => 0),
        repliersClient.aggregateResidentialSubtypeCounts().catch(() => ({})),
        storage.getClosedPropertyCountsBySubtype().catch(() => ({})),
      ]);

      inventoryData.countsByStatus.Active = activeResponse.count || 0;
      inventoryData.countsByStatus['Under Contract'] = ucResponse.count || 0;
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

      // Log inventory for debugging
      console.log(`[Inventory] Counts by status: Active=${inventoryData.countsByStatus.Active}, UC=${inventoryData.countsByStatus['Under Contract']}, Closed=${inventoryData.countsByStatus.Closed}`);
      console.log(`[Inventory] Counts by subtype:`, inventoryData.countsBySubtype);

    } catch (error) {
      console.error('[Inventory] Error fetching from Repliers:', error);
      inventoryData.dataSource = 'Database (fallback)';
      inventoryData.totalCount = await storage.getPropertyCount().catch(() => 0);
      inventoryData.countsByStatus.Closed = await storage.getClosedPropertyCount().catch(() => 0);
    }
  } else {
    inventoryData.dataSource = 'Database';
    inventoryData.totalCount = await storage.getPropertyCount().catch(() => 0);
    inventoryData.countsByStatus.Closed = await storage.getClosedPropertyCount().catch(() => 0);
  }

  const duration = Date.now() - startTime;
  console.log(`[Inventory] Fetch complete in ${duration}ms. Total: ${inventoryData.totalCount}`);

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
