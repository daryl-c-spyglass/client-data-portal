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
}

interface UnifiedSearchResponse {
  properties: NormalizedProperty[];
  count: number;
  status: string;
}

// Map status to MLS-standard values
function mapStatusToStandard(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'Active',
    'Under Contract': 'Active Under Contract',
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
    publicRemarks: null,
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

// New unified search that routes to Repliers (active) or HomeReview (closed)
export async function unifiedSearch(criteria: SearchCriteria): Promise<Property[]> {
  const params = new URLSearchParams();
  
  // Determine status for API
  if (criteria.status && criteria.status.length > 0) {
    // Map status values to API format
    const statusVal = criteria.status[0];
    if (statusVal === 'Active') {
      params.append('status', 'active');
    } else if (statusVal === 'Under Contract') {
      params.append('status', 'under_contract');
    } else if (statusVal === 'Closed') {
      params.append('status', 'closed');
    }
  } else {
    params.append('status', 'active'); // Default to active
  }

  // Map criteria to unified search params
  if (criteria.zipCodes && criteria.zipCodes.length > 0) {
    params.append('postalCode', criteria.zipCodes[0]);
  }
  if (criteria.subdivisions && criteria.subdivisions.length > 0) {
    params.append('subdivision', criteria.subdivisions[0]);
  }
  if (criteria.cities && criteria.cities.length > 0) {
    params.append('city', criteria.cities[0]);
  }
  if (criteria.listPriceMin !== undefined) {
    params.append('minPrice', String(criteria.listPriceMin));
  }
  if (criteria.listPriceMax !== undefined) {
    params.append('maxPrice', String(criteria.listPriceMax));
  }
  if (criteria.bedroomsMin !== undefined) {
    params.append('bedsMin', String(criteria.bedroomsMin));
  }
  if (criteria.fullBathsMin !== undefined) {
    params.append('bathsMin', String(criteria.fullBathsMin));
  }
  
  params.append('limit', '100');

  const response = await fetch(`/api/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to search properties');
  }
  const data: UnifiedSearchResponse = await response.json();
  
  // Map normalized properties to full Property type for UI compatibility
  return data.properties.map(mapNormalizedToProperty);
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
