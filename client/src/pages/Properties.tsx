import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Map as MapIcon, Search, Database, RotateCcw, List, Home, Building2, TreePine, HelpCircle } from "lucide-react";
import { SearchCriteriaForm } from "@/components/SearchCriteria";
import { PropertyResults } from "@/components/PropertyResults";
import { PropertyMapView } from "@/components/PropertyMapView";
import { unifiedSearchWithMeta, type SearchResultWithMeta } from "@/lib/api";
import { useSelectedProperty } from "@/contexts/SelectedPropertyContext";
import type { Property, Media, SearchCriteria } from "@shared/schema";

// Safe number parser that returns undefined for invalid values
function safeParseInt(value: string | null): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

function safeParseFloat(value: string | null): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

// Parse search criteria from URL query string
function parseCriteriaFromUrl(searchString: string): SearchCriteria | null {
  if (!searchString) return null;
  try {
    const params = new URLSearchParams(searchString);
    const criteria: Partial<SearchCriteria> = {};
    
    // Parse status array - support both "status" and "statuses" keys
    const statusParam = params.get('statuses') || params.get('status');
    if (statusParam) {
      criteria.status = statusParam.split(',') as ('Active' | 'Under Contract' | 'Closed' | 'Pending')[];
    }
    
    // Parse cities array
    const citiesParam = params.get('cities');
    if (citiesParam) {
      criteria.cities = citiesParam.split(',');
    }
    
    // Parse subdivisions array
    const subdivisionsParam = params.get('subdivisions');
    if (subdivisionsParam) {
      criteria.subdivisions = subdivisionsParam.split(',');
    }
    
    // Parse zipCodes array
    const zipCodesParam = params.get('zipCodes');
    if (zipCodesParam) {
      criteria.zipCodes = zipCodesParam.split(',');
    }
    
    // Parse neighborhood array
    const neighborhoodParam = params.get('neighborhood');
    if (neighborhoodParam) {
      criteria.neighborhood = neighborhoodParam.split(',');
    }
    
    // Parse numeric values with NaN guards
    const minPriceVal = safeParseInt(params.get('listPriceMin'));
    if (minPriceVal !== undefined) criteria.listPriceMin = minPriceVal;
    
    const maxPriceVal = safeParseInt(params.get('listPriceMax'));
    if (maxPriceVal !== undefined) criteria.listPriceMax = maxPriceVal;
    
    const bedsMinVal = safeParseInt(params.get('bedroomsMin'));
    if (bedsMinVal !== undefined) criteria.bedroomsMin = bedsMinVal;
    
    const bathsMinVal = safeParseInt(params.get('fullBathsMin'));
    if (bathsMinVal !== undefined) criteria.fullBathsMin = bathsMinVal;
    
    // Parse additional numeric filters with NaN guards
    const soldDaysVal = safeParseInt(params.get('soldDays'));
    if (soldDaysVal !== undefined) (criteria as any).soldDays = soldDaysVal;
    
    const storiesVal = safeParseInt(params.get('stories'));
    if (storiesVal !== undefined) (criteria as any).stories = storiesVal;
    
    const minLotAcresVal = safeParseFloat(params.get('minLotAcres'));
    if (minLotAcresVal !== undefined) (criteria as any).minLotAcres = minLotAcresVal;
    
    const maxLotAcresVal = safeParseFloat(params.get('maxLotAcres'));
    if (maxLotAcresVal !== undefined) (criteria as any).maxLotAcres = maxLotAcresVal;
    
    const minYearBuiltVal = safeParseInt(params.get('minYearBuilt'));
    if (minYearBuiltVal !== undefined) (criteria as any).minYearBuilt = minYearBuiltVal;
    
    const maxYearBuiltVal = safeParseInt(params.get('maxYearBuilt'));
    if (maxYearBuiltVal !== undefined) (criteria as any).maxYearBuilt = maxYearBuiltVal;
    
    const minSqftVal = safeParseInt(params.get('minSqft'));
    if (minSqftVal !== undefined) (criteria as any).minSqft = minSqftVal;
    
    const maxSqftVal = safeParseInt(params.get('maxSqft'));
    if (maxSqftVal !== undefined) (criteria as any).maxSqft = maxSqftVal;
    
    // Parse string filters
    const propertySubType = params.get('propertySubType');
    if (propertySubType) criteria.propertySubType = propertySubType;
    
    // Return null if no criteria were parsed
    if (Object.keys(criteria).length === 0) return null;
    
    return criteria as SearchCriteria;
  } catch {
    return null;
  }
}

