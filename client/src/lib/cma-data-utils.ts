/**
 * CMA DATA UTILITIES
 * Shared utility functions for Map and Stats views
 */

import { STATUS_COLORS, getStatusFromMLS, type StatusKey } from './statusColors';

export type NormalizedStatus = 'ACTIVE' | 'UNDER_CONTRACT' | 'PENDING' | 'SOLD' | 'LEASING' | 'UNKNOWN';

export const CMA_STATUS_COLORS: Record<NormalizedStatus, string> = {
  ACTIVE: STATUS_COLORS.active.hex,
  UNDER_CONTRACT: STATUS_COLORS.underContract.hex,
  PENDING: STATUS_COLORS.pending.hex,
  SOLD: STATUS_COLORS.closed.hex,
  LEASING: '#a855f7',
  UNKNOWN: '#9ca3af',
};

export const SUBJECT_COLOR = STATUS_COLORS.subject.hex;

export const STATUS_LABELS: Record<NormalizedStatus, string> = {
  ACTIVE: 'Active',
  UNDER_CONTRACT: 'Under Contract',
  PENDING: 'Pending',
  SOLD: 'Closed',
  LEASING: 'Leasing',
  UNKNOWN: 'Unknown',
};

export function extractPrice(comp: any): number | null {
  const fields = ['soldPrice', 'closePrice', 'price', 'listPrice'];
  for (const field of fields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' 
        ? parseFloat(value.replace(/[,$]/g, '')) 
        : Number(value);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

export function extractSqft(comp: any): number | null {
  const fields = ['sqft', 'livingArea', 'squareFeet', 'sqFt', 'size'];
  for (const field of fields) {
    const value = comp?.[field];
    if (value != null) {
      const cleaned = typeof value === 'string' 
        ? value.replace(/^["']|["']$/g, '').replace(/,/g, '') 
        : value;
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

export function getCoordinates(comp: any): { lat: number; lng: number } | null {
  if (comp?.map?.latitude && comp?.map?.longitude) {
    return { lat: Number(comp.map.latitude), lng: Number(comp.map.longitude) };
  }
  if (comp?.coordinates?.latitude && comp?.coordinates?.longitude) {
    return { lat: Number(comp.coordinates.latitude), lng: Number(comp.coordinates.longitude) };
  }
  if (comp?.latitude && comp?.longitude) {
    return { lat: Number(comp.latitude), lng: Number(comp.longitude) };
  }
  if (comp?.address?.latitude && comp?.address?.longitude) {
    return { lat: Number(comp.address.latitude), lng: Number(comp.address.longitude) };
  }
  if (comp?.geo?.lat && comp?.geo?.lng) {
    return { lat: Number(comp.geo.lat), lng: Number(comp.geo.lng) };
  }
  return null;
}

export function normalizeStatus(status: string | undefined | null): NormalizedStatus {
  const statusLower = (status || '').toLowerCase().trim();
  if (!statusLower) return 'UNKNOWN';
  
  if (statusLower === 'lsd' || statusLower.includes('leasing') || statusLower.includes('for rent')) {
    return 'LEASING';
  }
  if (statusLower === 'sld' || statusLower === 'sold' || statusLower.includes('closed')) {
    return 'SOLD';
  }
  if (statusLower === 'sc' || statusLower.includes('pending')) {
    return 'PENDING';
  }
  if (statusLower.includes('under contract') || statusLower.includes('active under')) {
    return 'UNDER_CONTRACT';
  }
  if (statusLower === 'a' || statusLower.includes('active')) {
    return 'ACTIVE';
  }
  return 'UNKNOWN';
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPriceShort(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export function formatYAxisPrice(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  return `$${(value / 1000).toFixed(0)}K`;
}

export interface PropertyStatistics {
  price: {
    average: number;
    median: number;
    range: { min: number; max: number };
  };
  pricePerSqFt: {
    average: number;
    median: number;
    range: { min: number; max: number };
  };
  livingArea: {
    average: number;
    median: number;
    range: { min: number; max: number };
  };
  daysOnMarket: {
    average: number;
    median: number;
    range: { min: number; max: number };
  };
  bedrooms: { average: number };
  bathrooms: { average: number };
}

export function calculateStatistics(properties: any[]): PropertyStatistics {
  const prices = properties.map(p => extractPrice(p)).filter((p): p is number => p !== null);
  const sqfts = properties.map(p => extractSqft(p)).filter((s): s is number => s !== null);
  const pricesPerSqft = properties
    .map(p => {
      const price = extractPrice(p);
      const sqft = extractSqft(p);
      return price && sqft ? price / sqft : null;
    })
    .filter((p): p is number => p !== null);
  const doms = properties.map(p => p.daysOnMarket).filter((d): d is number => d != null && !isNaN(d));
  const beds = properties.map(p => p.bedrooms || p.beds).filter((b): b is number => b != null);
  const baths = properties.map(p => p.bathrooms || p.baths).filter((b): b is number => b != null);

  const calcStats = (arr: number[]) => {
    if (arr.length === 0) return { average: 0, median: 0, range: { min: 0, max: 0 } };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = arr.reduce((a, b) => a + b, 0);
    const mid = Math.floor(sorted.length / 2);
    return {
      average: sum / arr.length,
      median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
      range: { min: sorted[0], max: sorted[sorted.length - 1] },
    };
  };

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    price: calcStats(prices),
    pricePerSqFt: calcStats(pricesPerSqft),
    livingArea: calcStats(sqfts),
    daysOnMarket: calcStats(doms),
    bedrooms: { average: avg(beds) },
    bathrooms: { average: avg(baths) },
  };
}

export function getPropertyAddress(property: any): string {
  if (property?.streetNumber && property?.streetName) {
    return `${property.streetNumber} ${property.streetName}`;
  }
  if (typeof property?.address === 'string') {
    return property.address.split(',')[0];
  }
  if (property?.address?.streetNumber && property?.address?.streetName) {
    return `${property.address.streetNumber} ${property.address.streetName}`;
  }
  return 'Unknown Address';
}

export function getPropertyPhotos(property: any): string[] {
  if (Array.isArray(property?.photos)) return property.photos;
  if (Array.isArray(property?.media)) return property.media.map((m: any) => m.url || m);
  return [];
}
