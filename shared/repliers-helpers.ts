/**
 * Repliers Integration Helpers
 * 
 * This module provides shared helper functions for Repliers API integration.
 * All modules (Dashboard, Properties, CMA, Buyer Search, Seller Updates) 
 * should use these helpers for consistent data handling.
 * 
 * REPLIERS API REQUIREMENTS:
 * - class parameter: Only 'residential', 'condo', 'commercial' are valid inputs
 * - MLS scope: ACTRIS (Austin/Central Texas) is the default scope
 * - Rental/leasing exclusion must be applied before all counts
 */

// ============================================================================
// VALID REPLIERS CLASS VALUES
// ============================================================================

/**
 * Valid class values for Repliers API requests.
 * ONLY these values should be sent as the 'class' parameter.
 * Response values may differ (e.g., 'ResidentialProperty').
 */
export const VALID_REPLIERS_CLASSES = ['residential', 'condo', 'commercial'] as const;
export type RepliersClass = typeof VALID_REPLIERS_CLASSES[number];

/**
 * Normalize and validate a class parameter before sending to Repliers.
 * If invalid, returns 'residential' as default and logs a warning.
 */
export function normalizeRepliersClass(classValue: string | undefined | null): RepliersClass {
  if (!classValue) {
    return 'residential';
  }
  
  const normalized = classValue.toLowerCase().trim();
  
  // Map response values to valid request values
  const classMapping: Record<string, RepliersClass> = {
    'residential': 'residential',
    'residentialproperty': 'residential',
    'condo': 'condo',
    'condoproperty': 'condo',
    'commercial': 'commercial',
    'commercialproperty': 'commercial',
  };
  
  const mappedClass = classMapping[normalized];
  
  if (mappedClass) {
    return mappedClass;
  }
  
  // Log error for invalid values in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Repliers] Invalid class value detected: "${classValue}". Auto-normalizing to "residential".`);
  }
  
  return 'residential';
}

// ============================================================================
// STATUS NORMALIZATION
// ============================================================================

/**
 * Valid normalized status values used throughout the application.
 * Matches MLS/ACTRIS status categories exactly:
 * - Active: Properties available for sale
 * - Active Under Contract: Properties with accepted offer, still showing
 * - Pending: Properties with accepted offer, no longer showing
 * - Closed: Sold properties
 */
export type NormalizedStatus = 'Active' | 'Active Under Contract' | 'Pending' | 'Closed';

/**
 * Normalize property status to one of four MLS-standard values.
 * This ensures consistent status handling across all modules.
 * 
 * CRITICAL: Uses lastStatus field when available for accurate AU/Pending distinction.
 * 
 * Mapping:
 * - Active: A, Active
 * - Active Under Contract: AU, Act (when status=U), Active Under Contract
 * - Pending: P, Pnd, Pending (when not AU)
 * - Closed: S, Sld, Lsd, Closed, Sold
 */
export function normalizeStatus(status: string | null | undefined, lastStatus?: string | null): NormalizedStatus {
  if (!status) return 'Active';
  
  const normalized = status.trim();
  const lastNormalized = lastStatus?.trim();
  
  // PRIORITY 1: Check lastStatus for definitive status (Repliers API detail)
  if (lastNormalized) {
    // Closed/Sold statuses
    if (lastNormalized === 'Sld' || lastNormalized === 'Lsd') {
      return 'Closed';
    }
    // Active Under Contract (AU or Act when status is U)
    if (lastNormalized === 'AU' || lastNormalized === 'Act') {
      // If status is U (unavailable) and lastStatus is Act, it's Active Under Contract
      if (normalized === 'U' && lastNormalized === 'Act') {
        return 'Active Under Contract';
      }
      if (lastNormalized === 'AU') {
        return 'Active Under Contract';
      }
    }
    // Pending
    if (lastNormalized === 'Pnd' || lastNormalized === 'P') {
      return 'Pending';
    }
  }
  
  // PRIORITY 2: Map by status field
  const statusMap: Record<string, NormalizedStatus> = {
    // Single-letter codes from Repliers API
    'A': 'Active',
    'U': 'Pending', // Default U to Pending if no lastStatus override
    'P': 'Pending',
    'S': 'Closed',
    
    // Full status strings (standardStatus field)
    'Active': 'Active',
    'Active Under Contract': 'Active Under Contract',
    'Active Under Contract - Showing': 'Active Under Contract',
    'Under Contract': 'Pending', // Generic "Under Contract" maps to Pending
    'Pending': 'Pending',
    'Contingent': 'Pending',
    'Closed': 'Closed',
    'Sold': 'Closed',
    
    // Other statuses (normalize to appropriate bucket)
    'Expired': 'Closed',
    'Withdrawn': 'Closed',
    'Cancelled': 'Closed',
    'Terminated': 'Closed',
    'X': 'Closed',
    'W': 'Closed',
    'C': 'Closed',
    'T': 'Closed',
  };
  
  return statusMap[normalized] || 'Active';
}

