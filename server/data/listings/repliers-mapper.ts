/**
 * Repliers API to Canonical Listing Mapper
 * 
 * Transforms Repliers API response data into the canonical listing format.
 */

import { 
  CanonicalListing, 
  CanonicalAddress, 
  createAddressKey,
  createAddressKeyFromString,
  generateCanonicalId,
  ListingSource 
} from '../../../shared/canonical-listing';
import { normalizeStatus, getStandardStatusLabel } from '../../../shared/statusMapping';
import { normalizePropertyType } from '../../inventory-service';

interface RepliersListingData {
  mlsNumber?: string;
  listingId?: string;
  listPrice?: number;
  soldPrice?: number;
  closePrice?: number;
  originalPrice?: number;
  status?: string;
  standardStatus?: string;
  lastStatus?: string;
  address?: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    city?: string;
    area?: string;
    state?: string;
    zip?: string;
    country?: string;
    neighborhood?: string;
    unitNumber?: string;
  };
  details?: {
    bedrooms?: number;
    bathrooms?: number;
    numBedrooms?: number;
    numBathrooms?: number;
    sqft?: number;
    lotSize?: number;
    yearBuilt?: number;
    propertyType?: string;
    style?: string;
    garage?: number;
    pool?: string;
    description?: string;
  };
  map?: {
    latitude?: number;
    longitude?: number;
  };
  photos?: string[];
  images?: string[];
  listDate?: string;
  soldDate?: string;
  closeDate?: string;
  daysOnMarket?: number;
  livingArea?: number;
  yearBuilt?: number;
  lotSizeSquareFeet?: number;
  lotSizeAcres?: number;
  propertySubType?: string;
  type?: string;
  subdivision?: string;
  office?: {
    name?: string;
    phone?: string;
  };
  agent?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  raw?: Record<string, any>;
  poolFeatures?: string | string[];
  garageSpaces?: number;
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
}

/**
 * Map a Repliers API listing to the canonical format
 */
