import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  Map as MapIcon,
  Save,
  Filter,
} from "lucide-react";
import { PropertyCard } from "@/components/PropertyCard";
import type { Property } from "@shared/schema";

interface SearchFilters {
  // Status & Dates
  status?: string;
  statusDateFrom?: string;
  statusDateTo?: string;
  
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
  neighborhood?: string;
  neighborhoodMode?: string;
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
  
  // Features
  selectLevels?: string;
  selectLevelsMode?: string;
  newConstruction?: string;
  builderName?: string;
  builderNameMode?: string;
  roofType?: string;
  roofTypeMode?: string;
  minFireplaces?: number;
  maxFireplaces?: number;
  propertyCondition?: string;
  utilities?: string;
  utilitiesMode?: string;
  interiorFeatures?: string;
  interiorFeaturesMode?: string;
  directionFaces?: string;
  directionFacesMode?: string;
  restrictions?: string;
  restrictionsMode?: string;
  acceptableFinancing?: string;
  acceptableFinancingMode?: string;
  
  // Search
  publicRemarks?: string;
  
  // Date
  minListDate?: string;
  maxListDate?: string;
}

export default function BuyerSearch() {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [showFilters, setShowFilters] = useState(true);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        params.set(key, String(value));
      }
    });
    
    return params.toString();
  };

  const { data: properties, isLoading, refetch } = useQuery<Property[]>({
    queryKey: ['/api/properties/search', buildQueryString()],
    enabled: Object.keys(filters).length > 0,
  });

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
    setFilters({});
    setActiveFiltersCount(0);
  };

  const handleSearch = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
                  <Select
                    value={filters.status || ''}
                    onValueChange={(value) => updateFilter('status', value || undefined)}
                  >
                    <SelectTrigger data-testid="select-status" className="h-10">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Under Contract">Under Contract</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  {filters.status && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input
                          type="date"
                          value={filters.statusDateFrom || ''}
                          onChange={(e) => updateFilter('statusDateFrom', e.target.value || undefined)}
                          data-testid="input-statusDateFrom"
                          className="h-10"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input
                          type="date"
                          value={filters.statusDateTo || ''}
                          onChange={(e) => updateFilter('statusDateTo', e.target.value || undefined)}
                          data-testid="input-statusDateTo"
                          className="h-10"
                        />
                      </div>
                    </div>
                  )}
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

                {/* Neighborhood */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Neighborhood</Label>
                  <Input
                    placeholder="Select Neighborhood"
                    value={filters.neighborhood || ''}
                    onChange={(e) => updateFilter('neighborhood', e.target.value || undefined)}
                    data-testid="input-neighborhood"
                    className="h-10"
                  />
                  <RadioGroup
                    value={filters.neighborhoodMode || 'OR'}
                    onValueChange={(value) => updateFilter('neighborhoodMode', value)}
                  >
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="OR" id="neighborhood-or" />
                        <Label htmlFor="neighborhood-or" className="font-normal">OR</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not" id="neighborhood-not" />
                        <Label htmlFor="neighborhood-not" className="font-normal">Not</Label>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  {properties ? `Found ${properties.length} properties` : 'Configure filters and click Search'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : activeFiltersCount > 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No properties found matching your criteria.</p>
                <p className="text-sm mt-2">Try adjusting your filters.</p>
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
