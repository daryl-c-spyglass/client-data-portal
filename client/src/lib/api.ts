import { apiRequest } from "./queryClient";
import type { SearchCriteria, Property } from "@shared/schema";

// Normalized property interface for unified search
export interface NormalizedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  listPrice: number;
  closePrice: number | null;
  status: string;
  beds: number | null;
  baths: number | null;
  livingArea: number | null;
  yearBuilt: number | null;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  subdivision: string | null;
  daysOnMarket: number | null;
  cumulativeDaysOnMarket?: number | null;
  lotSizeSquareFeet?: number | null;
  lotSizeAcres?: number | null;
  garageSpaces?: number | null;
  closeDate?: string | null;
  description?: string | null;
}

interface UnifiedSearchResponse {
  properties: NormalizedProperty[];
  count: number;
  status?: string;
  statuses?: string[];
  dataSource?: string;
}

// Map status to MLS-standard RESO-aligned values
function mapStatusToStandard(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'Active',
    'Under Contract': 'Active Under Contract',
    'Active Under Contract': 'Active Under Contract',
    'Closed': 'Closed',
    'Sold': 'Closed',
    'Pending': 'Pending',
  };
  return statusMap[status] || status;
}

// Map NormalizedProperty to Property-like structure for UI components
// Preserves numeric types for calculations
export function mapNormalizedToProperty(normalized: NormalizedProperty): Property {
  return {
    id: normalized.id,
    listingId: normalized.id,
    listingKey: normalized.id,
    standardStatus: mapStatusToStandard(normalized.status),
    listPrice: normalized.listPrice,
    closePrice: normalized.closePrice,
    originalListPrice: null,
    propertyType: 'Residential',
    propertySubType: null,
    city: normalized.city,
    stateOrProvince: normalized.state,
    postalCode: normalized.postalCode,
    countyOrParish: null,
    subdivisionName: normalized.subdivision,
    neighborhood: normalized.subdivision,
    streetNumber: null,
    streetName: null,
    streetSuffix: null,
    unitNumber: null,
    unparsedAddress: normalized.address,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    bedroomsTotal: normalized.beds,
    bathroomsTotalInteger: normalized.baths,
    bathroomsFull: null,
    bathroomsHalf: null,
    livingArea: normalized.livingArea,
    lotSizeSquareFeet: normalized.lotSizeSquareFeet ?? null,
    lotSizeAcres: normalized.lotSizeAcres ?? null,
    yearBuilt: normalized.yearBuilt,
    garageSpaces: normalized.garageSpaces ?? null,
    garageParkingSpaces: null,
    storiesTotal: null,
    poolPrivateYn: null,
    waterfrontYn: null,
    viewYn: null,
    associationFee: null,
    associationFeeFrequency: null,
    taxAnnualAmount: null,
    publicRemarks: normalized.description || null,
    privateRemarks: null,
    listingContractDate: null,
    closeDate: normalized.closeDate ?? null,
    daysOnMarket: normalized.daysOnMarket,
    cumulativeDaysOnMarket: normalized.cumulativeDaysOnMarket ?? normalized.daysOnMarket,
    listAgentFullName: null,
    listAgentEmail: null,
    listAgentDirectPhone: null,
    listOfficeName: null,
    buyerAgentFullName: null,
    buyerOfficeName: null,
    photos: normalized.photos,
    photosCount: normalized.photos.length,
    virtualTourURLUnbranded: null,
    architecturalStyle: null,
    appliances: null,
    cooling: null,
    heating: null,
    interiorFeatures: null,
    exteriorFeatures: null,
    flooring: null,
    parkingFeatures: null,
    patioAndPorchFeatures: null,
    securityFeatures: null,
    utilities: null,
    waterSource: null,
    sewer: null,
    elementarySchool: null,
    middleOrJuniorSchool: null,
    highSchool: null,
    schoolDistrict: null,
    modificationTimestamp: new Date().toISOString(),
    mlgCanView: true,
    mlgCanDisplay: true,
    originatingSystemName: normalized.status.includes('Closed') ? 'HomeReview' : 'Repliers',
    mainLevelBedrooms: null,
    totalParkingSpaces: null,
    flexListingYN: null,
    horseYN: null,
    associationYN: null,
    viewYN: null,
    propertySaleContingency: null,
    occupantType: null,
    possession: null,
    additionalData: null,
    propertyCondition: null,
    ownershipType: null,
    poolPrivateYN: null,
    poolFeatures: null,
    fireplaceFeatures: null,
    fireplaceYN: null,
    communityFeatures: null,
    associationAmenities: null,
    laundryFeatures: null,
    lotFeatures: null,
    accessibilityFeatures: null,
    greenEnergyEfficient: null,
    buildingFeatures: null,
    roofType: null,
    constructionMaterials: null,
    foundationType: null,
    fencing: null,
    structureType: null,
    specialListingConditions: null,
    buyerFinancing: null,
    listingTerms: null,
    concessions: null,
    contractStatusChangeDate: null,
    expirationDate: null,
    withdrawnDate: null,
    canceledDate: null,
    pendingTimestamp: null,
    contingentDate: null,
  } as unknown as Property;
}

