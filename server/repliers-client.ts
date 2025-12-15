import axios, { AxiosInstance } from 'axios';
import { normalizeRepliersClass } from '../shared/repliers-helpers';

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
  propertySubType?: string;
  style?: string;
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

// Location with boundary polygon for neighborhood reviews
interface LocationWithBoundary {
  area?: string;
  city?: string;
  neighborhood?: string;
  class?: string;
  map?: {
    boundary?: number[][][]; // GeoJSON polygon coordinates [[lng, lat], ...]
    latitude?: number;
    longitude?: number;
  };
}

interface LocationsWithBoundaryResponse {
  locations: LocationWithBoundary[];
  count: number;
}

interface NLPResponse {
  url: string;
  nlpId: string;
  summary?: string;
}

// Cached subtype counts for Active/UC residential listings
interface SubtypeCache {
  counts: Record<string, number>;
  timestamp: number;
  isRefreshing: boolean;
}

let subtypeCache: SubtypeCache | null = null;
const SUBTYPE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

class RepliersClient {
  private client: AxiosInstance;
  private apiKey: string;
  private static readonly MAX_RETRIES = 3;
  private static readonly INITIAL_BACKOFF_MS = 1000;

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

  // Retry with exponential backoff for rate limit (429) errors
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string = 'API call'
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= RepliersClient.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        
        // Only retry on 429 (Too Many Requests) or 503 (Service Unavailable)
        if (status !== 429 && status !== 503) {
          throw error;
        }
        
