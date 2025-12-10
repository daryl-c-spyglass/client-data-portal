import axios, { AxiosInstance } from 'axios';

const REPLIERS_API_URL = 'https://api.repliers.io';

interface RepliersConfig {
  apiKey: string;
}

interface ListingsSearchParams {
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  propertyType?: string;
  city?: string;
  postalCode?: string;
  neighborhood?: string;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  pageNum?: number;
  resultsPerPage?: number;
  sortBy?: string;
  fields?: string;
  class?: string;
}

interface RepliersListing {
  mlsNumber: string;
  listPrice: number;
  soldPrice?: number;
  closePrice?: number;
  originalPrice?: number;
  status: string;
  address: {
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
  details: {
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
  daysOnMarket?: number;
  livingArea?: number;
  yearBuilt?: number;
  lotSizeSquareFeet?: number;
  lotSizeAcres?: number;
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
}

interface ListingsResponse {
  listings: RepliersListing[];
  count: number;
  numPages: number;
  currentPage: number;
  resultsPerPage: number;
}

interface LocationsResponse {
  areas?: string[];
  cities?: string[];
  neighborhoods?: string[];
}

interface NLPResponse {
  url: string;
  nlpId: string;
  summary?: string;
}

class RepliersClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: RepliersConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: REPLIERS_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'REPLIERS-API-KEY': this.apiKey,
      },
      timeout: 30000,
    });
  }

  async searchListings(params: ListingsSearchParams = {}): Promise<ListingsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.status) queryParams.append('status', params.status);
      if (params.minPrice) queryParams.append('minPrice', params.minPrice.toString());
      if (params.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
      if (params.minBeds) queryParams.append('minBeds', params.minBeds.toString());
      if (params.maxBeds) queryParams.append('maxBeds', params.maxBeds.toString());
      if (params.minBaths) queryParams.append('minBaths', params.minBaths.toString());
      if (params.maxBaths) queryParams.append('maxBaths', params.maxBaths.toString());
      if (params.minSqft) queryParams.append('minSqft', params.minSqft.toString());
      if (params.maxSqft) queryParams.append('maxSqft', params.maxSqft.toString());
      if (params.propertyType) queryParams.append('class', params.propertyType.toLowerCase());
      if (params.city) queryParams.append('city', params.city);
      if (params.postalCode) queryParams.append('zip', params.postalCode);
      if (params.neighborhood) queryParams.append('neighborhood', params.neighborhood);
      if (params.minLat) queryParams.append('minLat', params.minLat.toString());
      if (params.maxLat) queryParams.append('maxLat', params.maxLat.toString());
      if (params.minLng) queryParams.append('minLng', params.minLng.toString());
      if (params.maxLng) queryParams.append('maxLng', params.maxLng.toString());
      if (params.pageNum) queryParams.append('pageNum', params.pageNum.toString());
      if (params.resultsPerPage) queryParams.append('resultsPerPage', params.resultsPerPage.toString());
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.fields) queryParams.append('fields', params.fields);
      if (params.class) queryParams.append('class', params.class);

      const response = await this.client.get(`/listings?${queryParams.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('Repliers searchListings error:', error.response?.data || error.message);
      throw new Error(`Failed to search listings: ${error.message}`);
    }
  }

  async getListing(mlsNumber: string, fields?: string): Promise<RepliersListing | null> {
    try {
      const queryParams = fields ? `?fields=${fields}` : '';
      const response = await this.client.get(`/listings/${mlsNumber}${queryParams}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Repliers getListing error:', error.response?.data || error.message);
      throw new Error(`Failed to get listing: ${error.message}`);
    }
  }

  async getLocations(params: { area?: string; city?: string } = {}): Promise<LocationsResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params.area) queryParams.append('area', params.area);
      if (params.city) queryParams.append('city', params.city);
      
      const response = await this.client.get(`/listings/locations?${queryParams.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('Repliers getLocations error:', error.response?.data || error.message);
      throw new Error(`Failed to get locations: ${error.message}`);
    }
  }

  async nlpSearch(prompt: string, nlpId?: string): Promise<NLPResponse> {
    try {
      const body: any = { prompt };
      if (nlpId) body.nlpId = nlpId;
      
      const response = await this.client.post('/nlp', body);
      return response.data;
    } catch (error: any) {
      console.error('Repliers NLP search error:', error.response?.data || error.message);
      throw new Error(`Failed to perform NLP search: ${error.message}`);
    }
  }

  mapToStandardProperty(listing: any): any {
    const address = listing.address || {};
    const details = listing.details || {};
    const map = listing.map || {};
    
    const streetNumber = address.streetNumber || listing.streetNumber;
    const streetName = address.streetName || listing.streetName;
    const streetSuffix = address.streetSuffix || listing.streetSuffix;
    const unitNumber = address.unitNumber || listing.unitNumber;
    
    const fullAddress = listing.unparsedAddress || [
      streetNumber,
      streetName,
      streetSuffix,
      unitNumber ? `#${unitNumber}` : null,
    ].filter(Boolean).join(' ');

    const city = address.city || listing.city;
    const state = address.state || listing.stateOrProvince;
    const zip = address.zip || listing.postalCode;
    const country = address.country || listing.country;
    const neighborhood = address.neighborhood || listing.subdivisionName;
    
    const latitude = map.latitude ?? listing.latitude;
    const longitude = map.longitude ?? listing.longitude;
    
    const bedrooms = details.bedrooms ?? listing.bedroomsTotal ?? listing.beds;
    const bathrooms = details.bathrooms ?? listing.bathroomsTotalInteger ?? listing.baths;
    const sqft = details.sqft || listing.livingArea || listing.sqft;
    const lotSize = details.lotSize || listing.lotSizeSquareFeet;
    const yearBuilt = details.yearBuilt || listing.yearBuilt;
    const propertyType = details.propertyType || listing.propertyType || 'Residential';
    const propertySubType = details.style || listing.propertySubType;
    const description = details.description || listing.publicRemarks;
    
    const mlsNumber = listing.mlsNumber || listing.listingId;

    return {
      id: mlsNumber,
      listingId: mlsNumber,
      listPrice: listing.listPrice,
      closePrice: listing.soldPrice || listing.closePrice,
      originalListPrice: listing.originalPrice || listing.originalListPrice,
      standardStatus: this.mapStatus(listing.status || listing.standardStatus || 'Active'),
      propertyType: propertyType,
      propertySubType: propertySubType,
      bedroomsTotal: bedrooms,
      bathroomsTotalInteger: Array.isArray(bathrooms) ? null : bathrooms,
      livingArea: sqft,
      lotSizeSquareFeet: lotSize,
      yearBuilt: yearBuilt,
      garageSpaces: details.garage || listing.garageSpaces,
      poolFeatures: listing.poolFeatures || (details.pool ? [details.pool] : []),
      unparsedAddress: fullAddress,
      streetNumber: streetNumber,
      streetName: streetName,
      streetSuffix: streetSuffix,
      unitNumber: unitNumber,
      city: city,
      stateOrProvince: state,
      postalCode: zip,
      country: country,
      subdivisionName: neighborhood,
      latitude: latitude,
      longitude: longitude,
      photos: (listing.images || listing.photos || []).map((img: string) => 
        img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`
      ),
      publicRemarks: description,
      listingContractDate: listing.listDate || listing.listingContractDate,
      closeDate: listing.soldDate || listing.closeDate,
      daysOnMarket: listing.daysOnMarket,
      listOfficeName: listing.office?.name || listing.listOfficeName,
      listOfficePhone: listing.office?.phone || listing.listOfficePhone,
      listAgentFullName: listing.agent?.name || listing.listAgentFullName,
      listAgentEmail: listing.agent?.email || listing.listAgentEmail,
      listAgentDirectPhone: listing.agent?.phone || listing.listAgentDirectPhone,
      mlsNumber: mlsNumber,
      raw: listing.raw,
    };
  }

  private mapStatus(status: string): string {
    // Status mapping per Repliers API:
    // A = Active
    // U = Active Under Contract
    // P = Pending
    // S = Sold/Closed
    const statusMap: Record<string, string> = {
      'A': 'Active',
      'U': 'Active Under Contract',
      'S': 'Closed',
      'X': 'Expired',
      'W': 'Withdrawn',
      'C': 'Cancelled',
      'P': 'Pending',
      'T': 'Terminated',
      'Active': 'Active',
      'Sold': 'Closed',
      'Pending': 'Pending',
      'Expired': 'Expired',
      'Cancelled': 'Cancelled',
      'Active Under Contract': 'Active Under Contract',
    };
    return statusMap[status] || status;
  }
}

let repliersClient: RepliersClient | null = null;

export function initRepliersClient(): RepliersClient | null {
  const apiKey = process.env.REPLIERS_API_KEY;
  
  if (!apiKey) {
    console.warn('REPLIERS_API_KEY not configured');
    return null;
  }

  repliersClient = new RepliersClient({ apiKey });
  console.log('🏠 Repliers API client initialized');
  return repliersClient;
}

export function getRepliersClient(): RepliersClient | null {
  return repliersClient;
}

export function isRepliersConfigured(): boolean {
  return repliersClient !== null;
}

export { RepliersClient, RepliersListing, ListingsSearchParams, ListingsResponse };