// Helper to build search params from criteria
function buildSearchParams(criteria: SearchCriteria): URLSearchParams {
  const params = new URLSearchParams();
  
  // Determine status for API - always use "statuses" param for consistency
  if (criteria.status && criteria.status.length > 0) {
    const mappedStatuses = criteria.status.map(statusVal => {
      if (statusVal === 'Active') return 'active';
      if (statusVal === 'Active Under Contract' || statusVal === 'Under Contract') return 'under_contract';
      if (statusVal === 'Closed') return 'closed';
      return statusVal.toLowerCase().replace(/ /g, '_');
    });
    params.append('statuses', mappedStatuses.join(','));
  } else {
    params.append('statuses', 'active'); // Default to active
  }

  // Array filters - send all values as comma-separated
  if (criteria.zipCodes && criteria.zipCodes.length > 0) {
    params.append('postalCode', criteria.zipCodes.join(','));
  }
  if (criteria.subdivisions && criteria.subdivisions.length > 0) {
    params.append('subdivision', criteria.subdivisions.join(','));
  }
  if (criteria.cities && criteria.cities.length > 0) {
    params.append('city', criteria.cities.join(','));
  }
  // Note: neighborhood filter removed per RESO compliance - use subdivision instead
  // Old neighborhood URLs are parsed but not sent to API
  
  // Numeric filters - handle zero as valid value
  if (criteria.listPriceMin !== undefined && criteria.listPriceMin !== null) {
    params.append('minPrice', String(criteria.listPriceMin));
  }
  if (criteria.listPriceMax !== undefined && criteria.listPriceMax !== null) {
    params.append('maxPrice', String(criteria.listPriceMax));
  }
  if (criteria.bedroomsMin !== undefined && criteria.bedroomsMin !== null) {
    params.append('bedsMin', String(criteria.bedroomsMin));
  }
  if (criteria.fullBathsMin !== undefined && criteria.fullBathsMin !== null) {
    params.append('bathsMin', String(criteria.fullBathsMin));
  }
  
  // String filters
  if (criteria.propertySubType) {
    params.append('propertySubType', criteria.propertySubType);
  }
  
  // Date range filter (full date picker support)
  if (criteria.dateRange?.from) {
    params.append('dateFrom', criteria.dateRange.from);
  }
  if (criteria.dateRange?.to) {
    params.append('dateTo', criteria.dateRange.to);
  }
  
  // Additional numeric filters
  const anyC = criteria as any;
  if (anyC.soldDays !== undefined && anyC.soldDays !== null) {
    params.append('soldDays', String(anyC.soldDays));
  }
  if (anyC.stories !== undefined && anyC.stories !== null) {
    params.append('stories', String(anyC.stories));
  }
  if (anyC.minLotAcres !== undefined && anyC.minLotAcres !== null) {
    params.append('minLotAcres', String(anyC.minLotAcres));
  }
  if (anyC.maxLotAcres !== undefined && anyC.maxLotAcres !== null) {
    params.append('maxLotAcres', String(anyC.maxLotAcres));
  }
  if (anyC.minYearBuilt !== undefined && anyC.minYearBuilt !== null) {
    params.append('minYearBuilt', String(anyC.minYearBuilt));
  }
  if (anyC.maxYearBuilt !== undefined && anyC.maxYearBuilt !== null) {
    params.append('maxYearBuilt', String(anyC.maxYearBuilt));
  }
  if (anyC.minSqft !== undefined && anyC.minSqft !== null) {
    params.append('minSqft', String(anyC.minSqft));
  }
  if (anyC.maxSqft !== undefined && anyC.maxSqft !== null) {
    params.append('maxSqft', String(anyC.maxSqft));
  }
  
  params.append('limit', '200');
  
  return params;
}