// Serialize search criteria to URL query string (covers all supported filters)
function serializeCriteriaToUrl(criteria: SearchCriteria): string {
  const params = new URLSearchParams();
  
  // Arrays - use "statuses" key for consistency with API
  if (criteria.status && criteria.status.length > 0) {
    params.set('statuses', criteria.status.join(','));
  }
  if (criteria.cities && criteria.cities.length > 0) {
    params.set('cities', criteria.cities.join(','));
  }
  if (criteria.subdivisions && criteria.subdivisions.length > 0) {
    params.set('subdivisions', criteria.subdivisions.join(','));
  }
  if (criteria.zipCodes && criteria.zipCodes.length > 0) {
    params.set('zipCodes', criteria.zipCodes.join(','));
  }
  if (criteria.neighborhood && criteria.neighborhood.length > 0) {
    params.set('neighborhood', criteria.neighborhood.join(','));
  }
  
  // Numeric filters
  if (criteria.listPriceMin !== undefined) {
    params.set('listPriceMin', String(criteria.listPriceMin));
  }
  if (criteria.listPriceMax !== undefined) {
    params.set('listPriceMax', String(criteria.listPriceMax));
  }
  if (criteria.bedroomsMin !== undefined) {
    params.set('bedroomsMin', String(criteria.bedroomsMin));
  }
  if (criteria.fullBathsMin !== undefined) {
    params.set('fullBathsMin', String(criteria.fullBathsMin));
  }
  if ((criteria as any).soldDays !== undefined) {
    params.set('soldDays', String((criteria as any).soldDays));
  }
  if ((criteria as any).stories !== undefined) {
    params.set('stories', String((criteria as any).stories));
  }
  if ((criteria as any).minLotAcres !== undefined) {
    params.set('minLotAcres', String((criteria as any).minLotAcres));
  }
  if ((criteria as any).maxLotAcres !== undefined) {
    params.set('maxLotAcres', String((criteria as any).maxLotAcres));
  }
  if ((criteria as any).minYearBuilt !== undefined) {
    params.set('minYearBuilt', String((criteria as any).minYearBuilt));
  }
  if ((criteria as any).maxYearBuilt !== undefined) {
    params.set('maxYearBuilt', String((criteria as any).maxYearBuilt));
  }
  if ((criteria as any).minSqft !== undefined) {
    params.set('minSqft', String((criteria as any).minSqft));
  }
  if ((criteria as any).maxSqft !== undefined) {
    params.set('maxSqft', String((criteria as any).maxSqft));
  }
  
  // String filters
  if (criteria.propertySubType) {
    params.set('propertySubType', criteria.propertySubType);
  }
  
  return params.toString();
}

