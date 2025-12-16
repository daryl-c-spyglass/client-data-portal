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

    // MLS Grid API has limited filter field support
    // Only use StandardStatus filter, then apply other filters server-side
    const queryParams = new URLSearchParams();
    
    // Status filter (default to Active for IDX)
    if (params.standardStatus && params.standardStatus.length > 0) {
      const statusFilters = params.standardStatus.map(s => `StandardStatus eq '${s}'`);
      queryParams.append('$filter', `(${statusFilters.join(' or ')})`);
    } else {
      queryParams.append('$filter', "StandardStatus eq 'Active'");
    }
    
    // Fetch more results to allow for server-side filtering
    // We'll fetch up to 200 and filter down to the requested limit
    const fetchLimit = Math.min(200, (params.limit || 50) * 4);
    queryParams.append('$top', fetchLimit.toString());
    
    if (params.skip) {
      queryParams.append('$skip', params.skip.toString());
    }
    
    // Order by modification timestamp (most recently modified first)
    queryParams.append('$orderby', 'ModificationTimestamp desc');

    console.log('[MLS Grid] Search query:', queryParams.toString());
    
    try {
      const response = await this.client.get(`/Property?${queryParams.toString()}`);
      let properties = response.data.value || [];
      
      // Apply filters server-side since MLS Grid API doesn't support them
      properties = properties.filter((prop: any) => {
        // Price filters
        if (params.minListPrice && (prop.ListPrice || 0) < params.minListPrice) return false;
        if (params.maxListPrice && (prop.ListPrice || Infinity) > params.maxListPrice) return false;
        
        // Bedrooms
        if (params.minBedroomsTotal && (prop.BedroomsTotal || 0) < params.minBedroomsTotal) return false;
        if (params.maxBedroomsTotal && (prop.BedroomsTotal || Infinity) > params.maxBedroomsTotal) return false;
        
        // Bathrooms
        if (params.minBathroomsTotalInteger && (prop.BathroomsTotalInteger || 0) < params.minBathroomsTotalInteger) return false;
        if (params.maxBathroomsTotalInteger && (prop.BathroomsTotalInteger || Infinity) > params.maxBathroomsTotalInteger) return false;
        
        // Living area
        if (params.minLivingArea && (prop.LivingArea || 0) < params.minLivingArea) return false;
        if (params.maxLivingArea && (prop.LivingArea || Infinity) > params.maxLivingArea) return false;
        
        // Year built
        if (params.minYearBuilt && (prop.YearBuilt || 0) < params.minYearBuilt) return false;
        if (params.maxYearBuilt && (prop.YearBuilt || Infinity) > params.maxYearBuilt) return false;
        
        // Postal codes
        if (params.postalCodes && params.postalCodes.length > 0) {
          if (!params.postalCodes.includes(prop.PostalCode)) return false;
        }
        
        // Cities (case-insensitive)
        if (params.cities && params.cities.length > 0) {
          const propCity = (prop.City || '').toLowerCase();
          if (!params.cities.some(c => c.toLowerCase() === propCity)) return false;
        }
        
        // Subdivisions (case-insensitive partial match)
        if (params.subdivisions && params.subdivisions.length > 0) {
          const propSubdiv = (prop.SubdivisionName || '').toLowerCase();
          if (!params.subdivisions.some(s => propSubdiv.includes(s.toLowerCase()))) return false;
        }
        
        // Property sub type
        if (params.propertySubType && params.propertySubType.length > 0) {
          if (!params.propertySubType.includes(prop.PropertySubType)) return false;
        }
        
        return true;
      });
      
      // Apply limit after filtering
      const limit = params.limit || 50;
      const limitedProperties = properties.slice(0, limit);
      
      console.log(`[MLS Grid] Fetched ${response.data.value?.length || 0}, filtered to ${properties.length}, returning ${limitedProperties.length}`);
      
      return {
        ...response.data,
        value: limitedProperties,
        '@odata.count': properties.length
      };
    } catch (error: any) {
      console.error('[MLS Grid] API Error:', error.response?.status, error.response?.data);
      throw error;
    }
  }
}

export function createMLSGridClient(): MLSGridClient | null {
  const apiUrl = process.env.MLSGRID_API_URL;
  // Support both old MLSGRID_API_TOKEN and new MLS_GRID_BBO/MLS_GRID_VOW secrets
  // BBO (Broker Back Office) is preferred for sold data access needed for CMAs
  const apiToken = process.env.MLS_GRID_BBO || process.env.MLS_GRID_VOW || process.env.MLSGRID_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.warn('MLS Grid API credentials not found. Some features will be disabled.');
    console.warn('  MLSGRID_API_URL:', apiUrl ? 'set' : 'missing');
    console.warn('  MLS_GRID_BBO:', process.env.MLS_GRID_BBO ? 'set' : 'missing');
    console.warn('  MLS_GRID_VOW:', process.env.MLS_GRID_VOW ? 'set' : 'missing');
    return null;
  }

  const tokenSource = process.env.MLS_GRID_BBO ? 'BBO' : (process.env.MLS_GRID_VOW ? 'VOW' : 'legacy');
  console.log(`🔑 MLS Grid API initialized with ${tokenSource} credentials`);

  return new MLSGridClient({
    apiUrl,
    apiToken,
  });
}