/**
 * Legacy 3-status normalization for backward compatibility.
 * Use normalizeStatus() for new code.
 */
export function normalizeStatusLegacy(status: string | null | undefined): 'Active' | 'Under Contract' | 'Closed' {
  const normalized = normalizeStatus(status);
  if (normalized === 'Active Under Contract' || normalized === 'Pending') {
    return 'Under Contract';
  }
  return normalized;
}

/**
 * Check if a status represents a closed/sold property.
 */
export function isClosedStatus(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'Closed';
}

/**
 * Check if a status represents an under contract property (Active Under Contract or Pending).
 */
export function isUnderContractStatus(status: string | null | undefined, lastStatus?: string | null): boolean {
  const normalized = normalizeStatus(status, lastStatus);
  return normalized === 'Active Under Contract' || normalized === 'Pending';
}

// ============================================================================
// PRICE HELPERS
// ============================================================================

/**
 * Get the display price for a property based on its status.
 * - Active/Under Contract: Use listPrice
 * - Closed/Sold: Use closePrice (fallback to listPrice if unavailable)
 */
export function getDisplayPrice(property: {
  listPrice?: number | string | null;
  closePrice?: number | string | null;
  standardStatus?: string | null;
  status?: string | null;
}): number {
  const status = normalizeStatus(property.standardStatus || property.status);
  
  if (status === 'Closed') {
    const closePrice = toNumber(property.closePrice);
    if (closePrice && closePrice > 0) {
      return closePrice;
    }
  }
  
  return toNumber(property.listPrice) || 0;
}

/**
 * Get the close price for a sold property.
 * Returns null if not a closed property or closePrice unavailable.
 */
export function getClosePrice(property: {
  closePrice?: number | string | null;
  soldPrice?: number | string | null;
}): number | null {
  const closePrice = toNumber(property.closePrice) || toNumber((property as any).soldPrice);
  return closePrice && closePrice > 0 ? closePrice : null;
}

/**
 * Get the list price for a property.
 */