export default function Properties() {
  const searchString = useSearch();
  const [location, navigate] = useLocation();
  const { setSelectedProperty } = useSelectedProperty();
  
  // Parse criteria from URL - reactive to URL changes (browser back/forward, shared URLs)
  const urlCriteria = useMemo(() => parseCriteriaFromUrl(searchString), [searchString]);
  
  const [activeTab, setActiveTab] = useState(urlCriteria ? "results" : "search");
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(urlCriteria);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Sync searchCriteria with URL when URL changes (browser history navigation)
  useEffect(() => {
    if (urlCriteria) {
      setSearchCriteria(urlCriteria);
      setActiveTab("results");
    } else {
      setSearchCriteria(null);
      setActiveTab("search");
    }
  }, [searchString]); // Re-run when URL changes

  // Fetch total property count
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['/api/properties/count'],
  });
  const totalCount = countData?.count ?? 0;

  // Fetch properties with search criteria if available
  // Uses unified search API: Repliers for active, HomeReview/DB for closed
  // Use serialized criteria string as queryKey to prevent cache collisions
  const criteriaKey = searchCriteria ? serializeCriteriaToUrl(searchCriteria) : '';
  const { data: searchResult, isLoading, error } = useQuery<SearchResultWithMeta>({
    queryKey: ['/api/search', criteriaKey],
    queryFn: () => unifiedSearchWithMeta(searchCriteria!),
    enabled: (searchCriteria !== null),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  const properties = searchResult?.properties ?? [];

  const handleSearch = (criteria: SearchCriteria) => {
    setSearchCriteria(criteria);
    // Update URL with search criteria for persistence
    const queryString = serializeCriteriaToUrl(criteria);
    navigate(`/properties?${queryString}`, { replace: true });
    setActiveTab("results");
  };
  
  const handleReset = () => {
    setSearchCriteria(null);
    navigate('/properties', { replace: true });
    setActiveTab("search");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === properties.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(properties.map(p => p.id)));
    }
  };

  // Convert photos to Media format for context
  const convertPhotosToMedia = (property: Property): Media[] => {
    const photos = (property as any).photos as string[] | undefined;
    if (!photos || photos.length === 0) return [];
    return photos.map((url, index) => ({
      id: `${property.id}-photo-${index}`,
      resourceRecordKey: property.id,
      mediaKey: `${property.id}-${index}`,
      mediaURL: url,
      localPath: null,
      order: index,
      caption: null,
      mediaCategory: null,
      mediaType: 'image/jpeg',
      modificationTimestamp: new Date(),
    } as unknown as Media));
  };

  const handlePropertyClick = (property: Property) => {
    // Set the selected property in context before navigation
    setSelectedProperty({
      property,
      media: convertPhotosToMedia(property),
    });
    navigate(`/properties/${property.id}`);
  };

  const handleAddToCart = (property: Property) => {
    console.log("Add to cart:", property);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-properties-title">Properties</h1>
          <p className="text-muted-foreground">
            {totalCount > 0 
              ? `${totalCount.toLocaleString()} properties available in MLS Grid`
              : 'Search and browse MLS Grid listings'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {searchCriteria && (
            <>
              <Button variant="outline" onClick={handleReset} data-testid="button-reset-search">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button onClick={() => setActiveTab("search")} data-testid="button-modify-search">
                <Search className="w-4 h-4 mr-2" />
                Modify Search
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Data Source & Inventory Summary */}
      {searchResult && (
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Data Source */}
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Data Source:</span>
                <Badge variant="secondary" data-testid="badge-data-source">{searchResult.dataSource}</Badge>
              </div>
              
              {/* Results Count */}
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Results:</span>
                <Badge variant="outline" data-testid="badge-total-count">{searchResult.count}</Badge>
              </div>
            </div>
            
            {/* Inventory by Status */}
            <div className="mt-4 flex flex-wrap gap-6">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Status</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-status-active">
                    Active: {searchResult.inventoryByStatus['Active']}
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" data-testid="badge-status-under-contract">
                    Under Contract: {searchResult.inventoryByStatus['Under Contract']}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" data-testid="badge-status-closed">
                    Closed: {searchResult.inventoryByStatus['Closed']}
                  </Badge>
                </div>
              </div>
              
              {/* Inventory by Subtype */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Property Type</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" data-testid="badge-subtype-sfr">
                    <Home className="w-3 h-3 mr-1" />
                    Single Family: {searchResult.inventoryBySubtype['Single Family Residence']}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-condo">
                    <Building2 className="w-3 h-3 mr-1" />
                    Condo: {searchResult.inventoryBySubtype['Condominium']}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-townhouse">
                    Townhouse: {searchResult.inventoryBySubtype['Townhouse']}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-multi">
                    Multi-Family: {searchResult.inventoryBySubtype['Multi-Family']}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-land">
                    <TreePine className="w-3 h-3 mr-1" />
                    Land/Ranch: {searchResult.inventoryBySubtype['Land/Ranch']}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-other">
                    <HelpCircle className="w-3 h-3 mr-1" />
                    Other: {searchResult.inventoryBySubtype['Other/Unknown']}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Tab order: Search Criteria → View Results → View Map */}
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search" data-testid="tab-search-criteria">
            Search Criteria
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-view-results">
            <List className="w-4 h-4 mr-2" />
            View Results
          </TabsTrigger>
          <TabsTrigger value="map" data-testid="tab-view-map">
            <MapIcon className="w-4 h-4 mr-2" />
            View Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <SearchCriteriaForm onSearch={handleSearch} initialCriteria={searchCriteria || {}} />
        </TabsContent>

        <TabsContent value="map">
          {!searchCriteria ? (
            <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">No search criteria</p>
                <p className="text-sm mb-4">Please search for properties first to view them on the map</p>
                <Button onClick={() => setActiveTab("search")} data-testid="button-goto-search-map">
                  Go to Search
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm">Loading properties...</p>
              </div>
            </div>
          ) : (
            <PropertyMapView
              properties={properties}
              onPropertyClick={handlePropertyClick}
              isLoading={isLoading}
            />
          )}
        </TabsContent>

        <TabsContent value="results">
          {!searchCriteria ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold mb-2">No search criteria</p>
              <p className="text-sm text-muted-foreground mb-4">
                Please use the Search Criteria tab to define your search
              </p>
              <Button onClick={() => setActiveTab("search")} data-testid="button-goto-search">
                Go to Search
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="aspect-[16/9] w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              <p className="text-lg font-semibold mb-2">Error loading properties</p>
              <p className="text-sm">Please try again or modify your search criteria</p>
            </div>
          ) : (
            <PropertyResults
              properties={properties}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onPropertyClick={handlePropertyClick}
              onAddToCart={handleAddToCart}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
