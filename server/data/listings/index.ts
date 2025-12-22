/**
 * Unified Listings Data Layer
 * 
 * This module provides a single entry point for all listing data operations.
 * It aggregates data from MLS Grid, Repliers API, and Database with deduplication.
 * 
 * Usage:
 *   import { CanonicalListingService } from './data/listings';
 *   const result = await CanonicalListingService.fetchListings({ city: 'Austin' });
 */

export { CanonicalListingService } from './canonical-listing-service';
export { mapRepliersToCanonical, mapRepliersListingsToCanonical, getRepliersRawField } from './repliers-mapper';

// Re-export types from shared
export type { 
  CanonicalListing, 
  CanonicalAddress, 
  SourceIds, 
  ListingSource 
} from '../../../shared/canonical-listing';

export { 
  createAddressKey, 
  createAddressKeyFromString, 
  generateCanonicalId,
  calculateDuplicateScore,
  mergeListings,
  determinePrimarySource,
  getSourcePriority,
  CanonicalListingSchema,
  CanonicalAddressSchema,
  SourceIdsSchema,
} from '../../../shared/canonical-listing';
