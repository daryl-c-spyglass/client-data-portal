import { neighborhoodBoundaries, properties, type Property } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { getRepliersClient, LocationWithBoundary } from './repliers-client';

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    _db = drizzle(_pool);
  }
  return _db!;
}

const CACHE_TTL_HOURS = 24;

interface NeighborhoodMarketStats {
  neighborhoodName: string;
  boundary: number[][][] | null;
  centerLat: number | null;
  centerLng: number | null;
  stats: {
    activeCount: number;
    underContractCount: number;
    soldCount: number;
    avgListPrice: number | null;
    avgSoldPrice: number | null;
    avgPricePerSqFt: number | null;
    avgDaysOnMarket: number | null;
    medianListPrice: number | null;
    medianSoldPrice: number | null;
  };
  listings: {
    active: any[];
    underContract: any[];
    sold: any[];
  };
}

export class NeighborhoodService {
  async getCachedBoundary(name: string, city?: string): Promise<typeof neighborhoodBoundaries.$inferSelect | null> {
    const db = getDb();
    const conditions = [eq(neighborhoodBoundaries.name, name)];
    if (city) {
      conditions.push(eq(neighborhoodBoundaries.city, city));
    }
    
    const results = await db
      .select()
      .from(neighborhoodBoundaries)
      .where(and(...conditions))
      .limit(1);
    
    if (results.length === 0) return null;
    
    const cached = results[0];
    if (cached.expiresAt && new Date() > cached.expiresAt) {
      return null;
    }
    
    return cached;
  }

  async saveBoundaryToCache(location: LocationWithBoundary): Promise<void> {
    if (!location.neighborhood || !location.map?.boundary) return;
    
    const db = getDb();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);
    
    const centerLat = location.map.latitude?.toString() || null;
    const centerLng = location.map.longitude?.toString() || null;
    
    // Check if entry exists (regardless of expiration)
    const conditions = [eq(neighborhoodBoundaries.name, location.neighborhood)];
    if (location.city) {
      conditions.push(eq(neighborhoodBoundaries.city, location.city));
    }
    
