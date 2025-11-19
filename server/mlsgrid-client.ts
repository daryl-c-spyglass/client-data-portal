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
