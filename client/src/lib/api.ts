import { apiRequest } from "./queryClient";
import type { SearchCriteria, Property } from "@shared/schema";

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
