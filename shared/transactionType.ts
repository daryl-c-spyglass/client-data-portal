/**
 * Transaction Type Helper - Central logic for Sale vs Lease classification
 * 
 * This module provides consistent Sale/Lease detection across the entire app:
 * - Buyer Search
 * - CMA Builder  
 * - Property Details
 * - Dashboard counts
 * 
 * Canonical Field: Repliers API uses 'type' parameter ('sale' or 'lease')
 * This maps to the transaction type, not property type.
 */

export type TransactionType = 'sale' | 'lease' | 'all';

/**
 * Default transaction type for searches
 * Set to 'sale' to exclude rentals/leases by default
 */
export const DEFAULT_TRANSACTION_TYPE: TransactionType = 'sale';

/**
 * Check if a listing is a lease/rental based on available data
 * This function checks multiple fields since the exact field varies by MLS
 * 
 * @param listing - Raw listing data from API
 * @returns true if the listing is a lease/rental
 */
export function isLeaseListing(listing: Record<string, any>): boolean {
  // Primary check: Repliers 'type' field
  if (listing.type?.toLowerCase() === 'lease') return true;
  
  // Secondary: transactionType field (RESO)
  if (listing.transactionType?.toLowerCase() === 'lease') return true;
  if (listing.transactionType?.toLowerCase() === 'rental') return true;
  
  // Tertiary: Check propertySubType for lease indicators
  const subType = (listing.propertySubType || '').toLowerCase();
  if (subType.includes('lease') || subType.includes('rental')) return true;
  
  // Check listing class (some MLSs use this)
  const listingClass = (listing.class || listing.propertyClass || '').toLowerCase();
  if (listingClass === 'rental' || listingClass === 'lease') return true;
  
  return false;
}

/**
 * Check if a listing is a sale based on available data
 * 
 * @param listing - Raw listing data from API
 * @returns true if the listing is a sale
 */
export function isSaleListing(listing: Record<string, any>): boolean {
  // Primary check: Repliers 'type' field
  if (listing.type?.toLowerCase() === 'sale') return true;
  
  // If type is not explicitly set, assume it's a sale unless it's explicitly a lease
  if (!listing.type && !isLeaseListing(listing)) return true;
  
  return false;
}

/**
 * Get the transaction type of a listing
 * 
 * @param listing - Raw listing data from API
 * @returns 'sale', 'lease', or 'all' if unknown
 */
export function getTransactionType(listing: Record<string, any>): TransactionType {
  if (isLeaseListing(listing)) return 'lease';
  if (isSaleListing(listing)) return 'sale';
  return 'all';
}

/**
 * Get the display label for a transaction type
 */
export function getTransactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'sale': return 'For Sale';
    case 'lease': return 'For Lease';
    case 'all': return 'All Listings';
    default: return 'Unknown';
  }
}