export function getListPrice(property: {
  listPrice?: number | string | null;
}): number {
  return toNumber(property.listPrice) || 0;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Get the listing date (when property was first listed).
 * Checks multiple field names for compatibility.
 */
export function getListDate(property: {
  listDate?: string | Date | null;
  listingContractDate?: string | Date | null;
}): Date | null {
  const dateValue = property.listDate || property.listingContractDate;
  if (!dateValue) return null;
  
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get the close/sold date for a property.
 */
export function getCloseDate(property: {
  closeDate?: string | Date | null;
  soldDate?: string | Date | null;
}): Date | null {
  const dateValue = property.closeDate || (property as any).soldDate;
  if (!dateValue) return null;
  
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get the under contract date for a property.
 */
export function getUnderContractDate(property: {
  underContractDate?: string | Date | null;
  pendingDate?: string | Date | null;
  statusChangeDate?: string | Date | null;
}): Date | null {
  const dateValue = property.underContractDate || 
                    (property as any).pendingDate || 
                    (property as any).statusChangeDate;
  if (!dateValue) return null;
  
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

// ============================================================================
// DAYS ON MARKET (DOM) CALCULATIONS
// ============================================================================

export interface DOMResult {
  daysOnMarket: number | null;      // Total DOM (listDate → closeDate for sold, or from API)
  daysActive: number | null;        // Days from listing to now (for active/UC)
  daysUnderContract: number | null; // Days from UC date to now (for UC)
  cumulativeDaysOnMarket: number | null;
}

/**
 * Calculate Days on Market based on property status.
 * 
 * Rules:
 * - Sold/Closed: DOM = Close Date - List Date
 * - Active: Days Active = Today - List Date
 * - Under Contract: Days Active = Today - List Date; Days UC = Today - UC Date
 * 
 * @param property Property with date and status fields
 * @param now Current date (defaults to now)
 */
export function computeDOM(property: {
  standardStatus?: string | null;
  status?: string | null;
  listDate?: string | Date | null;
  listingContractDate?: string | Date | null;
  closeDate?: string | Date | null;
  soldDate?: string | Date | null;
  underContractDate?: string | Date | null;
  pendingDate?: string | Date | null;
  statusChangeDate?: string | Date | null;
  daysOnMarket?: number | null;
  cumulativeDaysOnMarket?: number | null;
}, now: Date = new Date()): DOMResult {
  const status = normalizeStatus(property.standardStatus || property.status);
  const listDate = getListDate(property);
  const closeDate = getCloseDate(property);
  const ucDate = getUnderContractDate(property);
  
  let daysOnMarket: number | null = null;
  let daysActive: number | null = null;
  let daysUnderContract: number | null = null;
  
  if (status === 'Closed') {
    // Sold/Closed: DOM = Close Date - List Date
    if (closeDate && listDate) {
      daysOnMarket = Math.floor((closeDate.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
    } else if (property.daysOnMarket != null) {
      daysOnMarket = Number(property.daysOnMarket);
    } else if (property.cumulativeDaysOnMarket != null) {
      daysOnMarket = Number(property.cumulativeDaysOnMarket);
    }
  } else if (status === 'Active') {
    // Active: Days Active = Today - List Date
    if (listDate) {
      daysActive = Math.floor((now.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (property.daysOnMarket != null) {
      daysOnMarket = Number(property.daysOnMarket);
    }
  } else if (status === 'Active Under Contract' || status === 'Pending') {
    // Under Contract (AU or Pending): Track both active days and UC days
    if (ucDate) {
      daysUnderContract = Math.floor((now.getTime() - ucDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (listDate) {
      daysActive = Math.floor((now.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (property.daysOnMarket != null) {
      daysOnMarket = Number(property.daysOnMarket);
    }
  }
  
  return {
    daysOnMarket,
    daysActive,
    daysUnderContract,
    cumulativeDaysOnMarket: property.cumulativeDaysOnMarket != null 
      ? Number(property.cumulativeDaysOnMarket) 
      : daysOnMarket,
  };
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Safely convert a value to a number.
 */
export function toNumber(value: any): number | null {
  if (value == null) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Format a price for display (e.g., $500,000).
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null || price <= 0) return 'N/A';
  return `$${price.toLocaleString()}`;
}

/**
 * Calculate price per square foot.
 */
export function calculatePricePerSqft(price: number, sqft: number): number | null {
  if (!price || !sqft || sqft <= 0) return null;
  return Math.round(price / sqft);
}

// ============================================================================
// MLS SCOPE (ACTRIS)
// ============================================================================

/**
 * Default MLS scope for Austin/Central Texas.
 * All Repliers searches are scoped to ACTRIS unless otherwise specified.
 */
export const DEFAULT_MLS_SCOPE = 'ACTRIS';

/**
 * Get MLS scope configuration for Repliers requests.
 * Currently hardcoded to ACTRIS as that's the only supported MLS.
 */
export function getMLSScope(): string {
  return process.env.MLS_SCOPE || DEFAULT_MLS_SCOPE;
}

// ============================================================================
// FIELD MAPPING DOCUMENTATION
// ============================================================================

/**
 * REPLIERS FIELD MAPPING (Source of Truth)
 * 
 * PRICES:
 * - List Price: listing.listPrice (Active/Under Contract)
 * - Close Price: listing.soldPrice || listing.closePrice (Closed/Sold)
 * 
 * DATES:
 * - List Date: listing.listDate || listing.listingContractDate
 * - Close Date: listing.soldDate || listing.closeDate
 * - Status Change Date: listing.underContractDate || listing.pendingDate || listing.statusChangeDate
 * 
 * DOM CALCULATIONS:
 * - Sold/Closed: closeDate - listDate (or use daysOnMarket/cumulativeDaysOnMarket from API)
 * - Active: today - listDate
 * - Under Contract: today - listDate for total; today - ucDate for UC-specific
 * 
 * STATUS NORMALIZATION:
 * - 'A' / 'Active' → 'Active'
 * - 'U' / 'P' / 'Under Contract' / 'Pending' / 'Active Under Contract' → 'Under Contract'
 * - 'S' / 'Sold' / 'Closed' → 'Closed'
 * 
 * CLASS PARAMETER (API Requests):
 * - Valid inputs: 'residential', 'condo', 'commercial'
 * - Response values may be: 'ResidentialProperty', 'CondoProperty', 'CommercialProperty'
 * - Always normalize before sending requests
 */