    const existing = await db
      .select({ id: neighborhoodBoundaries.id })
      .from(neighborhoodBoundaries)
      .where(and(...conditions))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing entry with fresh data and TTL
      await db.update(neighborhoodBoundaries)
        .set({
          boundary: location.map.boundary,
          centerLatitude: centerLat,
          centerLongitude: centerLng,
          area: location.area || null,
          expiresAt,
          fetchedAt: new Date(),
        })
        .where(eq(neighborhoodBoundaries.id, existing[0].id));
    } else {
      // Insert new entry
      await db.insert(neighborhoodBoundaries).values({
        name: location.neighborhood,
        city: location.city || null,
        area: location.area || null,
        boundary: location.map.boundary,
        centerLatitude: centerLat,
        centerLongitude: centerLng,
        expiresAt,
      });
    }
  }

  async findNeighborhoodByCoordinates(
    latitude: number,
    longitude: number,
    city?: string
  ): Promise<LocationWithBoundary | null> {
    const client = getRepliersClient();
    if (!client) {
      console.warn('Repliers client not configured');
      return null;
    }
    
    const neighborhood = await client.findNeighborhoodByPoint(latitude, longitude, city);
    if (neighborhood) {
      await this.saveBoundaryToCache(neighborhood);
    }
    return neighborhood;
  }

  async getNeighborhoodBoundary(
    neighborhoodName: string,
    city?: string
  ): Promise<{ boundary: number[][][] | null; centerLat: number | null; centerLng: number | null }> {
    const cached = await this.getCachedBoundary(neighborhoodName, city);
    if (cached) {
      return {
        boundary: cached.boundary as number[][][] | null,
        centerLat: cached.centerLatitude ? parseFloat(cached.centerLatitude) : null,
        centerLng: cached.centerLongitude ? parseFloat(cached.centerLongitude) : null,
      };
    }
    
    const client = getRepliersClient();
    if (!client) {
      return { boundary: null, centerLat: null, centerLng: null };
    }
    
    const locations = await client.getLocationsWithBoundaries({
      search: neighborhoodName,
      city,
      class: 'neighborhood',
    });
    
    const match = locations.find(
      (loc) => loc.neighborhood?.toLowerCase() === neighborhoodName.toLowerCase()
    );
    
    if (match) {
      await this.saveBoundaryToCache(match);
      return {
        boundary: match.map?.boundary || null,
        centerLat: match.map?.latitude || null,
        centerLng: match.map?.longitude || null,
      };
    }
    
    return { boundary: null, centerLat: null, centerLng: null };
  }

  async getNeighborhoodMarketStats(
    neighborhoodName: string,
    city?: string,
    months: number = 6
  ): Promise<NeighborhoodMarketStats> {
    const boundaryInfo = await this.getNeighborhoodBoundary(neighborhoodName, city);
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    const db = getDb();
    const conditions = [
      eq(properties.neighborhood, neighborhoodName),
    ];
    if (city) {
      conditions.push(eq(properties.city, city));
    }
    
    const allListings = await db
      .select()
      .from(properties)
      .where(and(...conditions));
    
    const active = allListings.filter((p) => p.standardStatus === 'Active');
    const underContract = allListings.filter(
      (p) => p.standardStatus === 'Active Under Contract' || p.standardStatus === 'Pending'
    );
    const sold = allListings.filter(
      (p) => p.standardStatus === 'Closed' && 
             p.closeDate && 
             new Date(p.closeDate) >= cutoffDate
    );
    
    const listPrices = [...active, ...underContract]
      .map((p) => p.listPrice ? parseFloat(p.listPrice) : null)
      .filter((p): p is number => p !== null && p > 0);
    
    const soldPrices = sold
      .map((p) => p.closePrice ? parseFloat(p.closePrice) : null)
      .filter((p): p is number => p !== null && p > 0);
    
    const pricePerSqFtValues = [...active, ...underContract, ...sold]
      .map((p) => {
        const price = p.closePrice ? parseFloat(p.closePrice) : (p.listPrice ? parseFloat(p.listPrice) : null);
        const sqft = p.livingArea ? parseFloat(p.livingArea) : null;
        if (price && sqft && sqft > 0) {
          return price / sqft;
        }
        return null;
      })
      .filter((p): p is number => p !== null);
    
    const domValues = sold
      .map((p) => p.daysOnMarket)
      .filter((d): d is number => d !== null && d >= 0);
    
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const median = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    
    return {
      neighborhoodName,
      boundary: boundaryInfo.boundary,
      centerLat: boundaryInfo.centerLat,
      centerLng: boundaryInfo.centerLng,
      stats: {
        activeCount: active.length,
        underContractCount: underContract.length,
        soldCount: sold.length,
        avgListPrice: avg(listPrices),
        avgSoldPrice: avg(soldPrices),
        avgPricePerSqFt: avg(pricePerSqFtValues),
        avgDaysOnMarket: avg(domValues),
        medianListPrice: median(listPrices),
        medianSoldPrice: median(soldPrices),
      },
      listings: {
        active: active.slice(0, 20),
        underContract: underContract.slice(0, 20),
        sold: sold.slice(0, 20),
      },
    };
  }

  async getNeighborhoodMarketStatsFromRepliers(
    neighborhoodName: string,
    boundary: number[][][],
    city?: string,
    months: number = 6
  ): Promise<NeighborhoodMarketStats> {
    const client = getRepliersClient();
    if (!client) {
      return {
        neighborhoodName,
        boundary,
        centerLat: null,
        centerLng: null,
        stats: {
          activeCount: 0,
          underContractCount: 0,
          soldCount: 0,
          avgListPrice: null,
          avgSoldPrice: null,
          avgPricePerSqFt: null,
          avgDaysOnMarket: null,
          medianListPrice: null,
          medianSoldPrice: null,
        },
        listings: { active: [], underContract: [], sold: [] },
      };
    }
    
    const activeResponse = await client.searchListingsInBoundary(boundary, {
      standardStatus: 'Active',
      class: 'residential',
      resultsPerPage: 50,
    });
    
    const ucResponse = await client.searchListingsInBoundary(boundary, {
      standardStatus: 'Pending',
      class: 'residential',
      resultsPerPage: 50,
    });
    
    const active = (activeResponse.listings || []).map((l: any) => client.mapToStandardProperty(l));
    const underContract = (ucResponse.listings || []).map((l: any) => client.mapToStandardProperty(l));
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    const db = getDb();
    const soldFromDb = await db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.standardStatus, 'Closed'),
          gte(properties.closeDate, cutoffDate),
          eq(properties.neighborhood, neighborhoodName)
        )
      )
      .limit(50);
    
    const listPrices = [...active, ...underContract]
      .map((p) => p.listPrice)
      .filter((p): p is number => p !== null && p > 0);
    
    const soldPrices = soldFromDb
      .map((p) => p.closePrice ? parseFloat(p.closePrice) : null)
      .filter((p): p is number => p !== null && p > 0);
    
    const pricePerSqFtValues = [...active, ...underContract, ...soldFromDb]
      .map((p) => {
        const price = (p as any).closePrice 
          ? parseFloat((p as any).closePrice) 
          : ((p as any).listPrice ? parseFloat((p as any).listPrice) : null);
        const sqft = (p as any).livingArea ? parseFloat((p as any).livingArea) : null;
        if (price && sqft && sqft > 0) {
          return price / sqft;
        }
        return null;
      })
      .filter((p): p is number => p !== null);
    
    const domValues = soldFromDb
      .map((p) => p.daysOnMarket)
      .filter((d): d is number => d !== null && d >= 0);
    
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const median = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    
    let centerLat: number | null = null;
    let centerLng: number | null = null;
    if (boundary[0] && boundary[0].length > 0) {
      const lats = boundary[0].map((c) => c[1]);
      const lngs = boundary[0].map((c) => c[0]);
      centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    }
    
    return {
      neighborhoodName,
      boundary,
      centerLat,
      centerLng,
      stats: {
        activeCount: active.length,
        underContractCount: underContract.length,
        soldCount: soldFromDb.length,
        avgListPrice: avg(listPrices),
        avgSoldPrice: avg(soldPrices),
        avgPricePerSqFt: avg(pricePerSqFtValues),
        avgDaysOnMarket: avg(domValues),
        medianListPrice: median(listPrices),
        medianSoldPrice: median(soldPrices),
      },
      listings: {
        active: active.slice(0, 20),
        underContract: underContract.slice(0, 20),
        sold: soldFromDb.slice(0, 20),
      },
    };
  }
}

export const neighborhoodService = new NeighborhoodService();
