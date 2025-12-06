import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  Map as MapIcon,
  Save,
  Filter,
  AlertCircle,
} from "lucide-react";
import { PropertyCard } from "@/components/PropertyCard";
import type { Property, Media } from "@shared/schema";

interface SearchFilters {
  // Status & Dates (independent toggles)
  statusActive?: boolean;
  statusUnderContract?: boolean;
  statusClosed?: boolean;
  dateRangeFrom?: string;
  dateRangeTo?: string;
  
  // Property Details
  propertySubType?: string;
  contingency?: string;
  priceDrop?: string;
  priceDropDateFrom?: string;
  priceDropDateTo?: string;
  
  // Price
  minPrice?: number;
  maxPrice?: number;
  
  // MLS
  mlsNumber?: string;
  mlsAreas?: string;
  mlsAreasMode?: string;
  
  // Location
  postalCode?: string;
  postalCodeMode?: string;
  city?: string;
  cityMode?: string;
  subdivision?: string;
  subdivisionMode?: string;
  
  // Address
  streetNumber?: string;
  streetNumberMin?: number;
  streetNumberMax?: number;
  streetName?: string;
  streetNameMode?: string;
  unitNumber?: string;
  unitNumberMode?: string;
  streetList?: string;
  
  // Schools
  elementarySchool?: string;
  elementarySchoolMode?: string;
  middleSchool?: string;
  middleSchoolMode?: string;
  highSchool?: string;
  highSchoolMode?: string;
  schoolDistrict?: string;
  schoolDistrictMode?: string;
  
  // Size & Structure
  minLivingArea?: number;
  maxLivingArea?: number;
  minLotSizeSqFt?: number;
  maxLotSizeSqFt?: number;
  minLotSizeAcres?: number;
  maxLotSizeAcres?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  
  // Rooms
  minBeds?: number;
  maxBeds?: number;
  minMainLevelBeds?: number;
  maxMainLevelBeds?: number;
  minFullBaths?: number;
  maxFullBaths?: number;
  minHalfBaths?: number;
  maxHalfBaths?: number;
  minTotalBaths?: number;
  maxTotalBaths?: number;
  minGarageSpaces?: number;
  maxGarageSpaces?: number;
  minTotalParkingSpaces?: number;
  maxTotalParkingSpaces?: number;
  
  // Location Extended
  county?: string;
  countyMode?: string;
  
  // Property Condition & HOA
  propertyCondition?: string;
  propertyConditionMode?: string;
  hoa?: string;
  hoaMode?: string;
  
  // Levels
  levels?: string;
  levelsMode?: string;
  primaryBedOnMain?: string;
  
  // Pool & Waterfront
  privatePool?: string;
  privatePoolMode?: string;
  poolFeatures?: string;
  poolFeaturesMode?: string;
  waterfront?: string;
  waterfrontMode?: string;
  waterfrontFeatures?: string;
  waterfrontFeaturesMode?: string;
  view?: string;
  viewMode?: string;
  viewFeatures?: string;
  viewFeaturesMode?: string;
  
  // Horse
  horse?: string;
  horseMode?: string;
  horseAmenities?: string;
  horseAmenitiesMode?: string;
  
  // Features Extended
  interiorFeatures?: string;
  interiorFeaturesMode?: string;
  flooring?: string;
  flooringMode?: string;
  fireplaceFeatures?: string;
  fireplaceMode?: string;
  windowFeatures?: string;
  windowFeaturesMode?: string;
  accessibilityFeatures?: string;
  accessibilityFeaturesMode?: string;
  securityFeatures?: string;
  securityFeaturesMode?: string;
  
  // Exterior
  exteriorFeatures?: string;
  exteriorFeaturesMode?: string;
  foundation?: string;
  foundationMode?: string;
  lotFeatures?: string;
  lotFeaturesMode?: string;
  fencing?: string;
  fencingMode?: string;
  patioAndPorchFeatures?: string;
  patioAndPorchFeaturesMode?: string;
  spaFeatures?: string;
  spaFeaturesMode?: string;
  
  // Community
  communityFeatures?: string;
  communityFeaturesMode?: string;
  parkingFeatures?: string;
  parkingFeaturesMode?: string;
  
  // Utilities Extended
  heating?: string;
  heatingMode?: string;
  cooling?: string;
  coolingMode?: string;
  waterSource?: string;
  waterSourceMode?: string;
  sewer?: string;
  sewerMode?: string;
  utilities?: string;
  utilitiesMode?: string;
  
  // Green Building
  greenEnergyEfficient?: string;
  greenEnergyEfficientMode?: string;
  greenSustainability?: string;
  greenSustainabilityMode?: string;
  greenBuildingVerificationType?: string;
  greenVerificationStatus?: string;
  greenVerificationStatusMode?: string;
  greenVerificationRating?: string;
  greenVerificationYear?: number;
  
  // Listing Conditions
  flexListing?: string;
  specialListingConditions?: string;
  specialListingConditionsMode?: string;
  showingRequirements?: string;
  showingRequirementsMode?: string;
  occupantType?: string;
  possession?: string;
  possessionMode?: string;
  acceptableFinancing?: string;
  acceptableFinancingMode?: string;
  
  // Search
  publicRemarks?: string;
  
  // Date
  minListDate?: string;
  maxListDate?: string;
}

interface HomeReviewResponse {
  properties: Property[];
  total: number;
  hasMore: boolean;
  source: string;
}

