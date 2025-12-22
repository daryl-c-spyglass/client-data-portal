/**
 * Canonical Listing Data Layer
 * 
 * This module defines the unified listing model used across the entire application.
 * All listing data from MLS Grid, Repliers API, and Database flows through this layer.
 * 
 * Key principles:
 * - Single source of truth for listing structure
 * - Deterministic deduplication across sources
 * - RESO-compliant status normalization
 * - Optional raw field access for source-specific data
 */

import { z } from 'zod';

// Data source identifiers
export type ListingSource = 'MLS' | 'REPLIERS' | 'DATABASE';

// Address schema for normalized addresses
export const CanonicalAddressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  unit: z.string().optional(),
  county: z.string().optional(),
  normalizedKey: z.string(),
});

export type CanonicalAddress = z.infer<typeof CanonicalAddressSchema>;

// Source IDs tracking which systems have this listing
export const SourceIdsSchema = z.object({
  mls: z.string().optional(),
  repliers: z.string().optional(),
  database: z.string().optional(),
});

export type SourceIds = z.infer<typeof SourceIdsSchema>;

// Canonical listing schema - THE unified listing model
export const CanonicalListingSchema = z.object({
  id: z.string(),
  sourceIds: SourceIdsSchema,
  sources: z.array(z.enum(['MLS', 'REPLIERS', 'DATABASE'])),
  primarySource: z.enum(['MLS', 'REPLIERS', 'DATABASE']),
  
  // Core property fields
  standardStatus: z.enum(['Active', 'Active Under Contract', 'Pending', 'Closed', 'Unknown']),
  listPrice: z.number().optional(),
  closePrice: z.number().optional(),
  originalPrice: z.number().optional(),
  
  // Address
  address: CanonicalAddressSchema,
  
  // Property details
  beds: z.number().optional(),
  baths: z.number().optional(),
  livingAreaSqft: z.number().optional(),
  lotSizeSqft: z.number().optional(),
  lotSizeAcres: z.number().optional(),
  yearBuilt: z.number().optional(),
  
  // Classification
  propertyType: z.string().optional(),
  propertySubType: z.string().optional(),
  subdivision: z.string().optional(),
  neighborhood: z.string().optional(),
  
  // MLS identifiers
  mlsNumber: z.string().optional(),
  listingId: z.string().optional(),
  
  // Dates
  listDate: z.string().optional(),
  closeDate: z.string().optional(),
  daysOnMarket: z.number().optional(),
  
  // Location
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  
  // Media
  photos: z.array(z.string()).optional(),
  
  // Agent/Office
  listingAgent: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  listingOffice: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  
  // Pool and features
  poolFeatures: z.union([z.string(), z.array(z.string())]).optional(),
  garageSpaces: z.number().optional(),
  
  // Schools
  elementarySchool: z.string().optional(),
  middleSchool: z.string().optional(),
  highSchool: z.string().optional(),
  
  // Raw source data (only included when requested)
  raw: z.object({
    repliers: z.record(z.unknown()).optional(),
    mls: z.record(z.unknown()).optional(),
  }).optional(),
  
  // Metadata
  lastUpdated: z.string().optional(),
  dataSource: z.string().optional(),
});

export type CanonicalListing = z.infer<typeof CanonicalListingSchema>;

// Partial canonical listing for updates/patches
export type PartialCanonicalListing = Partial<CanonicalListing> & { id: string };

/**
 * Create a normalized address key for deduplication.
 * This key is used to match listings across different data sources.
 */
