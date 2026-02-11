/**
 * Client for external Home Review AI API integration
 */

const EXTERNAL_API_BASE_URL = process.env.EXTERNAL_API_BASE_URL || 'https://home-review-ai-ryan1648.replit.app';
const API_KEY = process.env.EXTERNAL_API_KEY;

interface ExternalApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch users from the external API
 */
export async function fetchExternalUsers(): Promise<ExternalApiResponse<any[]>> {
  try {
    if (!API_KEY) {
      throw new Error('EXTERNAL_API_KEY not configured');
    }

    const response = await fetch(`${EXTERNAL_API_BASE_URL}/api/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`External API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error('Error fetching external users:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generic fetch function for other endpoints
 */
export async function fetchFromExternalApi(endpoint: string, options?: RequestInit): Promise<ExternalApiResponse<any>> {
  try {
    if (!API_KEY) {
      throw new Error('EXTERNAL_API_KEY not configured');
    }

    const response = await fetch(`${EXTERNAL_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`External API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error(`Error fetching from external API (${endpoint}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