export default function BuyerSearch() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<SearchFilters>({ statusActive: true });
  const [activeFiltersCount, setActiveFiltersCount] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const pageSize = 50;

  const convertPhotosToMedia = (photos: string[], propertyId: string): Media[] => {
    return photos.map((url, index) => ({
      id: `photo-${propertyId}-${index}`,
      mediaKey: `photo-${propertyId}-${index}`,
      resourceRecordKey: propertyId,
      mediaURL: url,
      mediaCategory: 'Photo',
      mediaType: 'image',
      order: index,
      caption: null,
      modificationTimestamp: new Date(),
      localPath: null,
    }));
  };

  // Use HomeReview as primary data source for all searches (better filtering support)
  // HomeReview has Active, Under Contract, and Closed listings
  // MLS Grid is only used as fallback when HomeReview is unavailable
  const useHomeReview = true;
  const useMLSGrid = false; // MLS Grid has limited filtering - only use as backup

  const buildMLSGridQueryString = () => {
    const params = new URLSearchParams();
    
    if (filters.statusActive) params.append('standardStatus', 'Active');
    if (filters.statusUnderContract) params.append('standardStatus', 'Under Contract');
    
    if (filters.minPrice) params.set('minListPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxListPrice', String(filters.maxPrice));
    
    if (filters.minBeds) params.set('minBedroomsTotal', String(filters.minBeds));
    if (filters.maxBeds) params.set('maxBedroomsTotal', String(filters.maxBeds));
    if (filters.minTotalBaths) params.set('minBathroomsTotalInteger', String(filters.minTotalBaths));
    if (filters.maxTotalBaths) params.set('maxBathroomsTotalInteger', String(filters.maxTotalBaths));
    
    if (filters.minLivingArea) params.set('minLivingArea', String(filters.minLivingArea));
    if (filters.maxLivingArea) params.set('maxLivingArea', String(filters.maxLivingArea));
    
    if (filters.minYearBuilt) params.set('minYearBuilt', String(filters.minYearBuilt));
    if (filters.maxYearBuilt) params.set('maxYearBuilt', String(filters.maxYearBuilt));
    
    if (filters.city) {
      filters.city.split(',').map(c => c.trim()).filter(c => c).forEach(c => params.append('cities', c));
    }
    if (filters.subdivision) {
      filters.subdivision.split(',').map(s => s.trim()).filter(s => s).forEach(s => params.append('subdivisions', s));
    }
    if (filters.postalCode) {
      filters.postalCode.split(',').map(z => z.trim()).filter(z => z).forEach(z => params.append('postalCodes', z));
    }
    if (filters.propertySubType) params.append('propertySubType', filters.propertySubType);
    
    return params.toString();
  };

  const buildHomeReviewQueryString = () => {
    const params = new URLSearchParams();
    
    // Handle status toggles - HomeReview uses 'status' or 'statuses' parameter
    const statuses: string[] = [];
    if (filters.statusActive) statuses.push('Active');
    if (filters.statusUnderContract) statuses.push('Under Contract');
    if (filters.statusClosed) statuses.push('Closed');
    if (statuses.length > 0) {
      statuses.forEach(s => params.append('statuses', s));
    }
    
    // Price filters
    if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    
    // Beds/Baths
    if (filters.minBeds) params.set('minBeds', String(filters.minBeds));
    if (filters.maxBeds) params.set('maxBeds', String(filters.maxBeds));
    if (filters.minTotalBaths) params.set('minBaths', String(filters.minTotalBaths));
    if (filters.maxTotalBaths) params.set('maxBaths', String(filters.maxTotalBaths));
    
    // Size
    if (filters.minLivingArea) params.set('minSqft', String(filters.minLivingArea));
    if (filters.maxLivingArea) params.set('maxSqft', String(filters.maxLivingArea));
    if (filters.minLotSizeSqFt) params.set('minLotSize', String(filters.minLotSizeSqFt));
    if (filters.maxLotSizeSqFt) params.set('maxLotSize', String(filters.maxLotSizeSqFt));
    
    // Year Built
    if (filters.minYearBuilt) params.set('minYearBuilt', String(filters.minYearBuilt));
    if (filters.maxYearBuilt) params.set('maxYearBuilt', String(filters.maxYearBuilt));
    
    // Garage
    if (filters.minGarageSpaces) params.set('minGarageSpaces', String(filters.minGarageSpaces));
    
    // Location - Cities (comma-separated to array)
    if (filters.city) {
      filters.city.split(',').map(c => c.trim()).filter(c => c).forEach(c => params.append('cities', c));
    }
    
    // Location - Subdivisions (comma-separated to array)
    if (filters.subdivision) {
      filters.subdivision.split(',').map(s => s.trim()).filter(s => s).forEach(s => params.append('subdivisions', s));
    }
    
    // Location - Postal Codes (comma-separated to array)
    if (filters.postalCode) {
      filters.postalCode.split(',').map(z => z.trim()).filter(z => z).forEach(z => params.append('postalCodes', z));
    }
    
    // Location - Counties (comma-separated to array)
    if (filters.county) {
      filters.county.split(',').map(c => c.trim()).filter(c => c).forEach(c => params.append('counties', c));
    }
    
    // Schools
    if (filters.elementarySchool) {
      filters.elementarySchool.split(',').map(s => s.trim()).filter(s => s).forEach(s => params.append('elementarySchools', s));
    }
    if (filters.middleSchool) {
      filters.middleSchool.split(',').map(s => s.trim()).filter(s => s).forEach(s => params.append('middleSchools', s));
    }
    if (filters.highSchool) {
      filters.highSchool.split(',').map(s => s.trim()).filter(s => s).forEach(s => params.append('highSchools', s));
    }
    
    // Boolean features
    if (filters.privatePool === 'Yes') params.set('hasPool', 'true');
    if (filters.privatePool === 'No') params.set('hasPool', 'false');
    if (filters.waterfront === 'Yes') params.set('hasWaterfront', 'true');
    if (filters.waterfront === 'No') params.set('hasWaterfront', 'false');
    if (filters.view === 'Yes') params.set('hasView', 'true');
    if (filters.view === 'No') params.set('hasView', 'false');
    
    // Keywords search (public remarks)
    if (filters.publicRemarks) params.set('keywords', filters.publicRemarks);
    
    // Property type
    if (filters.propertySubType) params.append('propertySubTypes', filters.propertySubType);
    
    return params.toString();
  };

  const mlsGridQueryString = buildMLSGridQueryString();
  const homeReviewQueryString = buildHomeReviewQueryString();
  
  const mlsGridFullQuery = `${mlsGridQueryString}${mlsGridQueryString ? '&' : ''}limit=${pageSize}&offset=${currentPage * pageSize}`;
  const homeReviewFullQuery = `${homeReviewQueryString}${homeReviewQueryString ? '&' : ''}limit=${pageSize}&offset=${currentPage * pageSize}`;
  
  const { data: healthStatus } = useQuery<{ available: boolean; message: string }>({
    queryKey: ['/api/homereview/health'],
    queryFn: async () => {
      const res = await fetch('/api/homereview/health');
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
    enabled: useHomeReview,
  });

  const { data: mlsGridResponse, isLoading: mlsGridLoading, isError: mlsGridError, refetch: refetchMLSGrid } = useQuery<HomeReviewResponse>({
    queryKey: ['/api/mlsgrid/search', mlsGridFullQuery, searchTrigger],
    queryFn: async () => {
      const res = await fetch(`/api/mlsgrid/search?${mlsGridFullQuery}`);
      if (!res.ok) throw new Error('Failed to search MLS Grid');
      return res.json();
    },
    enabled: useMLSGrid && searchTrigger > 0,
    retry: 1,
  });

  const { data: homeReviewResponse, isLoading: homeReviewLoading, isError, refetch: refetchHomeReview } = useQuery<HomeReviewResponse>({
    queryKey: ['/api/homereview/properties', homeReviewFullQuery, searchTrigger],
    queryFn: async () => {
      const res = await fetch(`/api/homereview/properties?${homeReviewFullQuery}`);
      if (!res.ok) throw new Error('Failed to search properties');
      return res.json();
    },
    enabled: useHomeReview && searchTrigger > 0,
    retry: 1,
  });
  
  const isLoading = mlsGridLoading || homeReviewLoading;
  const properties = useMLSGrid 
    ? (mlsGridResponse?.properties || []) 
    : (homeReviewResponse?.properties || []);
  const totalCount = useMLSGrid 
    ? (mlsGridResponse?.total || 0) 
    : (homeReviewResponse?.total || 0);
  const isApiUnavailable = healthStatus?.available === false || isError;
  const dataSource = 'HomeReview (Active & Sold Data)';

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      const count = Object.values(updated).filter(v => 
        v !== undefined && v !== '' && v !== null
      ).length;
      setActiveFiltersCount(count);
      return updated;
    });
  };

  const clearFilter = (key: keyof SearchFilters) => {
    setFilters(prev => {
      const { [key]: removed, ...rest } = prev;
      const count = Object.values(rest).filter(v => 
        v !== undefined && v !== '' && v !== null
      ).length;
      setActiveFiltersCount(count);
      return rest;
    });
  };

  const clearAllFilters = () => {
    setFilters({ statusActive: true });
    setActiveFiltersCount(1);
    setSearchTrigger(0);
  };

  const handleSearch = () => {
    setCurrentPage(0);
    setSearchTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* API Status Banner */}
      {isApiUnavailable && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Data Source Unavailable:</strong> The HomeReview API is currently offline. 
              Property search may not return results until the service is restored.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Buyer Search</h1>
          <p className="text-muted-foreground mt-1">
            Advanced property search with comprehensive filters
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide' : 'Show'} Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            disabled
            data-testid="button-map-view"
          >
            <MapIcon className="w-4 h-4 mr-2" />
            Map View
          </Button>
          <Button
            variant="outline"
            disabled
            data-testid="button-save-search"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Search
          </Button>
        </div>
      </div>

      {/* Filters and Results Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Filters Panel - Wider Layout */}
        {showFilters && (
          <Card className="xl:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Search Filters</CardTitle>
                  <CardDescription>
                    Refine your property search
                  </CardDescription>
                </div>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    data-testid="button-clear-all"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-280px)] overflow-y-auto">
              <div className="space-y-6">
                {/* Status */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Status</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="status-active" className="text-base">Active</Label>
                      <Switch
                        id="status-active"
                        checked={filters.statusActive || false}
                        onCheckedChange={(checked) => updateFilter('statusActive', checked || undefined)}
                        data-testid="switch-status-active"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="status-under-contract" className="text-base">Under Contract</Label>
                      <Switch
                        id="status-under-contract"
                        checked={filters.statusUnderContract || false}
                        onCheckedChange={(checked) => updateFilter('statusUnderContract', checked || undefined)}
                        data-testid="switch-status-under-contract"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="status-closed" className="text-base">Closed</Label>
                      <Switch
                        id="status-closed"
                        checked={filters.statusClosed || false}
                        onCheckedChange={(checked) => updateFilter('statusClosed', checked || undefined)}
                        data-testid="switch-status-closed"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Date Range */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        type="date"
                        value={filters.dateRangeFrom || ''}
                        onChange={(e) => updateFilter('dateRangeFrom', e.target.value || undefined)}
                        data-testid="input-dateRangeFrom"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Input
                        type="date"
                        value={filters.dateRangeTo || ''}
                        onChange={(e) => updateFilter('dateRangeTo', e.target.value || undefined)}
                        data-testid="input-dateRangeTo"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Property Subtype */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Property Subtype</Label>
                  <Select
                    value={filters.propertySubType || ''}
                    onValueChange={(value) => updateFilter('propertySubType', value || undefined)}
                  >
                    <SelectTrigger data-testid="select-propertySubType" className="h-10">
                      <SelectValue placeholder="None Selected" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single Family">Single Family</SelectItem>
                      <SelectItem value="Condo">Condo</SelectItem>
                      <SelectItem value="Townhouse">Townhouse</SelectItem>
                      <SelectItem value="Multi-Family">Multi-Family</SelectItem>
                      <SelectItem value="Land">Land</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Contingency */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Contingency</Label>
                  <RadioGroup
                    value={filters.contingency || ''}
                    onValueChange={(value) => updateFilter('contingency', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="NA" id="contingency-na" />
                        <Label htmlFor="contingency-na" className="font-normal">NA</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="contingency-yes" />
                        <Label htmlFor="contingency-yes" className="font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="contingency-no" />
                        <Label htmlFor="contingency-no" className="font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Price Drop */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Price Drop</Label>
                  <RadioGroup
                    value={filters.priceDrop || ''}
                    onValueChange={(value) => updateFilter('priceDrop', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="NA" id="priceDrop-na" />
                        <Label htmlFor="priceDrop-na" className="font-normal">NA</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="priceDrop-yes" />
                        <Label htmlFor="priceDrop-yes" className="font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="priceDrop-no" />
                        <Label htmlFor="priceDrop-no" className="font-normal">No</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* List Price */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">List Price</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minPrice || ''}
                        onChange={(e) => updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minPrice"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxPrice || ''}
                        onChange={(e) => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxPrice"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* MLS Areas */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">MLS Areas</Label>
                  <Input
                    placeholder="Start Typing"
                    value={filters.mlsAreas || ''}
                    onChange={(e) => updateFilter('mlsAreas', e.target.value || undefined)}
                    data-testid="input-mlsAreas"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.mlsAreasMode || 'OR'}
                    onValueChange={(value) => updateFilter('mlsAreasMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="mlsAreas-or" />
                        <Label htmlFor="mlsAreas-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="mlsAreas-not" />
                        <Label htmlFor="mlsAreas-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Subdivisions */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Subdivisions</Label>
                  <Input
                    placeholder="Subdivisions"
                    value={filters.subdivision || ''}
                    onChange={(e) => updateFilter('subdivision', e.target.value || undefined)}
                    data-testid="input-subdivision"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.subdivisionMode || 'OR'}
                    onValueChange={(value) => updateFilter('subdivisionMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="subdivision-or" />
                        <Label htmlFor="subdivision-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="subdivision-not" />
                        <Label htmlFor="subdivision-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Cities */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cities</Label>
                  <Input
                    placeholder="Start Typing"
                    value={filters.city || ''}
                    onChange={(e) => updateFilter('city', e.target.value || undefined)}
                    data-testid="input-city"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.cityMode || 'OR'}
                    onValueChange={(value) => updateFilter('cityMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="city-or" />
                        <Label htmlFor="city-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="city-not" />
                        <Label htmlFor="city-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Zip Codes */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Zip Codes</Label>
                  <Input
                    placeholder="Start Typing"
                    value={filters.postalCode || ''}
                    onChange={(e) => updateFilter('postalCode', e.target.value || undefined)}
                    data-testid="input-postalCode"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.postalCodeMode || 'OR'}
                    onValueChange={(value) => updateFilter('postalCodeMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="postalCode-or" />
                        <Label htmlFor="postalCode-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="postalCode-not" />
                        <Label htmlFor="postalCode-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Street Number */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Street Number</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.streetNumberMin || ''}
                      onChange={(e) => updateFilter('streetNumberMin', e.target.value ? parseInt(e.target.value) : undefined)}
                      data-testid="input-streetNumberMin"
                      className="h-10"
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.streetNumberMax || ''}
                      onChange={(e) => updateFilter('streetNumberMax', e.target.value ? parseInt(e.target.value) : undefined)}
                      data-testid="input-streetNumberMax"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Street Name */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Street Name</Label>
                  <Input
                    placeholder="Street Name"
                    value={filters.streetName || ''}
                    onChange={(e) => updateFilter('streetName', e.target.value || undefined)}
                    data-testid="input-streetName"
                    className="h-10"
                  />
                </div>

                {/* Unit Number */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Unit Number</Label>
                  <Input
                    placeholder="Unit Number"
                    value={filters.unitNumber || ''}
                    onChange={(e) => updateFilter('unitNumber', e.target.value || undefined)}
                    data-testid="input-unitNumber"
                    className="h-10"
                  />
                </div>

                <Separator />

                {/* Elementary Schools */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Elementary Schools</Label>
                  <Input
                    placeholder="Start Typing"
                    value={filters.elementarySchool || ''}
                    onChange={(e) => updateFilter('elementarySchool', e.target.value || undefined)}
                    data-testid="input-elementarySchool"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.elementarySchoolMode || 'OR'}
                    onValueChange={(value) => updateFilter('elementarySchoolMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="elementarySchool-or" />
                        <Label htmlFor="elementarySchool-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="elementarySchool-not" />
                        <Label htmlFor="elementarySchool-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Middle Schools */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Middle/Junior Schools</Label>
                  <Input
                    placeholder="Start Typing"
                    value={filters.middleSchool || ''}
                    onChange={(e) => updateFilter('middleSchool', e.target.value || undefined)}
                    data-testid="input-middleSchool"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.middleSchoolMode || 'OR'}
                    onValueChange={(value) => updateFilter('middleSchoolMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="middleSchool-or" />
                        <Label htmlFor="middleSchool-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="middleSchool-not" />
                        <Label htmlFor="middleSchool-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* High Schools */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">High Schools</Label>
                  <Input
                    placeholder="Start Typing"
                    value={filters.highSchool || ''}
                    onChange={(e) => updateFilter('highSchool', e.target.value || undefined)}
                    data-testid="input-highSchool"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.highSchoolMode || 'OR'}
                    onValueChange={(value) => updateFilter('highSchoolMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="highSchool-or" />
                        <Label htmlFor="highSchool-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="highSchool-not" />
                        <Label htmlFor="highSchool-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* School District */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">School District</Label>
                  <Input
                    placeholder="Start Typing"
                    value={filters.schoolDistrict || ''}
                    onChange={(e) => updateFilter('schoolDistrict', e.target.value || undefined)}
                    data-testid="input-schoolDistrict"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.schoolDistrictMode || 'OR'}
                    onValueChange={(value) => updateFilter('schoolDistrictMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="schoolDistrict-or" />
                        <Label htmlFor="schoolDistrict-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="schoolDistrict-not" />
                        <Label htmlFor="schoolDistrict-not" className="font-normal">Not</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Year Built */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Year Built Range</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minYearBuilt || ''}
                        onChange={(e) => updateFilter('minYearBuilt', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minYearBuilt"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxYearBuilt || ''}
                        onChange={(e) => updateFilter('maxYearBuilt', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxYearBuilt"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Living Area */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Living Area (Sq Ft)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minLivingArea || ''}
                        onChange={(e) => updateFilter('minLivingArea', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minLivingArea"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxLivingArea || ''}
                        onChange={(e) => updateFilter('maxLivingArea', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxLivingArea"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Lot Size (Sq Ft) */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Lot Size (Square Feet)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minLotSizeSqFt || ''}
                        onChange={(e) => updateFilter('minLotSizeSqFt', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minLotSizeSqFt"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxLotSizeSqFt || ''}
                        onChange={(e) => updateFilter('maxLotSizeSqFt', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxLotSizeSqFt"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Lot Size (Acres) */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Lot Size (Acres)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minLotSizeAcres || ''}
                        onChange={(e) => updateFilter('minLotSizeAcres', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minLotSizeAcres"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxLotSizeAcres || ''}
                        onChange={(e) => updateFilter('maxLotSizeAcres', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxLotSizeAcres"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Bedrooms */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold"># Bedrooms</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minBeds || ''}
                        onChange={(e) => updateFilter('minBeds', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minBeds"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxBeds || ''}
                        onChange={(e) => updateFilter('maxBeds', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxBeds"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Main Level Bedrooms */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Main Level Bedrooms</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minMainLevelBeds || ''}
                        onChange={(e) => updateFilter('minMainLevelBeds', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minMainLevelBeds"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxMainLevelBeds || ''}
                        onChange={(e) => updateFilter('maxMainLevelBeds', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxMainLevelBeds"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Full Baths */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold"># Full Baths</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minFullBaths || ''}
                        onChange={(e) => updateFilter('minFullBaths', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minFullBaths"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxFullBaths || ''}
                        onChange={(e) => updateFilter('maxFullBaths', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxFullBaths"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Half Baths */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold"># Half Baths</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minHalfBaths || ''}
                        onChange={(e) => updateFilter('minHalfBaths', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minHalfBaths"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxHalfBaths || ''}
                        onChange={(e) => updateFilter('maxHalfBaths', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxHalfBaths"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Garage Spaces */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold"># Garage Spaces</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minGarageSpaces || ''}
                        onChange={(e) => updateFilter('minGarageSpaces', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minGarageSpaces"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxGarageSpaces || ''}
                        onChange={(e) => updateFilter('maxGarageSpaces', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxGarageSpaces"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Total Parking Spaces */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Total Parking Spaces</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minTotalParkingSpaces || ''}
                        onChange={(e) => updateFilter('minTotalParkingSpaces', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-minTotalParkingSpaces"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxTotalParkingSpaces || ''}
                        onChange={(e) => updateFilter('maxTotalParkingSpaces', e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-maxTotalParkingSpaces"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Property Condition */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Property Condition</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.propertyConditionMode || 'Or'}
                      onValueChange={(value) => updateFilter('propertyConditionMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="propertyCondition-and" />
                          <Label htmlFor="propertyCondition-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="propertyCondition-or" />
                          <Label htmlFor="propertyCondition-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="propertyCondition-not" />
                          <Label htmlFor="propertyCondition-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Excellent, Good, Average"
                      value={filters.propertyCondition || ''}
                      onChange={(e) => updateFilter('propertyCondition', e.target.value)}
                      data-testid="input-propertyCondition"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* HOA */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">HOA?</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.hoaMode || 'Or'}
                      onValueChange={(value) => updateFilter('hoaMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="hoa-and" />
                          <Label htmlFor="hoa-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="hoa-or" />
                          <Label htmlFor="hoa-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="hoa-not" />
                          <Label htmlFor="hoa-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Select
                      value={filters.hoa || ''}
                      onValueChange={(value) => updateFilter('hoa', value)}
                    >
                      <SelectTrigger className="h-10" data-testid="select-hoa">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Private Pool */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Private Pool?</Label>
                  <Select
                    value={filters.privatePool || ''}
                    onValueChange={(value) => updateFilter('privatePool', value)}
                  >
                    <SelectTrigger className="h-10" data-testid="select-privatePool">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Waterfront */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Waterfront?</Label>
                  <Select
                    value={filters.waterfront || ''}
                    onValueChange={(value) => updateFilter('waterfront', value)}
                  >
                    <SelectTrigger className="h-10" data-testid="select-waterfront">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="my-4" />

                {/* Levels/Stories */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Levels/Stories</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.levelsMode || 'Or'}
                      onValueChange={(value) => updateFilter('levelsMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="levels-and" />
                          <Label htmlFor="levels-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="levels-or" />
                          <Label htmlFor="levels-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="levels-not" />
                          <Label htmlFor="levels-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., 1, 2, 3 (comma-separated)"
                      value={filters.levels || ''}
                      onChange={(e) => updateFilter('levels', e.target.value)}
                      data-testid="input-levels"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Primary Bedroom on Main */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Primary Bedroom on Main?</Label>
                  <Select
                    value={filters.primaryBedOnMain || ''}
                    onValueChange={(value) => updateFilter('primaryBedOnMain', value)}
                  >
                    <SelectTrigger className="h-10" data-testid="select-primaryBedOnMain">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pool Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Pool Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.poolFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('poolFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="poolFeatures-and" />
                          <Label htmlFor="poolFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="poolFeatures-or" />
                          <Label htmlFor="poolFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="poolFeatures-not" />
                          <Label htmlFor="poolFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Heated, In Ground, Salt Water (comma-separated)"
                      value={filters.poolFeatures || ''}
                      onChange={(e) => updateFilter('poolFeatures', e.target.value)}
                      data-testid="input-poolFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Waterfront Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Waterfront Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.waterfrontFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('waterfrontFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="waterfrontFeatures-and" />
                          <Label htmlFor="waterfrontFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="waterfrontFeatures-or" />
                          <Label htmlFor="waterfrontFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="waterfrontFeatures-not" />
                          <Label htmlFor="waterfrontFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Lake, River, Ocean (comma-separated)"
                      value={filters.waterfrontFeatures || ''}
                      onChange={(e) => updateFilter('waterfrontFeatures', e.target.value)}
                      data-testid="input-waterfrontFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* View */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">View?</Label>
                  <Select
                    value={filters.view || ''}
                    onValueChange={(value) => updateFilter('view', value)}
                  >
                    <SelectTrigger className="h-10" data-testid="select-view">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* View Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">View Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.viewFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('viewFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="viewFeatures-and" />
                          <Label htmlFor="viewFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="viewFeatures-or" />
                          <Label htmlFor="viewFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="viewFeatures-not" />
                          <Label htmlFor="viewFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Mountain, City, Water (comma-separated)"
                      value={filters.viewFeatures || ''}
                      onChange={(e) => updateFilter('viewFeatures', e.target.value)}
                      data-testid="input-viewFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Horse */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Horse Property?</Label>
                  <Select
                    value={filters.horse || ''}
                    onValueChange={(value) => updateFilter('horse', value)}
                  >
                    <SelectTrigger className="h-10" data-testid="select-horse">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Horse Amenities */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Horse Amenities</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.horseAmenitiesMode || 'Or'}
                      onValueChange={(value) => updateFilter('horseAmenitiesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="horseAmenities-and" />
                          <Label htmlFor="horseAmenities-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="horseAmenities-or" />
                          <Label htmlFor="horseAmenities-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="horseAmenities-not" />
                          <Label htmlFor="horseAmenities-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Barn, Arena, Stalls (comma-separated)"
                      value={filters.horseAmenities || ''}
                      onChange={(e) => updateFilter('horseAmenities', e.target.value)}
                      data-testid="input-horseAmenities"
                      className="h-10"
                    />
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Interior Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Interior Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.interiorFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('interiorFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="interiorFeatures-and" />
                          <Label htmlFor="interiorFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="interiorFeatures-or" />
                          <Label htmlFor="interiorFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="interiorFeatures-not" />
                          <Label htmlFor="interiorFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Vaulted Ceiling, Walk-In Closet (comma-separated)"
                      value={filters.interiorFeatures || ''}
                      onChange={(e) => updateFilter('interiorFeatures', e.target.value)}
                      data-testid="input-interiorFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Flooring */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Flooring</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.flooringMode || 'Or'}
                      onValueChange={(value) => updateFilter('flooringMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="flooring-and" />
                          <Label htmlFor="flooring-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="flooring-or" />
                          <Label htmlFor="flooring-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="flooring-not" />
                          <Label htmlFor="flooring-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Hardwood, Tile, Carpet (comma-separated)"
                      value={filters.flooring || ''}
                      onChange={(e) => updateFilter('flooring', e.target.value)}
                      data-testid="input-flooring"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Fireplace Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Fireplace Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.fireplaceMode || 'Or'}
                      onValueChange={(value) => updateFilter('fireplaceMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="fireplace-and" />
                          <Label htmlFor="fireplace-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="fireplace-or" />
                          <Label htmlFor="fireplace-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="fireplace-not" />
                          <Label htmlFor="fireplace-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Gas, Wood Burning (comma-separated)"
                      value={filters.fireplaceFeatures || ''}
                      onChange={(e) => updateFilter('fireplaceFeatures', e.target.value)}
                      data-testid="input-fireplaceFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Utilities */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Utilities</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.utilitiesMode || 'Or'}
                      onValueChange={(value) => updateFilter('utilitiesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="utilities-and" />
                          <Label htmlFor="utilities-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="utilities-or" />
                          <Label htmlFor="utilities-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="utilities-not" />
                          <Label htmlFor="utilities-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Electric, Gas, Water (comma-separated)"
                      value={filters.utilities || ''}
                      onChange={(e) => updateFilter('utilities', e.target.value)}
                      data-testid="input-utilities"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Heating */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Heating</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.heatingMode || 'Or'}
                      onValueChange={(value) => updateFilter('heatingMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="heating-and" />
                          <Label htmlFor="heating-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="heating-or" />
                          <Label htmlFor="heating-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="heating-not" />
                          <Label htmlFor="heating-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Central, Heat Pump (comma-separated)"
                      value={filters.heating || ''}
                      onChange={(e) => updateFilter('heating', e.target.value)}
                      data-testid="input-heating"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Cooling */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Cooling</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.coolingMode || 'Or'}
                      onValueChange={(value) => updateFilter('coolingMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="cooling-and" />
                          <Label htmlFor="cooling-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="cooling-or" />
                          <Label htmlFor="cooling-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="cooling-not" />
                          <Label htmlFor="cooling-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Central Air, Window Units (comma-separated)"
                      value={filters.cooling || ''}
                      onChange={(e) => updateFilter('cooling', e.target.value)}
                      data-testid="input-cooling"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Water Source */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Water Source</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.waterSourceMode || 'Or'}
                      onValueChange={(value) => updateFilter('waterSourceMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="waterSource-and" />
                          <Label htmlFor="waterSource-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="waterSource-or" />
                          <Label htmlFor="waterSource-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="waterSource-not" />
                          <Label htmlFor="waterSource-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Public, Well, Private (comma-separated)"
                      value={filters.waterSource || ''}
                      onChange={(e) => updateFilter('waterSource', e.target.value)}
                      data-testid="input-waterSource"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Sewer */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Sewer</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.sewerMode || 'Or'}
                      onValueChange={(value) => updateFilter('sewerMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="sewer-and" />
                          <Label htmlFor="sewer-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="sewer-or" />
                          <Label htmlFor="sewer-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="sewer-not" />
                          <Label htmlFor="sewer-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Public, Septic, Private (comma-separated)"
                      value={filters.sewer || ''}
                      onChange={(e) => updateFilter('sewer', e.target.value)}
                      data-testid="input-sewer"
                      className="h-10"
                    />
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Spa Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Spa Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.spaFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('spaFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="spaFeatures-and" />
                          <Label htmlFor="spaFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="spaFeatures-or" />
                          <Label htmlFor="spaFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="spaFeatures-not" />
                          <Label htmlFor="spaFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Hot Tub, Indoor, Outdoor (comma-separated)"
                      value={filters.spaFeatures || ''}
                      onChange={(e) => updateFilter('spaFeatures', e.target.value)}
                      data-testid="input-spaFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Window Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Window Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.windowFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('windowFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="windowFeatures-and" />
                          <Label htmlFor="windowFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="windowFeatures-or" />
                          <Label htmlFor="windowFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="windowFeatures-not" />
                          <Label htmlFor="windowFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Double Pane, Bay Window, Skylight (comma-separated)"
                      value={filters.windowFeatures || ''}
                      onChange={(e) => updateFilter('windowFeatures', e.target.value)}
                      data-testid="input-windowFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Accessibility Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Accessibility Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.accessibilityFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('accessibilityFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="accessibility-and" />
                          <Label htmlFor="accessibility-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="accessibility-or" />
                          <Label htmlFor="accessibility-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="accessibility-not" />
                          <Label htmlFor="accessibility-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Wheelchair Access, Elevator, Ramp (comma-separated)"
                      value={filters.accessibilityFeatures || ''}
                      onChange={(e) => updateFilter('accessibilityFeatures', e.target.value)}
                      data-testid="input-accessibilityFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Security Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Security Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.securityFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('securityFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="security-and" />
                          <Label htmlFor="security-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="security-or" />
                          <Label htmlFor="security-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="security-not" />
                          <Label htmlFor="security-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Alarm System, Gated, Security Camera (comma-separated)"
                      value={filters.securityFeatures || ''}
                      onChange={(e) => updateFilter('securityFeatures', e.target.value)}
                      data-testid="input-securityFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Exterior Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Exterior Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.exteriorFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('exteriorFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="exteriorFeatures-and" />
                          <Label htmlFor="exteriorFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="exteriorFeatures-or" />
                          <Label htmlFor="exteriorFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="exteriorFeatures-not" />
                          <Label htmlFor="exteriorFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Brick, Vinyl Siding, Stone (comma-separated)"
                      value={filters.exteriorFeatures || ''}
                      onChange={(e) => updateFilter('exteriorFeatures', e.target.value)}
                      data-testid="input-exteriorFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Foundation Details */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Foundation</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.foundationMode || 'Or'}
                      onValueChange={(value) => updateFilter('foundationMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="foundation-and" />
                          <Label htmlFor="foundation-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="foundation-or" />
                          <Label htmlFor="foundation-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="foundation-not" />
                          <Label htmlFor="foundation-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Slab, Crawl Space, Basement (comma-separated)"
                      value={filters.foundation || ''}
                      onChange={(e) => updateFilter('foundation', e.target.value)}
                      data-testid="input-foundation"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Lot Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Lot Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.lotFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('lotFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="lotFeatures-and" />
                          <Label htmlFor="lotFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="lotFeatures-or" />
                          <Label htmlFor="lotFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="lotFeatures-not" />
                          <Label htmlFor="lotFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Corner Lot, Cul-de-Sac, Tree Cover (comma-separated)"
                      value={filters.lotFeatures || ''}
                      onChange={(e) => updateFilter('lotFeatures', e.target.value)}
                      data-testid="input-lotFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Fencing */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Fencing</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.fencingMode || 'Or'}
                      onValueChange={(value) => updateFilter('fencingMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="fencing-and" />
                          <Label htmlFor="fencing-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="fencing-or" />
                          <Label htmlFor="fencing-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="fencing-not" />
                          <Label htmlFor="fencing-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Wood, Chain Link, Privacy (comma-separated)"
                      value={filters.fencing || ''}
                      onChange={(e) => updateFilter('fencing', e.target.value)}
                      data-testid="input-fencing"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Patio and Porch Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Patio and Porch Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.patioAndPorchFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('patioAndPorchFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="patioAndPorch-and" />
                          <Label htmlFor="patioAndPorch-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="patioAndPorch-or" />
                          <Label htmlFor="patioAndPorch-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="patioAndPorch-not" />
                          <Label htmlFor="patioAndPorch-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Covered Patio, Screened Porch, Deck (comma-separated)"
                      value={filters.patioAndPorchFeatures || ''}
                      onChange={(e) => updateFilter('patioAndPorchFeatures', e.target.value)}
                      data-testid="input-patioAndPorchFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Parking Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Parking Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.parkingFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('parkingFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="parkingFeatures-and" />
                          <Label htmlFor="parkingFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="parkingFeatures-or" />
                          <Label htmlFor="parkingFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="parkingFeatures-not" />
                          <Label htmlFor="parkingFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Attached Garage, Carport, Off-Street (comma-separated)"
                      value={filters.parkingFeatures || ''}
                      onChange={(e) => updateFilter('parkingFeatures', e.target.value)}
                      data-testid="input-parkingFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Community Features */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Community Features</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.communityFeaturesMode || 'Or'}
                      onValueChange={(value) => updateFilter('communityFeaturesMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="communityFeatures-and" />
                          <Label htmlFor="communityFeatures-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="communityFeatures-or" />
                          <Label htmlFor="communityFeatures-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="communityFeatures-not" />
                          <Label htmlFor="communityFeatures-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Pool, Clubhouse, Fitness Center (comma-separated)"
                      value={filters.communityFeatures || ''}
                      onChange={(e) => updateFilter('communityFeatures', e.target.value)}
                      data-testid="input-communityFeatures"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Green Energy Efficient */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Green Energy Efficient</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.greenEnergyEfficientMode || 'Or'}
                      onValueChange={(value) => updateFilter('greenEnergyEfficientMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="greenEnergy-and" />
                          <Label htmlFor="greenEnergy-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="greenEnergy-or" />
                          <Label htmlFor="greenEnergy-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="greenEnergy-not" />
                          <Label htmlFor="greenEnergy-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Solar Panels, Energy Star, LED Lighting (comma-separated)"
                      value={filters.greenEnergyEfficient || ''}
                      onChange={(e) => updateFilter('greenEnergyEfficient', e.target.value)}
                      data-testid="input-greenEnergyEfficient"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Green Sustainability */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Green Sustainability</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.greenSustainabilityMode || 'Or'}
                      onValueChange={(value) => updateFilter('greenSustainabilityMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="greenSustainability-and" />
                          <Label htmlFor="greenSustainability-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="greenSustainability-or" />
                          <Label htmlFor="greenSustainability-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="greenSustainability-not" />
                          <Label htmlFor="greenSustainability-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., LEED Certified, Recycled Materials (comma-separated)"
                      value={filters.greenSustainability || ''}
                      onChange={(e) => updateFilter('greenSustainability', e.target.value)}
                      data-testid="input-greenSustainability"
                      className="h-10"
                    />
                  </div>
                </div>

                <Separator className="my-4" />

                {/* County or Parish */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">County or Parish</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.countyMode || 'Or'}
                      onValueChange={(value) => updateFilter('countyMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="county-and" />
                          <Label htmlFor="county-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="county-or" />
                          <Label htmlFor="county-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="county-not" />
                          <Label htmlFor="county-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Fulton, DeKalb (comma-separated)"
                      value={filters.county || ''}
                      onChange={(e) => updateFilter('county', e.target.value)}
                      data-testid="input-county"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Acceptable Financing */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Acceptable Financing</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.acceptableFinancingMode || 'Or'}
                      onValueChange={(value) => updateFilter('acceptableFinancingMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="financing-and" />
                          <Label htmlFor="financing-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="financing-or" />
                          <Label htmlFor="financing-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="financing-not" />
                          <Label htmlFor="financing-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Cash, Conventional, FHA, VA (comma-separated)"
                      value={filters.acceptableFinancing || ''}
                      onChange={(e) => updateFilter('acceptableFinancing', e.target.value)}
                      data-testid="input-acceptableFinancing"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Special Listing Conditions */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Special Listing Conditions</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.specialListingConditionsMode || 'Or'}
                      onValueChange={(value) => updateFilter('specialListingConditionsMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="specialConditions-and" />
                          <Label htmlFor="specialConditions-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="specialConditions-or" />
                          <Label htmlFor="specialConditions-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="specialConditions-not" />
                          <Label htmlFor="specialConditions-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., Short Sale, REO, Foreclosure (comma-separated)"
                      value={filters.specialListingConditions || ''}
                      onChange={(e) => updateFilter('specialListingConditions', e.target.value)}
                      data-testid="input-specialListingConditions"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Occupant Type */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Occupant Type</Label>
                  <Input
                    type="text"
                    placeholder="e.g., Owner, Tenant, Vacant"
                    value={filters.occupantType || ''}
                    onChange={(e) => updateFilter('occupantType', e.target.value)}
                    data-testid="input-occupantType"
                    className="h-10"
                  />
                </div>

                {/* Possession */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Possession</Label>
                  <div className="space-y-2">
                    <RadioGroup
                      value={filters.possessionMode || 'Or'}
                      onValueChange={(value) => updateFilter('possessionMode', value)}
                    >
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="And" id="possession-and" />
                          <Label htmlFor="possession-and" className="font-normal cursor-pointer">And</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Or" id="possession-or" />
                          <Label htmlFor="possession-or" className="font-normal cursor-pointer">Or</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Not" id="possession-not" />
                          <Label htmlFor="possession-not" className="font-normal cursor-pointer">Not</Label>
                        </div>
                      </div>
                    </RadioGroup>
                    <Input
                      type="text"
                      placeholder="e.g., At Closing, Negotiable (comma-separated)"
                      value={filters.possession || ''}
                      onChange={(e) => updateFilter('possession', e.target.value)}
                      data-testid="input-possession"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    className="w-full"
                    onClick={handleSearch}
                    disabled={activeFiltersCount === 0}
                    data-testid="button-search"
                    size="lg"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search Properties
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Panel */}
        <Card className={showFilters ? "xl:col-span-2" : "xl:col-span-3"}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Search Results
                  {searchTrigger > 0 && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {dataSource}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {totalCount > 0 
                    ? `Found ${totalCount.toLocaleString()} properties (showing ${properties.length} on page ${currentPage + 1})`
                    : searchTrigger === 0
                      ? 'Click "Search Properties" to search'
                      : 'No properties found - try adjusting filters'
                  }
                </CardDescription>
              </div>
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 max-w-2xl">
                  {Object.entries(filters).map(([key, value]) => {
                    if (!value) return null;
                    if (key.endsWith('Mode')) return null;
                    return (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="gap-1"
                      >
                        {key}: {String(value)}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => clearFilter(key as keyof SearchFilters)}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Searching properties...
              </div>
            ) : properties && properties.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {properties.map((property: any) => (
                    <PropertyCard 
                      key={property.id} 
                      property={property}
                      media={property.photos?.length ? convertPhotosToMedia(property.photos, property.listingId || property.id) : undefined}
                      onClick={() => setLocation(`/properties/${property.listingId || property.id}`)}
                    />
                  ))}
                </div>
                {/* Pagination */}
                {totalCount > pageSize && (
                  <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage + 1} of {Math.ceil(totalCount / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={(currentPage + 1) * pageSize >= totalCount}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : searchTrigger > 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No properties found matching your criteria.</p>
                <p className="text-sm mt-2">Try adjusting your filters or changing the status filter.</p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Configure your search filters and click "Search Properties"</p>
                <p className="text-sm mt-2">Use the panel on the left to refine your search.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
