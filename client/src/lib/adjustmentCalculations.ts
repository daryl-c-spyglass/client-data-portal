import type { CmaAdjustmentRates, CmaCompAdjustmentOverrides } from "@shared/schema";

export const DEFAULT_ADJUSTMENT_RATES: CmaAdjustmentRates = {
  sqftPerUnit: 50,
  bedroomValue: 10000,
  bathroomValue: 7500,
  poolValue: 25000,
  garagePerSpace: 5000,
  yearBuiltPerYear: 1000,
  lotSizePerSqft: 2,
};

export interface AdjustmentLine {
  feature: string;
  subjectValue: string | number | null;
  compValue: string | number | null;
  adjustment: number;
}

export interface CompAdjustmentResult {
  compId: string;
  compAddress: string;
  salePrice: number;
  adjustments: AdjustmentLine[];
  totalAdjustment: number;
  adjustedPrice: number;
}

export interface PropertyForAdjustment {
  listingId?: string;
  mlsNumber?: string;
  id?: string;
  address?: string;
  streetAddress?: string;
  city?: string;
  livingArea?: number | string | null;
  squareFeet?: number | string | null;
  bedroomsTotal?: number | string | null;
  bathroomsTotal?: number | string | null;
  poolFeatures?: string | string[] | null;
  garageSpaces?: number | string | null;
  yearBuilt?: number | string | null;
  lotSizeSquareFeet?: number | string | null;
  lotSizeArea?: number | string | null;
  listPrice?: number | string | null;
  soldPrice?: number | string | null;
  closePrice?: number | string | null;
}

