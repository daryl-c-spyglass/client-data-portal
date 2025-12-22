/**
 * Canonical Listing Service
 * 
 * The unified data layer for all listing operations.
 * Aggregates data from MLS Grid, Repliers API, and Database with deterministic deduplication.
 */

import { 
  CanonicalListing, 
  calculateDuplicateScore, 
  mergeListings, 
  determinePrimarySource,
  ListingSource,
  generateCanonicalId,
} from '../../../shared/canonical-listing';
import { mapRepliersToCanonical, mapRepliersListingsToCanonical } from './repliers-mapper';
import { getRepliersClient, isRepliersConfigured } from '../../repliers-client';
import { storage } from '../../storage';
import { normalizeStatus, getStandardStatusLabel } from '../../../shared/statusMapping';
import { normalizePropertyType } from '../../inventory-service';

const DUPLICATE_THRESHOLD = 0.7;

interface ListingSearchParams {
  status?: string | string[];
  standardStatus?: string | string[];
  city?: string;
  postalCode?: string;
  subdivision?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  propertyType?: string;
  limit?: number;
  offset?: number;
  includeRaw?: boolean;
  sources?: ListingSource[];
}

interface ListingServiceResult {
  listings: CanonicalListing[];
  total: number;
  dedupeStats: {
    beforeDedupe: number;
    afterDedupe: number;
    duplicatesRemoved: number;
    sourceBreakdown: Record<ListingSource, number>;
  };
  errors: string[];
}

interface DedupeReport {
  totalProcessed: number;
  uniqueListings: number;
  duplicatesFound: number;
  duplicatePairs: Array<{
    primaryId: string;
    duplicateId: string;
    score: number;
    matchReason: string;
  }>;
  sourceStats: Record<ListingSource, number>;
}

/**
 * Canonical Listing Service - singleton pattern for caching
 */
