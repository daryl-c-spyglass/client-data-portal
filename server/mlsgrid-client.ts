import axios, { AxiosInstance } from 'axios';

interface MLSGridConfig {
  apiUrl: string;
  apiToken: string;
}

interface RateLimiter {
  requestsThisSecond: number;
  requestsThisHour: number;
  lastRequestTime: number;
  hourStartTime: number;
}

export class MLSGridClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private readonly MAX_RPS = 2; // 2 requests per second
  private readonly MAX_RPH = 7200; // 7200 requests per hour

  constructor(config: MLSGridConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.rateLimiter = {
      requestsThisSecond: 0,
      requestsThisHour: 0,
      lastRequestTime: Date.now(),
      hourStartTime: Date.now(),
    };
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset hourly counter if an hour has passed
    if (now - this.rateLimiter.hourStartTime >= 3600000) {
      this.rateLimiter.requestsThisHour = 0;
      this.rateLimiter.hourStartTime = now;
    }

    // Reset per-second counter if a second has passed
    if (now - this.rateLimiter.lastRequestTime >= 1000) {
      this.rateLimiter.requestsThisSecond = 0;
      this.rateLimiter.lastRequestTime = now;
    }

    // Check if we're over limits
    if (this.rateLimiter.requestsThisSecond >= this.MAX_RPS) {
      const waitTime = 1000 - (now - this.rateLimiter.lastRequestTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimiter.requestsThisSecond = 0;
      this.rateLimiter.lastRequestTime = Date.now();
    }

    if (this.rateLimiter.requestsThisHour >= this.MAX_RPH) {
      throw new Error('Hourly rate limit exceeded (7200 requests/hour)');
    }

    // Increment counters
    this.rateLimiter.requestsThisSecond++;
    this.rateLimiter.requestsThisHour++;
  }

  async getProperties(params: {
    modificationTimestamp?: string;
    limit?: number;
    skip?: number;
  }): Promise<any> {
    await this.checkRateLimit();

    const queryParams = new URLSearchParams();
    if (params.modificationTimestamp) {
      queryParams.append('$filter', `ModificationTimestamp gt ${params.modificationTimestamp}`);
    }
    if (params.limit) {
      queryParams.append('$top', params.limit.toString());
    }
    if (params.skip) {
      queryParams.append('$skip', params.skip.toString());
    }

    const response = await this.client.get(`/Property?${queryParams.toString()}`);
    return response.data;
  }

  async getProperty(id: string): Promise<any> {
    await this.checkRateLimit();

    const response = await this.client.get(`/Property(${id})`);
    return response.data;
  }

  async getMedia(params: {
    modificationTimestamp?: string;
    limit?: number;
    skip?: number;
  }): Promise<any> {
    await this.checkRateLimit();

    const queryParams = new URLSearchParams();
    if (params.modificationTimestamp) {
      queryParams.append('$filter', `ModificationTimestamp gt ${params.modificationTimestamp}`);
    }
    if (params.limit) {
      queryParams.append('$top', params.limit.toString());
    }
    if (params.skip) {
      queryParams.append('$skip', params.skip.toString());
    }

    const response = await this.client.get(`/Media?${queryParams.toString()}`);
    return response.data;
  }

  async syncProperties(lastSyncTime?: Date): Promise<void> {
    const timestamp = lastSyncTime?.toISOString() || new Date(0).toISOString();
    
    let hasMore = true;
    let skip = 0;
    const limit = 100;

    while (hasMore) {
      const data = await this.getProperties({
        modificationTimestamp: timestamp,
        limit,
        skip,
      });

      if (data.value && data.value.length > 0) {
        // Process properties here - would be handled by the caller
        skip += data.value.length;
        hasMore = data.value.length === limit;
      } else {
        hasMore = false;
      }
    }
  }

  async searchProperties(params: {
    standardStatus?: string[];
    minListPrice?: number;
    maxListPrice?: number;
    minBedroomsTotal?: number;
    maxBedroomsTotal?: number;
    minBathroomsTotalInteger?: number;
    maxBathroomsTotalInteger?: number;
    minLivingArea?: number;
    maxLivingArea?: number;
    minYearBuilt?: number;
    maxYearBuilt?: number;
    postalCodes?: string[];
    cities?: string[];
    subdivisions?: string[];
    propertySubType?: string[];
    limit?: number;
    skip?: number;
  }): Promise<any> {
    await this.checkRateLimit();

    const filters: string[] = [];
    
    // Status filter (default to Active for IDX)
    if (params.standardStatus && params.standardStatus.length > 0) {
      const statusFilters = params.standardStatus.map(s => `StandardStatus eq '${s}'`);
      filters.push(`(${statusFilters.join(' or ')})`);
    } else {
      filters.push("StandardStatus eq 'Active'");
    }
    
    // Price filters
    if (params.minListPrice) {
      filters.push(`ListPrice ge ${params.minListPrice}`);
    }
    if (params.maxListPrice) {
      filters.push(`ListPrice le ${params.maxListPrice}`);
    }
    
    // Bedrooms
    if (params.minBedroomsTotal) {
      filters.push(`BedroomsTotal ge ${params.minBedroomsTotal}`);
    }
    if (params.maxBedroomsTotal) {
      filters.push(`BedroomsTotal le ${params.maxBedroomsTotal}`);
    }
    
    // Bathrooms
    if (params.minBathroomsTotalInteger) {
      filters.push(`BathroomsTotalInteger ge ${params.minBathroomsTotalInteger}`);
    }
    if (params.maxBathroomsTotalInteger) {
      filters.push(`BathroomsTotalInteger le ${params.maxBathroomsTotalInteger}`);
    }
    
    // Living area
    if (params.minLivingArea) {
      filters.push(`LivingArea ge ${params.minLivingArea}`);
    }
    if (params.maxLivingArea) {
      filters.push(`LivingArea le ${params.maxLivingArea}`);
    }
    
    // Year built
    if (params.minYearBuilt) {
      filters.push(`YearBuilt ge ${params.minYearBuilt}`);
    }
    if (params.maxYearBuilt) {
      filters.push(`YearBuilt le ${params.maxYearBuilt}`);
    }
    
    // Postal codes
    if (params.postalCodes && params.postalCodes.length > 0) {
      const postalFilters = params.postalCodes.map(z => `PostalCode eq '${z}'`);
      filters.push(`(${postalFilters.join(' or ')})`);
    }
    
    // Cities
    if (params.cities && params.cities.length > 0) {
      const cityFilters = params.cities.map(c => `City eq '${c}'`);
      filters.push(`(${cityFilters.join(' or ')})`);
    }
    
    // Subdivisions
    if (params.subdivisions && params.subdivisions.length > 0) {
      const subdivFilters = params.subdivisions.map(s => `SubdivisionName eq '${s}'`);
      filters.push(`(${subdivFilters.join(' or ')})`);
    }
    
    // Property sub type
    if (params.propertySubType && params.propertySubType.length > 0) {
      const typeFilters = params.propertySubType.map(t => `PropertySubType eq '${t}'`);
      filters.push(`(${typeFilters.join(' or ')})`);
    }

    const queryParams = new URLSearchParams();
    if (filters.length > 0) {
      queryParams.append('$filter', filters.join(' and '));
    }
    if (params.limit) {
      queryParams.append('$top', params.limit.toString());
    }
    if (params.skip) {
      queryParams.append('$skip', params.skip.toString());
    }
    
    // Order by modification timestamp (most recently modified first)
    queryParams.append('$orderby', 'ModificationTimestamp desc');

    console.log('[MLS Grid] Search query:', queryParams.toString());
    
    try {
      const response = await this.client.get(`/Property?${queryParams.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('[MLS Grid] API Error:', error.response?.status, error.response?.data);
      throw error;
    }
  }
}

export function createMLSGridClient(): MLSGridClient | null {
  const apiUrl = process.env.MLSGRID_API_URL;
  const apiToken = process.env.MLSGRID_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.warn('MLS Grid API credentials not found. Some features will be disabled.');
    return null;
  }

  return new MLSGridClient({
    apiUrl,
    apiToken,
  });
}