export function createAddressKey(
  streetNumber?: string | number,
  streetName?: string,
  unit?: string,
  city?: string,
  state?: string,
  postalCode?: string
): string {
  const parts: string[] = [];
  
  // Normalize street number
  if (streetNumber) {
    parts.push(String(streetNumber).trim().toLowerCase());
  }
  
  // Normalize street name (remove common suffixes variations)
  if (streetName) {
    let normalized = streetName.trim().toLowerCase();
    // Normalize common street suffix variations
    normalized = normalized
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\broad\b/g, 'rd')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\blane\b/g, 'ln')
      .replace(/\bcourt\b/g, 'ct')
      .replace(/\bcircle\b/g, 'cir')
      .replace(/\bplace\b/g, 'pl')
      .replace(/\bterrace\b/g, 'ter')
      .replace(/\bway\b/g, 'wy')
      .replace(/\bhighway\b/g, 'hwy')
      .replace(/\bparkway\b/g, 'pkwy')
      .replace(/[.,#]/g, '')
      .replace(/\s+/g, ' ');
    parts.push(normalized);
  }
  
  // Include unit if present
  if (unit) {
    const normalizedUnit = unit.trim().toLowerCase()
      .replace(/^(unit|apt|suite|ste|#)\s*/i, '')
      .replace(/\s+/g, '');
    if (normalizedUnit) {
      parts.push(`u${normalizedUnit}`);
    }
  }
  
  // Add city
  if (city) {
    parts.push(city.trim().toLowerCase().replace(/\s+/g, ''));
  }
  
  // Add state
  if (state) {
    parts.push(state.trim().toLowerCase());
  }
  
  // Add postal code (first 5 digits only)
  if (postalCode) {
    const zip = postalCode.trim().substring(0, 5);
    parts.push(zip);
  }
  
  return parts.join('|');
}

/**
 * Create address key from a full address string
 */
export function createAddressKeyFromString(fullAddress: string, city?: string, state?: string, postalCode?: string): string {
  if (!fullAddress) return '';
  
  // Try to parse the address
  const parts = fullAddress.trim().split(/\s+/);
  if (parts.length < 2) return fullAddress.toLowerCase().replace(/\s+/g, '|');
  
  // Assume first part is street number
  const streetNumber = parts[0];
  const streetName = parts.slice(1).join(' ');
  
  return createAddressKey(streetNumber, streetName, undefined, city, state, postalCode);
}

/**
 * Determine the canonical ID for a listing based on available identifiers.
 * Priority: mlsNumber > listingId > database ID > generated from address
 */
export function generateCanonicalId(
  mlsNumber?: string,
  listingId?: string,
  databaseId?: string,
  addressKey?: string
): string {
  if (mlsNumber) {
    return `mls:${mlsNumber}`;
  }
  if (listingId) {
    return `lid:${listingId}`;
  }
  if (databaseId) {
    return `db:${databaseId}`;
  }
  if (addressKey) {
    return `addr:${addressKey}`;
  }
  return `gen:${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if two listings should be considered duplicates.
 * Returns a confidence score (0-1) where 1 = definite duplicate.
 */
export function calculateDuplicateScore(a: Partial<CanonicalListing>, b: Partial<CanonicalListing>): number {
  let score = 0;
  let maxScore = 0;
  
  // MLS Number match (highest confidence)
  if (a.mlsNumber && b.mlsNumber) {
    maxScore += 100;
    if (a.mlsNumber === b.mlsNumber) {
      score += 100;
    }
  }
  
  // Listing ID match
  if (a.listingId && b.listingId) {
    maxScore += 80;
    if (a.listingId === b.listingId) {
      score += 80;
    }
  }
  
  // Address key match
  if (a.address?.normalizedKey && b.address?.normalizedKey) {
    maxScore += 60;
    if (a.address.normalizedKey === b.address.normalizedKey) {
      score += 60;
    }
  }
  
  // Price similarity (within 1%)
  if (a.listPrice && b.listPrice) {
    maxScore += 20;
    const priceDiff = Math.abs(a.listPrice - b.listPrice) / Math.max(a.listPrice, b.listPrice);
    if (priceDiff < 0.01) {
      score += 20;
    } else if (priceDiff < 0.05) {
      score += 10;
    }
  }
  
  // Lat/Lng proximity (within ~100m)
  if (a.latitude && a.longitude && b.latitude && b.longitude) {
    maxScore += 30;
    const latDiff = Math.abs(a.latitude - b.latitude);
    const lngDiff = Math.abs(a.longitude - b.longitude);
    if (latDiff < 0.001 && lngDiff < 0.001) {
      score += 30;
    } else if (latDiff < 0.005 && lngDiff < 0.005) {
      score += 15;
    }
  }
  
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Merge two canonical listings, preferring data from the higher-priority source.
 * Source priority: MLS > REPLIERS > DATABASE
 */
export function mergeListings(
  primary: CanonicalListing,
  secondary: Partial<CanonicalListing>
): CanonicalListing {
  const merged: CanonicalListing = { ...primary };
  
  // Merge source IDs
  if (secondary.sourceIds) {
    merged.sourceIds = {
      ...merged.sourceIds,
      ...secondary.sourceIds,
    };
  }
  
  // Merge sources array (dedupe)
  if (secondary.sources) {
    const allSources = new Set([...merged.sources, ...secondary.sources]);
    merged.sources = Array.from(allSources) as ListingSource[];
  }
  
  // Fill in missing fields from secondary (don't overwrite existing)
  const fillFields: (keyof CanonicalListing)[] = [
    'beds', 'baths', 'livingAreaSqft', 'lotSizeSqft', 'yearBuilt',
    'propertyType', 'propertySubType', 'subdivision', 'neighborhood',
    'latitude', 'longitude', 'listDate', 'closeDate', 'daysOnMarket',
    'poolFeatures', 'garageSpaces', 'elementarySchool', 'middleSchool', 'highSchool',
  ];
  
  for (const field of fillFields) {
    if (merged[field] === undefined && secondary[field] !== undefined) {
      (merged as any)[field] = secondary[field];
    }
  }
  
  // Merge photos (combine and dedupe)
  if (secondary.photos?.length) {
    const existingPhotos = new Set(merged.photos || []);
    for (const photo of secondary.photos) {
      existingPhotos.add(photo);
    }
    merged.photos = Array.from(existingPhotos);
  }
  
  // Merge raw data
  if (secondary.raw) {
    merged.raw = {
      ...merged.raw,
      ...secondary.raw,
    };
  }
  
  return merged;
}

/**
 * Get the priority rank for a source (lower = higher priority)
 */
export function getSourcePriority(source: ListingSource): number {
  switch (source) {
    case 'MLS': return 1;
    case 'REPLIERS': return 2;
    case 'DATABASE': return 3;
    default: return 99;
  }
}

/**
 * Determine the primary source for a listing based on which sources it came from
 */
export function determinePrimarySource(sources: ListingSource[]): ListingSource {
  if (sources.includes('MLS')) return 'MLS';
  if (sources.includes('REPLIERS')) return 'REPLIERS';
  if (sources.includes('DATABASE')) return 'DATABASE';
  return 'DATABASE';
}