        if (attempt < RepliersClient.MAX_RETRIES) {
          const backoffMs = RepliersClient.INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.log(`⏳ ${context}: Rate limited (${status}), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${RepliersClient.MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    throw lastError;
  }
  
  // Property type classification mapping - used for inventory counts and display
  // Returns granular property type for accurate counts
  classifyPropertyType(listing: RepliersListing): string {
    const style = (listing.details?.style || '').toLowerCase();
    const propertyType = (listing.details?.propertyType || '').toLowerCase();
    const raw = listing.raw || {};
    const rawSubtype = (raw.propertySubType || raw.PropertySubType || '').toLowerCase();
    const rawType = (raw.propertyType || raw.PropertyType || '').toLowerCase();
    
    // Check all available fields for classification
    const combined = `${style} ${propertyType} ${rawSubtype} ${rawType}`;
    
    // Manufactured Home / Mobile Home - check first (before Single Family)
    if (combined.includes('manufactured') || combined.includes('mobile home') || 
        combined.includes('modular') || combined.includes('prefab')) {
      return 'Manufactured Home';
    }
    
    // Condominium
    if (combined.includes('condo')) {
      return 'Condominium';
    }
    
    // Townhouse
    if (combined.includes('town') || combined.includes('row') || combined.includes('attached')) {
      return 'Townhouse';
    }
    
    // Multi-Family
    if (combined.includes('multi') || combined.includes('duplex') || 
        combined.includes('triplex') || combined.includes('fourplex') ||
        combined.includes('2-4 units') || combined.includes('apartment')) {
      return 'Multi-Family';
    }
    
    // Multiple Lots (Adjacent) - check before general land
    if (combined.includes('multiple lot') || combined.includes('adjacent lot')) {
      return 'Multiple Lots (Adjacent)';
    }
    
    // Unimproved Land (no structures)
    if ((combined.includes('unimproved') || combined.includes('vacant')) && 
        (combined.includes('land') || combined.includes('lot'))) {
      return 'Unimproved Land';
    }
    
    // Ranch - check before general land to separate ranches from lots
    if (combined.includes('ranch') || combined.includes('farm') || combined.includes('acreage')) {
      return 'Ranch';
    }
    
    // General Land/Lots
    if (combined.includes('land') || combined.includes('lot')) {
      return 'Unimproved Land';
    }
    
    // Commercial/Industrial/Other
    if (combined.includes('commercial') || combined.includes('industrial') ||
        combined.includes('retail') || combined.includes('office')) {
      return 'Other';
    }
    
    // Default to Single Family for residential
    return 'Single Family Residence';
  }
  
  // Legacy classification for backward compatibility - maps to display buckets
  private classifySubtype(listing: RepliersListing): string {
    return this.classifyPropertyType(listing);
  }
  
  // Aggregate subtype counts by scanning all Active/UC residential listings
  async aggregateResidentialSubtypeCounts(): Promise<Record<string, number>> {
    // Return cached data if still valid
    if (subtypeCache && 
        (Date.now() - subtypeCache.timestamp) < SUBTYPE_CACHE_TTL_MS) {
      return subtypeCache.counts;
    }
    
    // Prevent concurrent refreshes
    if (subtypeCache?.isRefreshing) {
      return subtypeCache.counts;
    }
    
    if (subtypeCache) {
      subtypeCache.isRefreshing = true;
    }
    
    console.log('🔄 Aggregating residential subtype counts from Repliers...');
    const startTime = Date.now();
    
    const counts: Record<string, number> = {
      'Single Family Residence': 0,
      'Condominium': 0,
      'Townhouse': 0,
      'Multi-Family': 0,
      'Manufactured Home': 0,
      'Ranch': 0,
      'Unimproved Land': 0,
      'Multiple Lots (Adjacent)': 0,
      'Other': 0,
    };
    
    try {
      // Scan both Active and Under Contract residential listings
      for (const status of ['A', 'U']) {
        let pageNum = 1;
        let hasMore = true;
        
        while (hasMore) {
          const response = await this.searchListings({
            status,
            class: 'residential',
            resultsPerPage: 100,
            pageNum,
            fields: 'mlsNumber,details.style,details.propertyType,raw',
          });
          
          // Classify each listing
          for (const listing of response.listings || []) {
            const subtype = this.classifySubtype(listing);
            counts[subtype] = (counts[subtype] || 0) + 1;
          }
          
          // Check if there are more pages
          if (pageNum >= response.numPages || response.listings.length < 100) {
            hasMore = false;
          } else {
            pageNum++;
            // Rate limit: max 2 req/sec per API limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      // Cache the results
      subtypeCache = {
        counts,
        timestamp: Date.now(),
        isRefreshing: false,
      };
      
      const duration = Date.now() - startTime;
      console.log(`✅ Subtype aggregation complete in ${duration}ms:`, counts);
      
      return counts;
    } catch (error) {
      console.error('Error aggregating subtype counts:', error);
      if (subtypeCache) {
        subtypeCache.isRefreshing = false;
      }
      // Return empty counts on error
      return counts;
    }
  }

  async searchListings(params: ListingsSearchParams = {}): Promise<ListingsResponse> {
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
    if (params.propertyType) queryParams.append('class', normalizeRepliersClass(params.propertyType));
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
    if (params.class) queryParams.append('class', normalizeRepliersClass(params.class));

    try {
      return await this.withRetry(
        () => this.client.get(`/listings?${queryParams.toString()}`).then(r => r.data),
        `searchListings(status=${params.status || 'any'})`
      );
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
    // CRITICAL: In Repliers API, "neighborhood" field is actually the SUBDIVISION (tract/community label)
    // True "neighborhood" must come from boundary polygon resolution, NOT from listing data
    // Repliers uses "neighborhood" to mean subdivision - map it correctly
    const subdivisionFromRepliers = address.neighborhood || listing.neighborhood || address.subdivisionName || listing.subdivisionName || details.subdivision;
    // Do NOT set neighborhood from listing data - it must be resolved from boundaries only
    
    const latitude = map.latitude ?? listing.latitude;
    const longitude = map.longitude ?? listing.longitude;
    
    // Try multiple field names for beds/baths - Repliers uses various field names
    const bedrooms = details.bedrooms ?? details.numBedrooms ?? listing.bedroomsTotal ?? listing.beds ?? listing.bedrooms ?? null;
    const bathrooms = details.bathrooms ?? details.numBathrooms ?? listing.bathroomsTotalInteger ?? listing.baths ?? listing.bathrooms ?? null;
    // Don't default to 0 - preserve null for missing values
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
      neighborhood: null,  // MUST be resolved from boundary polygons, never from listing data
      subdivisionName: subdivisionFromRepliers,  // Repliers "neighborhood" field is actually subdivision
      subdivision: subdivisionFromRepliers,  // Also set subdivision for compatibility
      elementarySchool: details.elementarySchool || listing.elementarySchool || listing.schools?.elementary || listing.raw?.ElementarySchool || null,
      middleOrJuniorSchool: details.middleSchool || listing.middleSchool || listing.schools?.middle || listing.raw?.MiddleOrJuniorSchool || null,
      highSchool: details.highSchool || listing.highSchool || listing.schools?.high || listing.raw?.HighSchool || null,
      schoolDistrict: details.schoolDistrict || listing.schoolDistrict || listing.raw?.SchoolDistrict || null,
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
    // U = Under Contract
    // P = Pending
    // S = Sold/Closed
    const statusMap: Record<string, string> = {
      'A': 'Active',
      'U': 'Under Contract',
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
      'Active Under Contract': 'Under Contract',
      'Under Contract': 'Under Contract',
    };
    return statusMap[status] || status;
  }

  // Get locations (neighborhoods) with boundary polygons
  async getLocationsWithBoundaries(params: {
    city?: string;
    search?: string;
    class?: string;
  } = {}): Promise<LocationWithBoundary[]> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('hasBoundary', 'true');
      if (params.city) queryParams.append('city', params.city);
      if (params.search) queryParams.append('search', params.search);
      if (params.class) queryParams.append('class', params.class);
      
      const response = await this.withRetry(
        () => this.client.get(`/locations?${queryParams.toString()}`).then(r => r.data),
        'getLocationsWithBoundaries'
      );
      
      // Response may be an array or object with locations property
      if (Array.isArray(response)) {
        return response;
      }
      return response.locations || [];
    } catch (error: any) {
      console.error('Repliers getLocationsWithBoundaries error:', error.response?.data || error.message);
      throw new Error(`Failed to get locations with boundaries: ${error.message}`);
    }
  }

  // Search listings within a polygon boundary using POST
  // Mirrors searchListings parameter handling for consistency
  async searchListingsInBoundary(
    boundary: number[][][],
    params: ListingsSearchParams = {}
  ): Promise<ListingsResponse> {
    try {
      const requestBody: any = {
        map: boundary,
      };
      
      // Add all search params to the body (matching searchListings parity)
      if (params.status) requestBody.status = params.status;
      if (params.minPrice) requestBody.minPrice = params.minPrice;
      if (params.maxPrice) requestBody.maxPrice = params.maxPrice;
      if (params.minBeds) requestBody.minBeds = params.minBeds;
      if (params.maxBeds) requestBody.maxBeds = params.maxBeds;
      if (params.minBaths) requestBody.minBaths = params.minBaths;
      if (params.maxBaths) requestBody.maxBaths = params.maxBaths;
      if (params.minSqft) requestBody.minSqft = params.minSqft;
      if (params.maxSqft) requestBody.maxSqft = params.maxSqft;
      // Handle both propertyType and class - matching searchListings behavior
      if (params.propertyType) requestBody.class = normalizeRepliersClass(params.propertyType);
      if (params.class) requestBody.class = normalizeRepliersClass(params.class);
      // Location filters for additional filtering within boundary
      if (params.city) requestBody.city = params.city;
      if (params.postalCode) requestBody.zip = params.postalCode;
      if (params.neighborhood) requestBody.neighborhood = params.neighborhood;
      // Pagination and sorting
      if (params.pageNum) requestBody.pageNum = params.pageNum;
      if (params.resultsPerPage) requestBody.resultsPerPage = params.resultsPerPage;
      if (params.sortBy) requestBody.sortBy = params.sortBy;
      if (params.fields) requestBody.fields = params.fields;

      return await this.withRetry(
        () => this.client.post('/listings', requestBody).then(r => r.data),
        'searchListingsInBoundary'
      );
    } catch (error: any) {
      console.error('Repliers searchListingsInBoundary error:', error.response?.data || error.message);
      throw new Error(`Failed to search listings in boundary: ${error.message}`);
    }
  }

  // Find neighborhood containing a specific point (lat/lng)
  // Uses point-in-polygon algorithm to check which neighborhood boundary contains the point
  async findNeighborhoodByPoint(
    latitude: number,
    longitude: number,
    city?: string
  ): Promise<LocationWithBoundary | null> {
    try {
      // Get all neighborhoods with boundaries for the city
      const neighborhoods = await this.getLocationsWithBoundaries({
        city,
        class: 'neighborhood',
      });
      
      // Check each neighborhood boundary to see if point is inside
      for (const neighborhood of neighborhoods) {
        if (neighborhood.map?.boundary) {
          if (this.isPointInPolygon(longitude, latitude, neighborhood.map.boundary)) {
            return neighborhood;
          }
        }
      }
      
      return null;
    } catch (error: any) {
      console.error('Error finding neighborhood by point:', error.message);
      return null;
    }
  }

  // Ray casting algorithm for point-in-polygon detection
  private isPointInPolygon(x: number, y: number, polygon: number[][][]): boolean {
    // polygon is array of rings, first ring is outer boundary
    const ring = polygon[0];
    if (!ring || ring.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  // Autocomplete locations for neighborhood search
  async autocompleteLocations(search: string): Promise<LocationWithBoundary[]> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('search', search);
      
      const response = await this.withRetry(
        () => this.client.get(`/locations/autocomplete?${queryParams.toString()}`).then(r => r.data),
        'autocompleteLocations'
      );
      
      if (Array.isArray(response)) {
        return response;
      }
      return response.locations || response.suggestions || [];
    } catch (error: any) {
      console.error('Repliers autocompleteLocations error:', error.response?.data || error.message);
      throw new Error(`Failed to autocomplete locations: ${error.message}`);
    }
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

export { RepliersClient, RepliersListing, ListingsSearchParams, ListingsResponse, LocationWithBoundary };