class CanonicalListingServiceImpl {
  private cache: Map<string, { data: CanonicalListing[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch listings from all configured sources with deduplication
   */
  async fetchListings(params: ListingSearchParams = {}): Promise<ListingServiceResult> {
    const errors: string[] = [];
    const allListings: CanonicalListing[] = [];
    const sourceBreakdown: Record<ListingSource, number> = {
      'MLS': 0,
      'REPLIERS': 0,
      'DATABASE': 0,
    };

    const sources = params.sources || ['REPLIERS', 'DATABASE'];

    // Fetch from Repliers API
    if (sources.includes('REPLIERS') && isRepliersConfigured()) {
      try {
        const repliersListings = await this.fetchFromRepliers(params);
        allListings.push(...repliersListings);
        sourceBreakdown['REPLIERS'] = repliersListings.length;
      } catch (error: any) {
        errors.push(`Repliers API error: ${error.message}`);
      }
    }

    // Fetch from Database (for closed listings or as fallback)
    if (sources.includes('DATABASE')) {
      try {
        const dbListings = await this.fetchFromDatabase(params);
        allListings.push(...dbListings);
        sourceBreakdown['DATABASE'] = dbListings.length;
      } catch (error: any) {
        errors.push(`Database error: ${error.message}`);
      }
    }

    // Deduplicate
    const beforeDedupe = allListings.length;
    const deduped = this.deduplicateListings(allListings);
    const afterDedupe = deduped.length;

    return {
      listings: deduped,
      total: deduped.length,
      dedupeStats: {
        beforeDedupe,
        afterDedupe,
        duplicatesRemoved: beforeDedupe - afterDedupe,
        sourceBreakdown,
      },
      errors,
    };
  }

  /**
   * Fetch listings from Repliers API
   */
  private async fetchFromRepliers(params: ListingSearchParams): Promise<CanonicalListing[]> {
    const client = getRepliersClient();
    if (!client) return [];

    const searchParams: Record<string, any> = {
      resultsPerPage: params.limit || 100,
      pageNum: Math.floor((params.offset || 0) / (params.limit || 100)) + 1,
    };

    // Map status parameters
    if (params.standardStatus) {
      const statuses = Array.isArray(params.standardStatus) 
        ? params.standardStatus 
        : [params.standardStatus];
      searchParams.standardStatus = statuses[0];
    } else if (params.status) {
      const statuses = Array.isArray(params.status) 
        ? params.status 
        : [params.status];
      searchParams.status = statuses[0];
    }

    // Add other search criteria
    if (params.city) searchParams.city = params.city;
    if (params.postalCode) searchParams.postalCode = params.postalCode;
    if (params.subdivision) searchParams.subdivision = params.subdivision;
    if (params.neighborhood) searchParams.neighborhood = params.neighborhood;
    if (params.minPrice) searchParams.minPrice = params.minPrice;
    if (params.maxPrice) searchParams.maxPrice = params.maxPrice;
    if (params.minBeds) searchParams.minBeds = params.minBeds;
    if (params.maxBeds) searchParams.maxBeds = params.maxBeds;
    if (params.minBaths) searchParams.minBaths = params.minBaths;
    if (params.maxBaths) searchParams.maxBaths = params.maxBaths;
    if (params.minSqft) searchParams.minSqft = params.minSqft;
    if (params.maxSqft) searchParams.maxSqft = params.maxSqft;

    // Request raw fields if needed
    if (params.includeRaw) {
      searchParams.fields = 'raw';
    }

    try {
      const response = await client.searchListings(searchParams);
      const listings = response.listings || [];
      return mapRepliersListingsToCanonical(listings, params.includeRaw);
    } catch (error) {
      console.error('[CanonicalService] Repliers fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch listings from Database
   */
  private async fetchFromDatabase(params: ListingSearchParams): Promise<CanonicalListing[]> {
    try {
      // Use existing searchProperties interface
      const filters: {
        city?: string;
        postalCode?: string;
        minPrice?: number;
        maxPrice?: number;
        minBeds?: number;
        minBaths?: number;
        minSqft?: number;
        maxSqft?: number;
        subdivision?: string;
        status?: string;
        limit?: number;
      } = {
        limit: params.limit || 100,
      };
      
      if (params.standardStatus) {
        const statuses = Array.isArray(params.standardStatus) 
          ? params.standardStatus 
          : [params.standardStatus];
        filters.status = statuses[0];
      }
      
      if (params.city) filters.city = params.city;
      if (params.postalCode) filters.postalCode = params.postalCode;
      if (params.subdivision) filters.subdivision = params.subdivision;
      if (params.minPrice) filters.minPrice = params.minPrice;
      if (params.maxPrice) filters.maxPrice = params.maxPrice;
      if (params.minBeds) filters.minBeds = params.minBeds;
      if (params.minBaths) filters.minBaths = params.minBaths;
      if (params.minSqft) filters.minSqft = params.minSqft;
      if (params.maxSqft) filters.maxSqft = params.maxSqft;
      
      const dbProperties = await storage.searchProperties(filters);
      
      return dbProperties.map((prop: any) => this.mapDatabaseToCanonical(prop));
    } catch (error) {
      console.error('[CanonicalService] Database fetch error:', error);
      throw error;
    }
  }

  /**
   * Map a database property to canonical format
   */
  private mapDatabaseToCanonical(prop: any): CanonicalListing {
    const normalizedStatus = normalizeStatus(prop.standardStatus);
    const standardStatus = getStandardStatusLabel(normalizedStatus) || 'Unknown';
    
    const addressParts = [];
    if (prop.streetNumber) addressParts.push(prop.streetNumber);
    if (prop.streetName) addressParts.push(prop.streetName);
    const line1 = addressParts.join(' ') || prop.unparsedAddress || 'Address Unknown';
    
    const id = generateCanonicalId(
      prop.listingId,
      prop.id?.toString(),
      prop.id?.toString()
    );

    return {
      id,
      sourceIds: {
        database: prop.id?.toString() || prop.listingId,
      },
      sources: ['DATABASE'],
      primarySource: 'DATABASE',
      standardStatus: standardStatus as CanonicalListing['standardStatus'],
      listPrice: prop.listPrice,
      closePrice: prop.closePrice,
      address: {
        line1,
        city: prop.city || '',
        state: prop.stateOrProvince || 'TX',
        postalCode: prop.postalCode || '',
        unit: prop.unitNumber,
        normalizedKey: `${line1}|${prop.city}|${prop.stateOrProvince}|${prop.postalCode}`.toLowerCase(),
      },
      beds: prop.bedroomsTotal,
      baths: prop.bathroomsTotalInteger,
      livingAreaSqft: prop.livingArea,
      lotSizeSqft: prop.lotSizeSquareFeet,
      yearBuilt: prop.yearBuilt,
      propertyType: prop.propertyType,
      propertySubType: normalizePropertyType(prop.propertySubType),
      subdivision: prop.subdivision || prop.subdivisionName,
      neighborhood: prop.neighborhood,
      mlsNumber: prop.listingId,
      listingId: prop.listingId || prop.id?.toString(),
      listDate: prop.listDate,
      closeDate: prop.closeDate,
      daysOnMarket: prop.daysOnMarket,
      latitude: prop.latitude,
      longitude: prop.longitude,
      photos: prop.photos || [],
      poolFeatures: prop.poolFeatures,
      garageSpaces: prop.garageSpaces,
      elementarySchool: prop.elementarySchool,
      lastUpdated: prop.modificationTimestamp || new Date().toISOString(),
      dataSource: 'Database',
    };
  }

  /**
   * Deduplicate listings using the scoring algorithm
   */
  deduplicateListings(listings: CanonicalListing[]): CanonicalListing[] {
    if (listings.length === 0) return [];
    
    // Group by MLS number first (most reliable)
    const byMlsNumber = new Map<string, CanonicalListing[]>();
    const noMlsNumber: CanonicalListing[] = [];
    
    for (const listing of listings) {
      if (listing.mlsNumber) {
        const key = listing.mlsNumber.toLowerCase();
        if (!byMlsNumber.has(key)) {
          byMlsNumber.set(key, []);
        }
        byMlsNumber.get(key)!.push(listing);
      } else {
        noMlsNumber.push(listing);
      }
    }
    
    // Merge MLS number groups
    const deduped: CanonicalListing[] = [];
    
    const mlsGroups = Array.from(byMlsNumber.values());
    for (const group of mlsGroups) {
      if (group.length === 1) {
        deduped.push(group[0]);
      } else {
        // Sort by source priority and merge
        group.sort((a: CanonicalListing, b: CanonicalListing) => {
          const aIdx = ['MLS', 'REPLIERS', 'DATABASE'].indexOf(a.primarySource);
          const bIdx = ['MLS', 'REPLIERS', 'DATABASE'].indexOf(b.primarySource);
          return aIdx - bIdx;
        });
        
        let merged = group[0];
        for (let i = 1; i < group.length; i++) {
          merged = mergeListings(merged, group[i]);
        }
        deduped.push(merged);
      }
    }
    
    // Handle listings without MLS numbers - use address key matching
    const byAddressKey = new Map<string, CanonicalListing[]>();
    const noAddressKey: CanonicalListing[] = [];
    
    for (const listing of noMlsNumber) {
      const key = listing.address.normalizedKey;
      if (key && key.length > 10) {
        if (!byAddressKey.has(key)) {
          byAddressKey.set(key, []);
        }
        byAddressKey.get(key)!.push(listing);
      } else {
        noAddressKey.push(listing);
      }
    }
    
    const addressGroups = Array.from(byAddressKey.values());
    for (const group of addressGroups) {
      if (group.length === 1) {
        deduped.push(group[0]);
      } else {
        // Verify with score check
        group.sort((a: CanonicalListing, b: CanonicalListing) => {
          const aIdx = ['MLS', 'REPLIERS', 'DATABASE'].indexOf(a.primarySource);
          const bIdx = ['MLS', 'REPLIERS', 'DATABASE'].indexOf(b.primarySource);
          return aIdx - bIdx;
        });
        
        let merged = group[0];
        for (let i = 1; i < group.length; i++) {
          const score = calculateDuplicateScore(merged, group[i]);
          if (score >= DUPLICATE_THRESHOLD) {
            merged = mergeListings(merged, group[i]);
          } else {
            // Not a duplicate, add separately
            deduped.push(group[i]);
          }
        }
        deduped.push(merged);
      }
    }
    
    // Add listings without good address keys
    deduped.push(...noAddressKey);
    
    return deduped;
  }

  /**
   * Get a single listing by ID
   */
  async getListingById(id: string, _includeRaw = false): Promise<CanonicalListing | null> {
    // Extract the ID type and value
    const parts = id.includes(':') ? id.split(':') : ['unknown', id];
    const value = parts[1] || parts[0];
    
    // Try database first (more reliable for individual lookups)
    try {
      const prop = await storage.getPropertyByListingId(value);
      if (prop) {
        return this.mapDatabaseToCanonical(prop);
      }
    } catch (error) {
      console.log('[CanonicalService] Database lookup failed, trying other sources');
    }
    
    // For Repliers, we would need to search and filter which is expensive
    // Individual listing lookup is best done via database
    // If not found in database, return null
    return null;
  }

  /**
   * Get sample listings for testing/debugging
   */
  async getSampleListings(count = 25, includeRaw = true): Promise<{
    samples: CanonicalListing[];
    meta: {
      fetchedAt: string;
      sources: string[];
      rawFieldsIncluded: boolean;
    };
  }> {
    const result = await this.fetchListings({
      limit: count,
      includeRaw,
      sources: ['REPLIERS'],
    });

    return {
      samples: result.listings,
      meta: {
        fetchedAt: new Date().toISOString(),
        sources: ['REPLIERS'],
        rawFieldsIncluded: includeRaw,
      },
    };
  }

  /**
   * Generate a dedupe report for diagnostics
   */
  async getDedupeReport(sampleSize = 100): Promise<DedupeReport> {
    const result = await this.fetchListings({
      limit: sampleSize,
      sources: ['REPLIERS', 'DATABASE'],
    });

    const duplicatePairs: DedupeReport['duplicatePairs'] = [];
    
    // Find potential duplicates
    const listings = result.listings;
    for (let i = 0; i < listings.length; i++) {
      for (let j = i + 1; j < listings.length; j++) {
        const score = calculateDuplicateScore(listings[i], listings[j]);
        if (score >= 0.5 && score < DUPLICATE_THRESHOLD) {
          let matchReason = '';
          if (listings[i].mlsNumber === listings[j].mlsNumber) {
            matchReason = 'MLS number match';
          } else if (listings[i].address.normalizedKey === listings[j].address.normalizedKey) {
            matchReason = 'Address key match';
          } else {
            matchReason = 'Proximity/similarity match';
          }
          
          duplicatePairs.push({
            primaryId: listings[i].id,
            duplicateId: listings[j].id,
            score,
            matchReason,
          });
        }
      }
    }

    const sourceStats: Record<ListingSource, number> = {
      'MLS': 0,
      'REPLIERS': 0,
      'DATABASE': 0,
    };
    
    for (const listing of listings) {
      sourceStats[listing.primarySource]++;
    }

    return {
      totalProcessed: result.dedupeStats.beforeDedupe,
      uniqueListings: result.dedupeStats.afterDedupe,
      duplicatesFound: result.dedupeStats.duplicatesRemoved,
      duplicatePairs,
      sourceStats,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[CanonicalService] Cache cleared');
  }
}

// Singleton instance
export const CanonicalListingService = new CanonicalListingServiceImpl();
