import axios, { AxiosInstance } from 'axios';

const HOMEREVIEW_API_URL = process.env.HOMEREVIEW_API_URL || 'http://localhost:3001';

interface HomeReviewProperty {
  listingId: string;
  listingKey: string;
  standardStatus: string;
  listPrice: number;
  closePrice?: number;
  originalListPrice?: number;
  propertyType: string;
  propertySubType?: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countyOrParish?: string;
  subdivisionName?: string;
  streetNumber?: string;
  streetName?: string;
  streetSuffix?: string;
  unitNumber?: string;
  unparsedAddress?: string;
  latitude?: number;
  longitude?: number;
  bedroomsTotal?: number;
  bathroomsTotalInteger?: number;
  bathroomsFull?: number;
  bathroomsHalf?: number;
  livingArea?: number;
  lotSizeSquareFeet?: number;
  lotSizeAcres?: number;
  yearBuilt?: number;
  garageSpaces?: number;
  storiesTotal?: number;
  poolPrivateYn?: boolean;
  waterfrontYn?: boolean;
  viewYn?: boolean;
  associationFee?: number;
  associationFeeFrequency?: string;
  taxAnnualAmount?: number;
  publicRemarks?: string;
  privateRemarks?: string;
  listingContractDate?: string;
  closeDate?: string;
  daysOnMarket?: number;
  cumulativeDaysOnMarket?: number;
  listAgentFullName?: string;
  listAgentEmail?: string;
  listAgentDirectPhone?: string;
  listOfficeName?: string;
  buyerAgentFullName?: string;
  buyerOfficeName?: string;
  photos?: string[];
  photosCount?: number;
  virtualTourURLUnbranded?: string;
  architecturalStyle?: string[];
  appliances?: string[];
  cooling?: string[];
  heating?: string[];
  interiorFeatures?: string[];
  exteriorFeatures?: string[];
  flooring?: string[];
  parkingFeatures?: string[];
  patioAndPorchFeatures?: string[];
  securityFeatures?: string[];
  utilities?: string[];
  waterSource?: string[];
  sewer?: string[];
  elementarySchool?: string;
  middleOrJuniorSchool?: string;
  highSchool?: string;
  modificationTimestamp?: string;
  mlgCanView?: boolean;
  originatingSystemName?: string;
  [key: string]: any;
}