export function mapRepliersToCanonical(
  listing: RepliersListingData,
  includeRaw = false
): CanonicalListing {
  // Build address - try both nested address object and raw fields
  const rawData = listing.raw || {};
  
  // Street components from address object or raw
  const streetNumber = listing.address?.streetNumber || rawData.StreetNumber || '';
  const streetName = listing.address?.streetName || rawData.StreetName || '';
  const streetSuffix = listing.address?.streetSuffix || rawData.StreetSuffix || '';
  const fullStreetName = [streetName, streetSuffix].filter(Boolean).join(' ');
  const line1 = [streetNumber, fullStreetName].filter(Boolean).join(' ').trim() || rawData.UnparsedAddress || '';
  
  // City, state, zip from address object or raw
  const city = listing.address?.city || rawData.City || '';
  const state = listing.address?.state || rawData.StateOrProvince || 'TX';
  const postalCode = listing.address?.zip || rawData.PostalCode || '';
  const unit = listing.address?.unitNumber || rawData.UnitNumber || '';
  
  // Build address key - use discrete parts if available, fall back to unparsed address string
  let addressKey = createAddressKey(
    streetNumber,
    fullStreetName,
    unit,
    city,
    state,
    postalCode
  );
  
  // If discrete parts resulted in empty/minimal key, try unparsed address fallback
  if (!addressKey || addressKey.split('|').filter(Boolean).length < 2) {
    const unparsedAddress = rawData.UnparsedAddress || rawData.FullStreetAddress || line1;
    if (unparsedAddress) {
      addressKey = createAddressKeyFromString(unparsedAddress, city, state, postalCode);
    }
  }
  
  const address: CanonicalAddress = {
    line1: line1 || 'Address Unknown',
    city,
    state,
    postalCode,
    unit: unit || undefined,
    normalizedKey: addressKey,
  };
  
  // Normalize status - check raw fields too
  const rawStatus = listing.standardStatus || listing.status || rawData.StandardStatus || rawData.MlsStatus || '';
  const normalizedStatus = normalizeStatus(rawStatus);
  const standardStatus = getStandardStatusLabel(normalizedStatus) || 'Unknown';
  
  // Get beds/baths from various possible fields including raw
  const beds = listing.details?.bedrooms ?? listing.details?.numBedrooms ?? rawData.BedroomsTotal;
  const baths = listing.details?.bathrooms ?? listing.details?.numBathrooms ?? rawData.BathroomsTotalInteger;
  
  // Get living area from various possible fields
  const livingAreaSqft = listing.livingArea ?? listing.details?.sqft ?? rawData.LivingArea;
  
  // Get year built
  const yearBuilt = listing.yearBuilt ?? listing.details?.yearBuilt ?? rawData.YearBuilt;
  
  // Normalize property type - check raw fields
  const rawSubType = listing.propertySubType || listing.details?.style || listing.type || rawData.PropertySubType || '';
  const propertySubType = normalizePropertyType(rawSubType);
  
  // Get photos from various possible fields
  const photos = listing.photos || listing.images || [];
  
  // Get MLS number from listing or raw
  const mlsNumber = listing.mlsNumber || rawData.ListingId;
  const listingId = listing.listingId || rawData.ListingId || rawData.ListingKey;
  
  // Generate canonical ID
  const id = generateCanonicalId(
    mlsNumber,
    listingId,
    undefined,
    addressKey
  );
  
  // Build canonical listing
  const canonical: CanonicalListing = {
    id,
    sourceIds: {
      repliers: listingId,
      mls: mlsNumber,
    },
    sources: ['REPLIERS'],
    primarySource: 'REPLIERS',
    standardStatus: standardStatus as CanonicalListing['standardStatus'],
    listPrice: listing.listPrice,
    closePrice: listing.closePrice ?? listing.soldPrice,
    originalPrice: listing.originalPrice,
    address,
    beds,
    baths,
    livingAreaSqft,
    lotSizeSqft: listing.lotSizeSquareFeet ?? listing.details?.lotSize,
    lotSizeAcres: listing.lotSizeAcres,
    yearBuilt,
    propertyType: listing.details?.propertyType || listing.type,
    propertySubType,
    subdivision: listing.subdivision || rawData.SubdivisionName,
    neighborhood: listing.address?.neighborhood || rawData.CommunityFeatures,
    mlsNumber: mlsNumber,
    listingId: listingId,
    listDate: listing.listDate || rawData.ListingContractDate,
    closeDate: listing.closeDate ?? listing.soldDate ?? rawData.CloseDate,
    daysOnMarket: listing.daysOnMarket ?? rawData.DaysOnMarket,
    latitude: listing.map?.latitude ?? rawData.Latitude,
    longitude: listing.map?.longitude ?? rawData.Longitude,
    photos,
    listingAgent: listing.agent ? {
      name: listing.agent.name,
      phone: listing.agent.phone,
      email: listing.agent.email,
    } : undefined,
    listingOffice: listing.office ? {
      name: listing.office.name,
      phone: listing.office.phone,
    } : undefined,
    poolFeatures: listing.poolFeatures ?? listing.details?.pool,
    garageSpaces: listing.garageSpaces ?? listing.details?.garage,
    elementarySchool: listing.elementarySchool,
    middleSchool: listing.middleSchool,
    highSchool: listing.highSchool,
    lastUpdated: new Date().toISOString(),
    dataSource: 'Repliers API',
  };
  
  // Include raw data if requested
  if (includeRaw && listing.raw) {
    canonical.raw = {
      repliers: listing.raw,
    };
  }
  
  return canonical;
}

/**
 * Map an array of Repliers listings to canonical format
 */
export function mapRepliersListingsToCanonical(
  listings: RepliersListingData[],
  includeRaw = false
): CanonicalListing[] {
  return listings.map(listing => mapRepliersToCanonical(listing, includeRaw));
}

/**
 * Extract raw field value safely from Repliers listing
 */
export function getRepliersRawField<T = unknown>(
  listing: RepliersListingData,
  fieldPath: string,
  defaultValue?: T
): T | undefined {
  if (!listing.raw) return defaultValue;
  
  const parts = fieldPath.split('.');
  let current: any = listing.raw;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[part];
  }
  
  return current !== undefined ? current : defaultValue;
}
