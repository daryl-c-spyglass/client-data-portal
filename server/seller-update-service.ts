import type { Property, SellerUpdate } from "@shared/schema";
import { storage } from "./storage";

export interface PropertyMatchResult {
  properties: Property[];
  newListingsCount: number;
  totalMatches: number;
}

/**
 * Normalize string for comparison (trim, lowercase)
 */
function normalizeString(str: string | null | undefined): string {
  return (str || '').trim().toLowerCase();
}

/**
 * Find properties matching seller update criteria
 * @param sellerUpdate The seller update with search criteria
 * @param sinceDate Optional date to filter for new listings (defaults to lastSentAt)
 * @param limit Optional limit for number of results (default: 100)
 * @returns Matching properties and counts
 */
export async function findMatchingProperties(
  sellerUpdate: SellerUpdate,
  sinceDate?: Date,
  limit: number = 100
): Promise<PropertyMatchResult> {
  // Get all properties
  const allProperties = await storage.getAllProperties();
  
  // Normalize search criteria
  const normalizedPostalCode = normalizeString(sellerUpdate.postalCode);
  const normalizedElementarySchool = normalizeString(sellerUpdate.elementarySchool);
  const normalizedPropertySubType = normalizeString(sellerUpdate.propertySubType);
  
  // Filter properties based on seller update criteria
  const matchingProperties = allProperties.filter(property => {
    // Filter by postal code (required)
    if (normalizedPostalCode && normalizeString(property.postalCode) !== normalizedPostalCode) {
      return false;
    }
    
    // Filter by elementary school (if specified)
    if (normalizedElementarySchool && normalizeString(property.elementarySchool) !== normalizedElementarySchool) {
      return false;
    }
    
    // Filter by property subtype (if specified)
    if (normalizedPropertySubType && normalizeString(property.propertySubType) !== normalizedPropertySubType) {
      return false;
    }
    
    // Only show visible properties
    if (!property.mlgCanView) {
      return false;
    }
    
    return true;
  });
  
  // Filter for new listings since last send (if applicable)
  const filterDate = sinceDate || sellerUpdate.lastSentAt;
  let newListings: Property[] = [];
  
  if (filterDate) {
    // Ensure filterDate is a Date object
    const cutoffDate = filterDate instanceof Date ? filterDate : new Date(filterDate);
    
    newListings = matchingProperties.filter(property => {
      // Safely handle timestamp comparison
      if (!property.modificationTimestamp) {
        return false;
      }
      const modDate = property.modificationTimestamp instanceof Date 
        ? property.modificationTimestamp 
        : new Date(property.modificationTimestamp);
      
      return modDate > cutoffDate;
    });
  }
  
  // Limit results for performance
  const limitedProperties = matchingProperties.slice(0, limit);
  
  return {
    properties: limitedProperties,
    newListingsCount: newListings.length,
    totalMatches: matchingProperties.length,
  };
}

/**
 * Get market summary statistics for matching properties
 */
export function calculateMarketSummary(properties: Property[]) {
  if (properties.length === 0) {
    return null;
  }
  
  const prices = properties
    .map(p => p.listPrice)
    .filter((price): price is string => price !== null && price !== undefined)
    .map(price => parseFloat(price));
  
  const activePrices = properties
    .filter(p => p.standardStatus === 'Active')
    .map(p => p.listPrice)
    .filter((price): price is string => price !== null && price !== undefined)
    .map(price => parseFloat(price));
  
  const soldPrices = properties
    .filter(p => p.standardStatus === 'Closed')
    .map(p => p.closePrice)
    .filter((price): price is string => price !== null && price !== undefined)
    .map(price => parseFloat(price));
  
  const avgListPrice = prices.length > 0 
    ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
    : 0;
  
  const avgActivePrice = activePrices.length > 0
    ? activePrices.reduce((sum, price) => sum + price, 0) / activePrices.length
    : 0;
  
  const avgSoldPrice = soldPrices.length > 0
    ? soldPrices.reduce((sum, price) => sum + price, 0) / soldPrices.length
    : 0;
  
  const avgDaysOnMarket = properties
    .filter(p => p.daysOnMarket !== null && p.daysOnMarket !== undefined)
    .reduce((sum, p, _, arr) => sum + (p.daysOnMarket! / arr.length), 0);
  
  // Calculate average price per square foot
  const propertiesWithArea = properties.filter(p => 
    p.livingArea !== null && 
    p.livingArea !== undefined && 
    parseFloat(p.livingArea) > 0 &&
    p.listPrice !== null &&
    p.listPrice !== undefined
  );
  
  const avgPricePerSqft = propertiesWithArea.length > 0
    ? propertiesWithArea.reduce((sum, p) => {
        const price = parseFloat(p.listPrice!);
        const area = parseFloat(p.livingArea!);
        return sum + (price / area);
      }, 0) / propertiesWithArea.length
    : 0;
  
  return {
    totalListings: properties.length,
    activeListings: properties.filter(p => p.standardStatus === 'Active').length,
    pendingListings: properties.filter(p => p.standardStatus === 'Pending' || p.standardStatus === 'Under Contract').length,
    soldListings: properties.filter(p => p.standardStatus === 'Closed').length,
    avgListPrice: Math.round(avgListPrice),
    avgActivePrice: Math.round(avgActivePrice),
    avgSoldPrice: Math.round(avgSoldPrice),
    avgDaysOnMarket: Math.round(avgDaysOnMarket),
    lowestPrice: prices.length > 0 ? Math.min(...prices) : 0,
    highestPrice: prices.length > 0 ? Math.max(...prices) : 0,
    avgPricePerSqft: Math.round(avgPricePerSqft),
  };
}
