import type { Property } from "@shared/schema";

export interface CMASmartDefaults {
  minPrice?: number;
  maxPrice?: number;
  minSqft?: number;
  maxSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minLotAcres?: number;
  maxLotAcres?: number;
}

export const RADIUS_OPTIONS = [
  { value: 0.5, label: '0.5 mi' },
  { value: 1, label: '1 mi' },
  { value: 2, label: '2 mi' },
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
];

export const SOLD_WITHIN_OPTIONS = [
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '12 months' },
  { value: 730, label: '24 months' },
];

export function calculateSmartDefaults(subjectProperty: Property | null): CMASmartDefaults {
  const defaults: CMASmartDefaults = {};

  if (!subjectProperty) {
    return defaults;
  }

  const price = (subjectProperty as any).listPrice || (subjectProperty as any).price || (subjectProperty as any).closePrice;
  if (price && price > 0) {
    defaults.minPrice = Math.round(price * 0.80);
    defaults.maxPrice = Math.round(price * 1.20);
  }

  const sqft = (subjectProperty as any).livingArea || (subjectProperty as any).sqft;
  if (sqft && sqft > 0) {
    defaults.minSqft = Math.round(sqft * 0.75);
    defaults.maxSqft = Math.round(sqft * 1.25);
  }

  const yearBuilt = (subjectProperty as any).yearBuilt;
  if (yearBuilt && yearBuilt > 1900) {
    defaults.minYearBuilt = yearBuilt - 10;
    defaults.maxYearBuilt = new Date().getFullYear();
  }

  const beds = (subjectProperty as any).bedroomsTotal || (subjectProperty as any).bedrooms;
  if (beds && beds > 0) {
    defaults.minBeds = Math.max(1, beds - 1);
    defaults.maxBeds = beds + 1;
  }

  const baths = (subjectProperty as any).bathroomsTotalInteger || (subjectProperty as any).bathrooms;
  if (baths && baths > 0) {
    defaults.minBaths = Math.max(1, Math.floor(baths - 1));
    defaults.maxBaths = Math.ceil(baths + 1);
  }

  const lotAcres = (subjectProperty as any).lotSizeAcres || (subjectProperty as any).lotSize;
  if (lotAcres && lotAcres > 0) {
    defaults.minLotAcres = Math.round(lotAcres * 0.50 * 100) / 100;
    defaults.maxLotAcres = Math.round(lotAcres * 1.50 * 100) / 100;
  }

  return defaults;
}

export function hasCustomFilters(
  currentFilters: Partial<CMASmartDefaults>,
  subjectProperty: Property | null
): boolean {
  if (!subjectProperty) return false;
  
  const smartDefaults = calculateSmartDefaults(subjectProperty);
  
  const keysToCompare: (keyof CMASmartDefaults)[] = [
    'minPrice', 'maxPrice', 
    'minSqft', 'maxSqft',
    'minYearBuilt', 'maxYearBuilt',
    'minBeds', 'maxBeds',
  ];
  
  for (const key of keysToCompare) {
    const currentVal = currentFilters[key];
    const defaultVal = smartDefaults[key];
    if (currentVal !== undefined && defaultVal !== undefined && currentVal !== defaultVal) {
      return true;
    }
  }
  
  return false;
}

export function formatFilterValue(
  value: number | undefined, 
  type: 'price' | 'sqft' | 'year' | 'beds' | 'acres'
): string {
  if (value === undefined || value === null) return '';
  
  switch (type) {
    case 'price':
      return `$${value.toLocaleString()}`;
    case 'sqft':
      return `${value.toLocaleString()} sqft`;
    case 'year':
      return String(value);
    case 'beds':
      return `${value} bed${value !== 1 ? 's' : ''}`;
    case 'acres':
      return `${value} acres`;
    default:
      return String(value);
  }
}