// New unified search that routes to Repliers (active) or HomeReview (closed)
export async function unifiedSearch(criteria: SearchCriteria): Promise<Property[]> {
  const params = buildSearchParams(criteria);

  const response = await fetch(`/api/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to search properties');
  }
  const data: UnifiedSearchResponse = await response.json();
  
  // Map normalized properties to full Property type for UI compatibility
  return data.properties.map(mapNormalizedToProperty);
}

// Extended search that returns metadata (for inventory summary)
export interface SearchResultWithMeta {
  properties: Property[];
  count: number;
  dataSource: string;
  statuses: string[];
  inventoryByStatus: Record<string, number>;
  inventoryBySubtype: Record<string, number>;
}

export async function unifiedSearchWithMeta(criteria: SearchCriteria): Promise<SearchResultWithMeta> {
  const params = buildSearchParams(criteria);

  const response = await fetch(`/api/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to search properties');
  }
  const data: UnifiedSearchResponse = await response.json();
  
  // Map normalized properties to full Property type
  const properties = data.properties.map(mapNormalizedToProperty);
  
  // Compute inventory counts from results
  const inventoryByStatus: Record<string, number> = {
    'Active': 0,
    'Active Under Contract': 0,
    'Closed': 0,
  };
  
  const inventoryBySubtype: Record<string, number> = {
    'Single Family Residence': 0,
    'Condominium': 0,
    'Townhouse': 0,
    'Multi-Family': 0,
    'Land/Ranch': 0,
    'Other/Unknown': 0,
  };
  
  properties.forEach(p => {
    // Count by status
    const status = p.standardStatus || 'Active';
    if (status === 'Active') inventoryByStatus['Active']++;
    else if (status === 'Active Under Contract' || status === 'Under Contract' || status === 'Pending') inventoryByStatus['Active Under Contract']++;
    else if (status === 'Closed' || status === 'Sold') inventoryByStatus['Closed']++;
    
    // Count by subtype
    const subtype = (p.propertySubType || '').toLowerCase();
    if (subtype.includes('single family') || subtype.includes('detached')) {
      inventoryBySubtype['Single Family Residence']++;
    } else if (subtype.includes('condo')) {
      inventoryBySubtype['Condominium']++;
    } else if (subtype.includes('townhouse') || subtype.includes('townhome')) {
      inventoryBySubtype['Townhouse']++;
    } else if (subtype.includes('multi') || subtype.includes('duplex') || subtype.includes('triplex')) {
      inventoryBySubtype['Multi-Family']++;
    } else if (subtype.includes('land') || subtype.includes('ranch') || subtype.includes('lot')) {
      inventoryBySubtype['Land/Ranch']++;
    } else {
      inventoryBySubtype['Other/Unknown']++;
    }
  });
  
  const dataSource = 'MLS Listings';
  
  return {
    properties,
    count: properties.length,
    dataSource,
    statuses: data.statuses || ['active'],
    inventoryByStatus,
    inventoryBySubtype,
  };
}

export async function searchProperties(criteria: SearchCriteria): Promise<Property[]> {
  // Convert criteria object to query params
  const params = new URLSearchParams();
  
  Object.entries(criteria).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        // Join arrays with commas for server-side parsing
        params.append(key, value.join(','));
      } else if (typeof value === 'object') {
        // For nested objects like yearBuilt.min, livingArea.max
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue !== undefined && subValue !== null) {
            params.append(`${key}.${subKey}`, String(subValue));
          }
        });
      } else {
        params.append(key, String(value));
      }
    }
  });

  const response = await fetch(`/api/properties/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to search properties');
  }
  return response.json();
}