interface HomeReviewPropertiesResponse {
  properties: HomeReviewProperty[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  timestamp: string;
}

interface MarketStats {
  subdivision: string;
  city: string;
  totalSales: number;
  avgSalePrice: number;
  medianSalePrice: number;
  avgPricePerSqFt: number;
  avgDaysOnMarket: number;
  lastUpdated: string;
}

interface NeighborhoodBoundary {
  id: string;
  name: string;
  city: string;
  geojson?: any;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface PropertySearchParams {
  city?: string;
  cities?: string[];
  subdivision?: string;
  subdivisions?: string[];
  status?: string;
  statuses?: string[];
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minLotSize?: number;
  maxLotSize?: number;
  propertyTypes?: string[];
  propertySubTypes?: string[];
  hasPool?: boolean;
  hasWaterfront?: boolean;
  hasView?: boolean;
  minGarageSpaces?: number;
  minStories?: number;
  maxStories?: number;
  postalCodes?: string[];
  counties?: string[];
  elementarySchools?: string[];
  middleSchools?: string[];
  highSchools?: string[];
  schoolDistrict?: string;
  keywords?: string;
  listingAgentName?: string;
  listingOfficeName?: string;
  minDaysOnMarket?: number;
  maxDaysOnMarket?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class HomeReviewClient {
  private client: AxiosInstance;
  private lastHealthCheck: { available: boolean; timestamp: number } | null = null;
  private healthCheckTTL = 60000;

  constructor() {
    this.client = axios.create({
      baseURL: HOMEREVIEW_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async checkHealth(): Promise<{ available: boolean; latency?: number; message: string }> {
    if (this.lastHealthCheck && Date.now() - this.lastHealthCheck.timestamp < this.healthCheckTTL) {
      return {
        available: this.lastHealthCheck.available,
        message: this.lastHealthCheck.available ? 'HomeReview API is available (cached)' : 'HomeReview API is unavailable (cached)',
      };
    }

    const start = Date.now();
    try {
      const response = await this.client.get('/api/health', { timeout: 5000 });
      const latency = Date.now() - start;
      this.lastHealthCheck = { available: true, timestamp: Date.now() };
      return {
        available: true,
        latency,
        message: `HomeReview API is available (${latency}ms latency)`,
      };
    } catch (error) {
      this.lastHealthCheck = { available: false, timestamp: Date.now() };
      return {
        available: false,
        message: 'HomeReview API is currently unavailable. The external data source may be offline.',
      };
    }
  }

  async searchProperties(params: PropertySearchParams): Promise<{
    properties: HomeReviewProperty[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const queryParams = new URLSearchParams();

      if (params.city) queryParams.append('city', params.city);
      if (params.cities?.length) {
        params.cities.forEach(c => queryParams.append('city', c));
      }

      if (params.subdivision) queryParams.append('subdivision', params.subdivision);
      if (params.subdivisions?.length) {
        params.subdivisions.forEach(s => queryParams.append('subdivision', s));
      }

      if (params.status) queryParams.append('status', params.status);
      if (params.statuses?.length) {
        params.statuses.forEach(s => queryParams.append('status', s));
      }

      if (params.minPrice !== undefined) queryParams.append('minPrice', params.minPrice.toString());
      if (params.maxPrice !== undefined) queryParams.append('maxPrice', params.maxPrice.toString());
      if (params.minBeds !== undefined) queryParams.append('minBeds', params.minBeds.toString());
      if (params.maxBeds !== undefined) queryParams.append('maxBeds', params.maxBeds.toString());
      if (params.minBaths !== undefined) queryParams.append('minBaths', params.minBaths.toString());
      if (params.maxBaths !== undefined) queryParams.append('maxBaths', params.maxBaths.toString());
      if (params.minSqft !== undefined) queryParams.append('minSqft', params.minSqft.toString());
      if (params.maxSqft !== undefined) queryParams.append('maxSqft', params.maxSqft.toString());
      if (params.minYearBuilt !== undefined) queryParams.append('minYearBuilt', params.minYearBuilt.toString());
      if (params.maxYearBuilt !== undefined) queryParams.append('maxYearBuilt', params.maxYearBuilt.toString());
      if (params.minLotSize !== undefined) queryParams.append('minLotSize', params.minLotSize.toString());
      if (params.maxLotSize !== undefined) queryParams.append('maxLotSize', params.maxLotSize.toString());

      if (params.propertyTypes?.length) {
        params.propertyTypes.forEach(t => queryParams.append('propertyType', t));
      }
      if (params.propertySubTypes?.length) {
        params.propertySubTypes.forEach(t => queryParams.append('propertySubType', t));
      }

      if (params.hasPool !== undefined) queryParams.append('hasPool', params.hasPool.toString());
      if (params.hasWaterfront !== undefined) queryParams.append('hasWaterfront', params.hasWaterfront.toString());
      if (params.hasView !== undefined) queryParams.append('hasView', params.hasView.toString());

      if (params.minGarageSpaces !== undefined) queryParams.append('minGarageSpaces', params.minGarageSpaces.toString());
      if (params.minStories !== undefined) queryParams.append('minStories', params.minStories.toString());
      if (params.maxStories !== undefined) queryParams.append('maxStories', params.maxStories.toString());

      // Note: Don't send postalCode to HomeReview API as it doesn't filter correctly
      // We'll apply postal code filtering server-side after fetching results
      // if (params.postalCodes?.length) {
      //   params.postalCodes.forEach(z => queryParams.append('postalCode', z));
      // }
      if (params.counties?.length) {
        params.counties.forEach(c => queryParams.append('county', c));
      }

      if (params.elementarySchools?.length) {
        params.elementarySchools.forEach(s => queryParams.append('elementarySchool', s));
      }
      if (params.middleSchools?.length) {
        params.middleSchools.forEach(s => queryParams.append('middleSchool', s));
      }
      if (params.highSchools?.length) {
        params.highSchools.forEach(s => queryParams.append('highSchool', s));
      }
      if (params.schoolDistrict) {
        queryParams.append('schoolDistrict', params.schoolDistrict);
      }

      if (params.keywords) queryParams.append('keywords', params.keywords);
      if (params.listingAgentName) queryParams.append('listingAgentName', params.listingAgentName);
      if (params.listingOfficeName) queryParams.append('listingOfficeName', params.listingOfficeName);

      if (params.minDaysOnMarket !== undefined) queryParams.append('minDaysOnMarket', params.minDaysOnMarket.toString());
      if (params.maxDaysOnMarket !== undefined) queryParams.append('maxDaysOnMarket', params.maxDaysOnMarket.toString());

      if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      // Fetch more than requested to allow for server-side filtering
      // since HomeReview API may not filter all location fields correctly
      // If postal codes or schools are specified, we need to fetch more to find matches
      const hasLocationFilter = params.postalCodes?.length || params.cities?.length || params.subdivisions?.length;
      const hasSchoolFilter = params.elementarySchools?.length || params.middleSchools?.length || params.highSchools?.length;
      const fetchLimit = (hasLocationFilter || hasSchoolFilter)
        ? Math.min(500, (params.limit || 50) * 10)  // Fetch more for location/school filtering
        : Math.min(200, (params.limit || 50) * 4);
      queryParams.set('limit', fetchLimit.toString());
      
      console.log(`[HomeReview] Fetching properties: /api/mls/public/properties?${queryParams.toString()}`);

      const response = await this.client.get<HomeReviewPropertiesResponse>(
        `/api/mls/public/properties?${queryParams.toString()}`
      );

      const data = response.data;
      let properties = data.properties || [];
      
      // Apply server-side filtering for fields HomeReview API may not filter correctly
      if (params.postalCodes?.length) {
        properties = properties.filter(p => 
          params.postalCodes!.includes(p.postalCode || '')
        );
      }
      
      if (params.cities?.length) {
        const lowerCities = params.cities.map(c => c.toLowerCase());
        properties = properties.filter(p => 
          lowerCities.includes((p.city || '').toLowerCase())
        );
      }
      
      if (params.subdivisions?.length) {
        const lowerSubdivs = params.subdivisions.map(s => s.toLowerCase());
        properties = properties.filter(p => 
          lowerSubdivs.some(s => (p.subdivisionName || '').toLowerCase().includes(s))
        );
      }
      
      // Normalize school name for exact matching
      const normalizeSchoolName = (name: string | undefined): string => {
        if (!name) return '';
        return name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/elem\.?$/i, 'elementary')
          .replace(/el\.?$/i, 'elementary')
          .replace(/middle or jr\.?$/i, 'middle')
          .replace(/jr\.?\s*high/i, 'junior high')
          .replace(/h\.?s\.?$/i, 'high school')
          .replace(/[^a-z0-9\s]/g, '');
      };
      
      // Apply server-side exact-match filtering for elementary schools
      // Filter out empty/whitespace-only values first
      const validElementarySchools = params.elementarySchools?.filter(s => s && s.trim().length > 0) || [];
      if (validElementarySchools.length > 0) {
        const normalizedSearchSchools = validElementarySchools.map(s => normalizeSchoolName(s)).filter(s => s.length > 0);
        if (normalizedSearchSchools.length > 0) {
          const beforeCount = properties.length;
          properties = properties.filter(p => {
            const propSchool = normalizeSchoolName(p.elementarySchool);
            if (!propSchool) return false; // Property must have a school to match
            return normalizedSearchSchools.some(searchSchool => 
              propSchool === searchSchool || propSchool.includes(searchSchool) || searchSchool.includes(propSchool)
            );
          });
          console.log(`[HomeReview] Elementary school filter: ${beforeCount} -> ${properties.length} (looking for: ${validElementarySchools.join(', ')})`);
        }
      }
      
      // Apply server-side exact-match filtering for middle schools
      const validMiddleSchools = params.middleSchools?.filter(s => s && s.trim().length > 0) || [];
      if (validMiddleSchools.length > 0) {
        const normalizedSearchSchools = validMiddleSchools.map(s => normalizeSchoolName(s)).filter(s => s.length > 0);
        if (normalizedSearchSchools.length > 0) {
          const beforeCount = properties.length;
          properties = properties.filter(p => {
            const propSchool = normalizeSchoolName(p.middleOrJuniorSchool);
            if (!propSchool) return false;
            return normalizedSearchSchools.some(searchSchool => 
              propSchool === searchSchool || propSchool.includes(searchSchool) || searchSchool.includes(propSchool)
            );
          });
          console.log(`[HomeReview] Middle school filter: ${beforeCount} -> ${properties.length} (looking for: ${validMiddleSchools.join(', ')})`);
        }
      }
      
      // Apply server-side exact-match filtering for high schools
      const validHighSchools = params.highSchools?.filter(s => s && s.trim().length > 0) || [];
      if (validHighSchools.length > 0) {
        const normalizedSearchSchools = validHighSchools.map(s => normalizeSchoolName(s)).filter(s => s.length > 0);
        if (normalizedSearchSchools.length > 0) {
          const beforeCount = properties.length;
          properties = properties.filter(p => {
            const propSchool = normalizeSchoolName(p.highSchool);
            if (!propSchool) return false;
            return normalizedSearchSchools.some(searchSchool => 
              propSchool === searchSchool || propSchool.includes(searchSchool) || searchSchool.includes(propSchool)
            );
          });
          console.log(`[HomeReview] High school filter: ${beforeCount} -> ${properties.length} (looking for: ${validHighSchools.join(', ')})`);
        }
      }
      
      // Apply requested limit after filtering
      const limit = params.limit || 50;
      const limitedProperties = properties.slice(0, limit);
      const hasMore = properties.length > limit || (data.offset + data.count) < data.total;
      
      console.log(`[HomeReview] Fetched ${data.properties?.length || 0}, filtered to ${properties.length}, returning ${limitedProperties.length}`);

      return {
        properties: limitedProperties,
        total: properties.length,
        hasMore,
      };
    } catch (error: any) {
      console.error('[HomeReview] Error searching properties:', error.message);
      throw new Error(`Failed to search properties from HomeReview: ${error.message}`);
    }
  }

  async getProperty(listingId: string): Promise<HomeReviewProperty | null> {
    try {
      const response = await this.client.get<HomeReviewPropertiesResponse>(
        `/api/mls/public/properties?listingId=${listingId}&limit=1`
      );

      if (response.data.properties && response.data.properties.length > 0) {
        return response.data.properties[0];
      }

      return null;
    } catch (error: any) {
      console.error('[HomeReview] Error fetching property:', error.message);
      return null;
    }
  }

  async getMarketStats(subdivision: string): Promise<MarketStats | null> {
    try {
      const response = await this.client.get<{ success: boolean; data: MarketStats }>(
        `/api/mls/stats?subdivision=${encodeURIComponent(subdivision)}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      console.error('[HomeReview] Error fetching market stats:', error.message);
      return null;
    }
  }

  async lookupNeighborhood(lat: number, lon: number): Promise<NeighborhoodBoundary | null> {
    try {
      const response = await this.client.get<{ success: boolean; data: NeighborhoodBoundary }>(
        `/api/neighborhoods/lookup?lat=${lat}&lon=${lon}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      console.error('[HomeReview] Error looking up neighborhood:', error.message);
      return null;
    }
  }

  async searchNeighborhoods(name: string, city?: string): Promise<NeighborhoodBoundary[]> {
    try {
      let url = `/api/neighborhoods/search?name=${encodeURIComponent(name)}`;
      if (city) url += `&city=${encodeURIComponent(city)}`;

      const response = await this.client.get<{ success: boolean; data: NeighborhoodBoundary[] }>(url);

      if (response.data.success) {
        return response.data.data;
      }

      return [];
    } catch (error: any) {
      console.error('[HomeReview] Error searching neighborhoods:', error.message);
      return [];
    }
  }

  async getNeighborhoodsByCity(city: string): Promise<NeighborhoodBoundary[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: NeighborhoodBoundary[] }>(
        `/api/neighborhoods/city/${encodeURIComponent(city)}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      return [];
    } catch (error: any) {
      console.error('[HomeReview] Error fetching city neighborhoods:', error.message);
      return [];
    }
  }

  async getNeighborhoodGeoJSON(city: string): Promise<any> {
    try {
      const response = await this.client.get<{ success: boolean; data: any }>(
        `/api/neighborhoods/geojson?city=${encodeURIComponent(city)}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      console.error('[HomeReview] Error fetching neighborhood GeoJSON:', error.message);
      return null;
    }
  }

  async matchMLSSubdivision(subdivision: string, city: string): Promise<NeighborhoodBoundary | null> {
    try {
      const response = await this.client.get<{ success: boolean; data: NeighborhoodBoundary }>(
        `/api/neighborhoods/match-mls?subdivision=${encodeURIComponent(subdivision)}&city=${encodeURIComponent(city)}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      console.error('[HomeReview] Error matching MLS subdivision:', error.message);
      return null;
    }
  }
}

let homeReviewClientInstance: HomeReviewClient | null = null;

export function getHomeReviewClient(): HomeReviewClient {
  if (!homeReviewClientInstance) {
    homeReviewClientInstance = new HomeReviewClient();
  }
  return homeReviewClientInstance;
}

export function mapHomeReviewPropertyToSchema(prop: HomeReviewProperty): any {
  return {
    id: prop.listingKey || prop.listingId,
    listingId: prop.listingId,
    listingKey: prop.listingKey,
    standardStatus: prop.standardStatus,
    mlsStatus: prop.standardStatus,
    listPrice: prop.listPrice,
    closePrice: prop.closePrice,
    originalListPrice: prop.originalListPrice,
    propertyType: prop.propertyType,
    propertySubType: prop.propertySubType,
    city: prop.city,
    stateOrProvince: prop.stateOrProvince,
    postalCode: prop.postalCode,
    countyOrParish: prop.countyOrParish,
    subdivisionName: prop.subdivisionName,
    streetNumber: prop.streetNumber,
    streetName: prop.streetName,
    streetSuffix: prop.streetSuffix,
    unitNumber: prop.unitNumber,
    unparsedAddress: prop.unparsedAddress,
    latitude: prop.latitude,
    longitude: prop.longitude,
    bedroomsTotal: prop.bedroomsTotal,
    bathroomsTotalInteger: prop.bathroomsTotalInteger,
    bathroomsFull: prop.bathroomsFull,
    bathroomsHalf: prop.bathroomsHalf,
    livingArea: prop.livingArea,
    lotSizeSquareFeet: prop.lotSizeSquareFeet,
    lotSizeAcres: prop.lotSizeAcres,
    yearBuilt: prop.yearBuilt,
    garageSpaces: prop.garageSpaces,
    storiesTotal: prop.storiesTotal,
    poolPrivateYN: prop.poolPrivateYn,
    waterfrontYN: prop.waterfrontYn,
    viewYN: prop.viewYn,
    associationFee: prop.associationFee,
    associationFeeFrequency: prop.associationFeeFrequency,
    taxAnnualAmount: prop.taxAnnualAmount,
    publicRemarks: prop.publicRemarks,
    privateRemarks: prop.privateRemarks,
    listingContractDate: prop.listingContractDate,
    closeDate: prop.closeDate,
    daysOnMarket: prop.daysOnMarket,
    cumulativeDaysOnMarket: prop.cumulativeDaysOnMarket,
    listAgentFullName: prop.listAgentFullName,
    listAgentEmail: prop.listAgentEmail,
    listAgentDirectPhone: prop.listAgentDirectPhone,
    listOfficeName: prop.listOfficeName,
    buyerAgentFullName: prop.buyerAgentFullName,
    buyerOfficeName: prop.buyerOfficeName,
    photos: prop.photos || [],
    photosCount: prop.photosCount || (prop.photos?.length || 0),
    virtualTourURLUnbranded: prop.virtualTourURLUnbranded,
    architecturalStyle: prop.architecturalStyle,
    appliances: prop.appliances,
    cooling: prop.cooling,
    heating: prop.heating,
    interiorFeatures: prop.interiorFeatures,
    exteriorFeatures: prop.exteriorFeatures,
    flooring: prop.flooring,
    parkingFeatures: prop.parkingFeatures,
    patioAndPorchFeatures: prop.patioAndPorchFeatures,
    securityFeatures: prop.securityFeatures,
    utilities: prop.utilities,
    waterSource: prop.waterSource,
    sewer: prop.sewer,
    elementarySchool: prop.elementarySchool,
    middleOrJuniorSchool: prop.middleOrJuniorSchool,
    highSchool: prop.highSchool,
    modificationTimestamp: prop.modificationTimestamp,
  };
}