function getNumericValue(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

function getSqft(property: PropertyForAdjustment): number {
  return getNumericValue(property.livingArea) || getNumericValue(property.squareFeet);
}

function getBeds(property: PropertyForAdjustment): number {
  return getNumericValue(property.bedroomsTotal);
}

function getBaths(property: PropertyForAdjustment): number {
  return getNumericValue(property.bathroomsTotal);
}

function hasPool(property: PropertyForAdjustment): boolean {
  const poolFeatures = property.poolFeatures;
  if (!poolFeatures) return false;
  if (Array.isArray(poolFeatures)) {
    return poolFeatures.length > 0 && !poolFeatures.every(f => 
      f.toLowerCase() === 'none' || f.toLowerCase() === 'no'
    );
  }
  if (typeof poolFeatures === 'string') {
    const lower = poolFeatures.toLowerCase();
    return lower !== 'none' && lower !== 'no' && lower !== '' && lower !== 'null';
  }
  return false;
}

function getGarageSpaces(property: PropertyForAdjustment): number {
  return getNumericValue(property.garageSpaces);
}

function getYearBuilt(property: PropertyForAdjustment): number {
  return getNumericValue(property.yearBuilt);
}

function getLotSize(property: PropertyForAdjustment): number {
  return getNumericValue(property.lotSizeSquareFeet) || getNumericValue(property.lotSizeArea);
}

function getSalePrice(property: PropertyForAdjustment): number {
  return getNumericValue(property.closePrice) || 
         getNumericValue(property.soldPrice) || 
         getNumericValue(property.listPrice);
}

function getPropertyId(property: PropertyForAdjustment): string {
  return property.listingId || property.mlsNumber || property.id || 'unknown';
}

function getPropertyAddress(property: PropertyForAdjustment): string {
  if (property.address) return property.address;
  if (property.streetAddress && property.city) {
    return `${property.streetAddress}, ${property.city}`;
  }
  return property.streetAddress || 'Unknown Address';
}

export function calculateAdjustments(
  subject: PropertyForAdjustment,
  comp: PropertyForAdjustment,
  rates: CmaAdjustmentRates,
  overrides?: Partial<CmaCompAdjustmentOverrides> | null
): CompAdjustmentResult {
  const adjustments: AdjustmentLine[] = [];
  
  const subjectSqft = getSqft(subject);
  const compSqft = getSqft(comp);
  const sqftDiff = subjectSqft - compSqft;
  const sqftAdj = overrides?.sqft ?? (sqftDiff * rates.sqftPerUnit);
  if (sqftAdj !== 0) {
    adjustments.push({
      feature: 'Square Feet',
      subjectValue: subjectSqft || null,
      compValue: compSqft || null,
      adjustment: sqftAdj,
    });
  }
  
  const subjectBeds = getBeds(subject);
  const compBeds = getBeds(comp);
  const bedDiff = subjectBeds - compBeds;
  const bedAdj = overrides?.bedrooms ?? (bedDiff * rates.bedroomValue);
  if (bedAdj !== 0) {
    adjustments.push({
      feature: 'Bedrooms',
      subjectValue: subjectBeds || null,
      compValue: compBeds || null,
      adjustment: bedAdj,
    });
  }
  
  const subjectBaths = getBaths(subject);
  const compBaths = getBaths(comp);
  const bathDiff = subjectBaths - compBaths;
  const bathAdj = overrides?.bathrooms ?? (bathDiff * rates.bathroomValue);
  if (bathAdj !== 0) {
    adjustments.push({
      feature: 'Bathrooms',
      subjectValue: subjectBaths || null,
      compValue: compBaths || null,
      adjustment: bathAdj,
    });
  }
  
  const subjectHasPool = hasPool(subject);
  const compHasPool = hasPool(comp);
  if (subjectHasPool !== compHasPool) {
    const poolAdj = overrides?.pool ?? (subjectHasPool ? rates.poolValue : -rates.poolValue);
    adjustments.push({
      feature: 'Pool',
      subjectValue: subjectHasPool ? 'Yes' : 'No',
      compValue: compHasPool ? 'Yes' : 'No',
      adjustment: poolAdj,
    });
  }
  
  const subjectGarage = getGarageSpaces(subject);
  const compGarage = getGarageSpaces(comp);
  const garageDiff = subjectGarage - compGarage;
  const garageAdj = overrides?.garage ?? (garageDiff * rates.garagePerSpace);
  if (garageAdj !== 0) {
    adjustments.push({
      feature: 'Garage Spaces',
      subjectValue: subjectGarage || null,
      compValue: compGarage || null,
      adjustment: garageAdj,
    });
  }
  
  const subjectYear = getYearBuilt(subject);
  const compYear = getYearBuilt(comp);
  const yearDiff = subjectYear - compYear;
  const yearAdj = overrides?.yearBuilt ?? (yearDiff * rates.yearBuiltPerYear);
  if (yearAdj !== 0 && subjectYear > 0 && compYear > 0) {
    adjustments.push({
      feature: 'Year Built',
      subjectValue: subjectYear || null,
      compValue: compYear || null,
      adjustment: yearAdj,
    });
  }
  
  const subjectLot = getLotSize(subject);
  const compLot = getLotSize(comp);
  const lotDiff = subjectLot - compLot;
  const lotAdj = overrides?.lotSize ?? (lotDiff * rates.lotSizePerSqft);
  if (lotAdj !== 0 && Math.abs(lotDiff) > 500) {
    adjustments.push({
      feature: 'Lot Size',
      subjectValue: subjectLot || null,
      compValue: compLot || null,
      adjustment: Math.round(lotAdj),
    });
  }
  
  if (overrides?.custom) {
    for (const customAdj of overrides.custom) {
      if (customAdj.value !== 0) {
        adjustments.push({
          feature: customAdj.name,
          subjectValue: '—',
          compValue: '—',
          adjustment: customAdj.value,
        });
      }
    }
  }
  
  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.adjustment, 0);
  const salePrice = getSalePrice(comp);
  const adjustedPrice = salePrice + totalAdjustment;
  
  return {
    compId: getPropertyId(comp),
    compAddress: getPropertyAddress(comp),
    salePrice,
    adjustments,
    totalAdjustment,
    adjustedPrice,
  };
}

export function formatAdjustment(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function getSubjectValue(
  subject: PropertyForAdjustment,
  feature: string
): string | number | null {
  switch (feature) {
    case 'Square Feet':
      return getSqft(subject) || null;
    case 'Bedrooms':
      return getBeds(subject) || null;
    case 'Bathrooms':
      return getBaths(subject) || null;
    case 'Pool':
      return hasPool(subject) ? 'Yes' : 'No';
    case 'Garage Spaces':
      return getGarageSpaces(subject) || null;
    case 'Year Built':
      return getYearBuilt(subject) || null;
    case 'Lot Size':
      return getLotSize(subject) || null;
    default:
      return '—';
  }
}

export function getUniqueFeatures(results: CompAdjustmentResult[]): string[] {
  const features = new Set<string>();
  for (const result of results) {
    for (const adj of result.adjustments) {
      features.add(adj.feature);
    }
  }
  const order = ['Square Feet', 'Bedrooms', 'Bathrooms', 'Pool', 'Garage Spaces', 'Year Built', 'Lot Size'];
  return Array.from(features).sort((a, b) => {
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}
