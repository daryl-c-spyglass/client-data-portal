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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  // Status
  status?: string[];
  
  // Price
  minPrice?: number;
  maxPrice?: number;
  
  // Date
  minListDate?: string;
  maxListDate?: string;
  
  // Beds/Baths
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  
  // Size
  minLivingArea?: number;
  maxLivingArea?: number;
  minLotSize?: number;
  maxLotSize?: number;
  
  // Year
  minYearBuilt?: number;
  maxYearBuilt?: number;
  
  // Location
  postalCode?: string;
  city?: string;
  mlsAreaMajor?: string;
  neighborhood?: string;
  subdivision?: string;
  
  // Schools
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  
  // Property Type
  propertySubType?: string;
}

export default function BuyerSearch() {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [showFilters, setShowFilters] = useState(true);

  // Build query string from filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    
    // Add all non-empty filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          params.set(key, value.join(','));
        } else {
          params.set(key, String(value));
        }
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
      // Count active filters
      const count = Object.values(updated).filter(v => {
        if (Array.isArray(v)) return v.length > 0;
        return v !== undefined && v !== '' && v !== null;
      }).length;
      setActiveFiltersCount(count);
      return updated;
    });
  };

  const clearFilter = (key: keyof SearchFilters) => {
    setFilters(prev => {
      const { [key]: removed, ...rest } = prev;
      const count = Object.values(rest).filter(v => {
        if (Array.isArray(v)) return v.length > 0;
        return v !== undefined && v !== '' && v !== null;
      }).length;
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Filters Panel */}
        {showFilters && (
          <Card className="lg:col-span-4 h-fit">
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
            <CardContent>
              <ScrollArea className="h-[calc(100vh-300px)]">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="location">Location</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                  </TabsList>

                  {/* Basic Filters Tab */}
                  <TabsContent value="basic" className="space-y-4 mt-4">
                    {/* Status */}
                    <div className="space-y-2">
                      <Label>Property Status</Label>
                      <Select
                        value={filters.status?.[0] || ''}
                        onValueChange={(value) => updateFilter('status', value ? [value] : undefined)}
                      >
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Any status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Under Contract">Under Contract</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-2">
                      <Label>Price Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min price"
                          value={filters.minPrice || ''}
                          onChange={(e) => updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-minPrice"
                        />
                        <Input
                          type="number"
                          placeholder="Max price"
                          value={filters.maxPrice || ''}
                          onChange={(e) => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-maxPrice"
                        />
                      </div>
                    </div>

                    {/* Beds */}
                    <div className="space-y-2">
                      <Label>Bedrooms</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min beds"
                          value={filters.minBeds || ''}
                          onChange={(e) => updateFilter('minBeds', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-minBeds"
                        />
                        <Input
                          type="number"
                          placeholder="Max beds"
                          value={filters.maxBeds || ''}
                          onChange={(e) => updateFilter('maxBeds', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-maxBeds"
                        />
                      </div>
                    </div>

                    {/* Baths */}
                    <div className="space-y-2">
                      <Label>Bathrooms</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min baths"
                          value={filters.minBaths || ''}
                          onChange={(e) => updateFilter('minBaths', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-minBaths"
                        />
                        <Input
                          type="number"
                          placeholder="Max baths"
                          value={filters.maxBaths || ''}
                          onChange={(e) => updateFilter('maxBaths', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-maxBaths"
                        />
                      </div>
                    </div>

                    {/* Living Area */}
                    <div className="space-y-2">
                      <Label>Living Area (sq ft)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min sq ft"
                          value={filters.minLivingArea || ''}
                          onChange={(e) => updateFilter('minLivingArea', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-minLivingArea"
                        />
                        <Input
                          type="number"
                          placeholder="Max sq ft"
                          value={filters.maxLivingArea || ''}
                          onChange={(e) => updateFilter('maxLivingArea', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-maxLivingArea"
                        />
                      </div>
                    </div>

                    {/* Property Type */}
                    <div className="space-y-2">
                      <Label>Property Type</Label>
                      <Input
                        placeholder="e.g., Single Family, Condo"
                        value={filters.propertySubType || ''}
                        onChange={(e) => updateFilter('propertySubType', e.target.value || undefined)}
                        data-testid="input-propertySubType"
                      />
                    </div>
                  </TabsContent>

                  {/* Location Filters Tab */}
                  <TabsContent value="location" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Zip Code</Label>
                      <Input
                        placeholder="90210"
                        value={filters.postalCode || ''}
                        onChange={(e) => updateFilter('postalCode', e.target.value || undefined)}
                        data-testid="input-postalCode"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        placeholder="Los Angeles"
                        value={filters.city || ''}
                        onChange={(e) => updateFilter('city', e.target.value || undefined)}
                        data-testid="input-city"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Neighborhood</Label>
                      <Input
                        placeholder="Beverly Hills"
                        value={filters.neighborhood || ''}
                        onChange={(e) => updateFilter('neighborhood', e.target.value || undefined)}
                        data-testid="input-neighborhood"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Subdivision</Label>
                      <Input
                        placeholder="Oak Park Estates"
                        value={filters.subdivision || ''}
                        onChange={(e) => updateFilter('subdivision', e.target.value || undefined)}
                        data-testid="input-subdivision"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>MLS Area</Label>
                      <Input
                        placeholder="West LA"
                        value={filters.mlsAreaMajor || ''}
                        onChange={(e) => updateFilter('mlsAreaMajor', e.target.value || undefined)}
                        data-testid="input-mlsAreaMajor"
                      />
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-2">
                      <Label>Elementary School</Label>
                      <Input
                        placeholder="Lincoln Elementary"
                        value={filters.elementarySchool || ''}
                        onChange={(e) => updateFilter('elementarySchool', e.target.value || undefined)}
                        data-testid="input-elementarySchool"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Middle School</Label>
                      <Input
                        placeholder="Roosevelt Middle"
                        value={filters.middleSchool || ''}
                        onChange={(e) => updateFilter('middleSchool', e.target.value || undefined)}
                        data-testid="input-middleSchool"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>High School</Label>
                      <Input
                        placeholder="Washington High"
                        value={filters.highSchool || ''}
                        onChange={(e) => updateFilter('highSchool', e.target.value || undefined)}
                        data-testid="input-highSchool"
                      />
                    </div>
                  </TabsContent>

                  {/* Details Filters Tab */}
                  <TabsContent value="details" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Lot Size (sq ft)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min lot size"
                          value={filters.minLotSize || ''}
                          onChange={(e) => updateFilter('minLotSize', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-minLotSize"
                        />
                        <Input
                          type="number"
                          placeholder="Max lot size"
                          value={filters.maxLotSize || ''}
                          onChange={(e) => updateFilter('maxLotSize', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-maxLotSize"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Year Built</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min year"
                          value={filters.minYearBuilt || ''}
                          onChange={(e) => updateFilter('minYearBuilt', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-minYearBuilt"
                        />
                        <Input
                          type="number"
                          placeholder="Max year"
                          value={filters.maxYearBuilt || ''}
                          onChange={(e) => updateFilter('maxYearBuilt', e.target.value ? Number(e.target.value) : undefined)}
                          data-testid="input-maxYearBuilt"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>List Date Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={filters.minListDate || ''}
                          onChange={(e) => updateFilter('minListDate', e.target.value || undefined)}
                          data-testid="input-minListDate"
                        />
                        <Input
                          type="date"
                          value={filters.maxListDate || ''}
                          onChange={(e) => updateFilter('maxListDate', e.target.value || undefined)}
                          data-testid="input-maxListDate"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 pt-4 border-t">
                  <Button
                    className="w-full"
                    onClick={handleSearch}
                    disabled={activeFiltersCount === 0}
                    data-testid="button-search"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search Properties
                  </Button>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Results Panel */}
        <Card className={showFilters ? "lg:col-span-8" : "lg:col-span-12"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  {properties ? `Found ${properties.length} properties` : 'Configure filters and click Search'}
                </CardDescription>
              </div>
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(filters).map(([key, value]) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) return null;
                    return (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="gap-1"
                      >
                        {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
