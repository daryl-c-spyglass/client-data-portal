import axios, { AxiosInstance } from 'axios';

const HOMEREVIEW_API_URL = 'https://home-review-ai-ryan1648.replit.app';

interface HomeReviewProperty {
  ListingId: string;
  ListingKey: string;
  StandardStatus: string;
  ListPrice: number;
  ClosePrice?: number;
  OriginalListPrice?: number;
  PropertyType: string;
  PropertySubType?: string;
  City: string;
  StateOrProvince: string;
  PostalCode: string;
  CountyOrParish?: string;
  SubdivisionName?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  UnitNumber?: string;
  UnparsedAddress?: string;
  Latitude?: number;
  Longitude?: number;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsFull?: number;
  BathroomsHalf?: number;
  LivingArea?: number;
  LotSizeSquareFeet?: number;
  LotSizeAcres?: number;
  YearBuilt?: number;
  GarageSpaces?: number;
  StoriesTotal?: number;
  PoolPrivateYN?: boolean;
  WaterfrontYN?: boolean;
  ViewYN?: boolean;
  AssociationFee?: number;
  AssociationFeeFrequency?: string;
  TaxAnnualAmount?: number;
  PublicRemarks?: string;
  PrivateRemarks?: string;
  ListingContractDate?: string;
  CloseDate?: string;
  DaysOnMarket?: number;
  CumulativeDaysOnMarket?: number;
  ListAgentFullName?: string;
  ListAgentEmail?: string;
  ListAgentDirectPhone?: string;
  ListOfficeName?: string;
  BuyerAgentFullName?: string;
  BuyerOfficeName?: string;
  Photos?: string[];
  PhotosCount?: number;
  VirtualTourURLUnbranded?: string;
  ArchitecturalStyle?: string[];
  Appliances?: string[];
  Cooling?: string[];
  Heating?: string[];
  InteriorFeatures?: string[];
  ExteriorFeatures?: string[];
  Flooring?: string[];
  ParkingFeatures?: string[];
  PatioAndPorchFeatures?: string[];
  SecurityFeatures?: string[];
  Utilities?: string[];
  WaterSource?: string[];
  Sewer?: string[];
  ElementarySchool?: string;
  MiddleOrJuniorSchool?: string;
  HighSchool?: string;
  ModificationTimestamp?: string;
  [key: string]: any;
}

interface HomeReviewPropertiesResponse {
  success: boolean;
  data: HomeReviewProperty[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
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

  constructor() {
    this.client = axios.create({
      baseURL: HOMEREVIEW_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
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

      if (params.postalCodes?.length) {
        params.postalCodes.forEach(z => queryParams.append('postalCode', z));
      }
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

      if (params.keywords) queryParams.append('keywords', params.keywords);
      if (params.listingAgentName) queryParams.append('listingAgentName', params.listingAgentName);
      if (params.listingOfficeName) queryParams.append('listingOfficeName', params.listingOfficeName);

      if (params.minDaysOnMarket !== undefined) queryParams.append('minDaysOnMarket', params.minDaysOnMarket.toString());
      if (params.maxDaysOnMarket !== undefined) queryParams.append('maxDaysOnMarket', params.maxDaysOnMarket.toString());

      if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      console.log(`[HomeReview] Fetching properties: /api/mls/public/properties?${queryParams.toString()}`);

      const response = await this.client.get<HomeReviewPropertiesResponse>(
        `/api/mls/public/properties?${queryParams.toString()}`
      );

      if (response.data.success) {
        return {
          properties: response.data.data,
          total: response.data.pagination.total,
          hasMore: response.data.pagination.hasMore,
        };
      }

      return { properties: [], total: 0, hasMore: false };
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

      if (response.data.success && response.data.data.length > 0) {
        return response.data.data[0];
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
    id: prop.ListingKey || prop.ListingId,
    listingId: prop.ListingId,
    listingKey: prop.ListingKey,
    standardStatus: prop.StandardStatus,
    mlsStatus: prop.StandardStatus,
    listPrice: prop.ListPrice,
    closePrice: prop.ClosePrice,
    originalListPrice: prop.OriginalListPrice,
    propertyType: prop.PropertyType,
    propertySubType: prop.PropertySubType,
    city: prop.City,
    stateOrProvince: prop.StateOrProvince,
    postalCode: prop.PostalCode,
    countyOrParish: prop.CountyOrParish,
    subdivisionName: prop.SubdivisionName,
    streetNumber: prop.StreetNumber,
    streetName: prop.StreetName,
    streetSuffix: prop.StreetSuffix,
    unitNumber: prop.UnitNumber,
    unparsedAddress: prop.UnparsedAddress,
    latitude: prop.Latitude,
    longitude: prop.Longitude,
    bedroomsTotal: prop.BedroomsTotal,
    bathroomsTotalInteger: prop.BathroomsTotalInteger,
    bathroomsFull: prop.BathroomsFull,
    bathroomsHalf: prop.BathroomsHalf,
    livingArea: prop.LivingArea,
    lotSizeSquareFeet: prop.LotSizeSquareFeet,
    lotSizeAcres: prop.LotSizeAcres,
    yearBuilt: prop.YearBuilt,
    garageSpaces: prop.GarageSpaces,
    storiesTotal: prop.StoriesTotal,
    poolPrivateYN: prop.PoolPrivateYN,
    waterfrontYN: prop.WaterfrontYN,
    viewYN: prop.ViewYN,
    associationFee: prop.AssociationFee,
    associationFeeFrequency: prop.AssociationFeeFrequency,
    taxAnnualAmount: prop.TaxAnnualAmount,
    publicRemarks: prop.PublicRemarks,
    privateRemarks: prop.PrivateRemarks,
    listingContractDate: prop.ListingContractDate,
    closeDate: prop.CloseDate,
    daysOnMarket: prop.DaysOnMarket,
    cumulativeDaysOnMarket: prop.CumulativeDaysOnMarket,
    listAgentFullName: prop.ListAgentFullName,
    listAgentEmail: prop.ListAgentEmail,
    listAgentDirectPhone: prop.ListAgentDirectPhone,
    listOfficeName: prop.ListOfficeName,
    buyerAgentFullName: prop.BuyerAgentFullName,
    buyerOfficeName: prop.BuyerOfficeName,
    photos: prop.Photos || [],
    photosCount: prop.PhotosCount || (prop.Photos?.length || 0),
    virtualTourURLUnbranded: prop.VirtualTourURLUnbranded,
    architecturalStyle: prop.ArchitecturalStyle,
    appliances: prop.Appliances,
    cooling: prop.Cooling,
    heating: prop.Heating,
    interiorFeatures: prop.InteriorFeatures,
    exteriorFeatures: prop.ExteriorFeatures,
    flooring: prop.Flooring,
    parkingFeatures: prop.ParkingFeatures,
    patioAndPorchFeatures: prop.PatioAndPorchFeatures,
    securityFeatures: prop.SecurityFeatures,
    utilities: prop.Utilities,
    waterSource: prop.WaterSource,
    sewer: prop.Sewer,
    elementarySchool: prop.ElementarySchool,
    middleOrJuniorSchool: prop.MiddleOrJuniorSchool,
    highSchool: prop.HighSchool,
    modificationTimestamp: prop.ModificationTimestamp,
  };
}
