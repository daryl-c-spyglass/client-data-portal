export type PriceFormat = 'commas' | 'abbreviated' | 'suffix';
export type AreaUnit = 'sqft' | 'sqm' | 'acres';
export type DateFormatType = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

export interface DisplayPreferences {
  priceFormat: PriceFormat;
  areaUnit: AreaUnit;
  dateFormat: DateFormatType;
  includeAgentBranding: boolean;
  includeMarketStats: boolean;
}

export const DEFAULT_PREFERENCES: DisplayPreferences = {
  priceFormat: 'commas',
  areaUnit: 'sqft',
  dateFormat: 'MM/DD/YYYY',
  includeAgentBranding: true,
  includeMarketStats: true,
};

export function formatPrice(value: number | string | null | undefined, format: PriceFormat = 'commas'): string {
  if (value === null || value === undefined) return 'N/A';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  
  switch (format) {
    case 'abbreviated':
      if (numValue >= 1000000) {
        return `$${(numValue / 1000000).toFixed(2)}M`;
      } else if (numValue >= 1000) {
        return `$${(numValue / 1000).toFixed(0)}K`;
      }
      return `$${numValue.toLocaleString()}`;
    
    case 'suffix':
      return `${numValue.toLocaleString()} USD`;
    
    case 'commas':
    default:
      return `$${numValue.toLocaleString()}`;
  }
}

export function formatArea(value: number | string | null | undefined, unit: AreaUnit = 'sqft'): string {
  if (value === null || value === undefined) return 'N/A';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  
  switch (unit) {
    case 'sqm':
      const sqm = numValue * 0.092903;
      return `${sqm.toLocaleString(undefined, { maximumFractionDigits: 0 })} sq m`;
    
    case 'acres':
      const acres = numValue / 43560;
      return `${acres.toFixed(2)} acres`;
    
    case 'sqft':
    default:
      return `${numValue.toLocaleString()} sq ft`;
  }
}

export function formatDate(date: Date | string | null | undefined, format: DateFormatType = 'MM/DD/YYYY'): string {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'N/A';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    
    case 'MM/DD/YYYY':
    default:
      return `${month}/${day}/${year}`;
  }
}

export const PRICE_FORMAT_OPTIONS = [
  { value: 'commas', label: '$1,234,567', description: 'Standard with commas' },
  { value: 'abbreviated', label: '$1.23M', description: 'Abbreviated' },
  { value: 'suffix', label: '1,234,567 USD', description: 'With currency suffix' },
] as const;

export const AREA_UNIT_OPTIONS = [
  { value: 'sqft', label: 'sq ft', description: 'Square feet' },
  { value: 'sqm', label: 'sq m', description: 'Square meters' },
  { value: 'acres', label: 'acres', description: 'Acres' },
] as const;

export const DATE_FORMAT_OPTIONS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', description: 'US format' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', description: 'International format' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', description: 'ISO format' },
] as const;
