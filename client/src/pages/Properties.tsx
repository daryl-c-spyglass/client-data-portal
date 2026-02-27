import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Map as MapIcon, Search, Globe, RotateCcw, List, Home, Building2, TreePine, Info, Save, Bookmark, Play, Trash2, Calendar, Filter, Loader2 } from "lucide-react";
import { SearchCriteriaForm } from "@/components/SearchCriteria";
import { PropertyResults } from "@/components/PropertyResults";
import { PropertyMapView } from "@/components/PropertyMapView";
import { StatusInspectorToggle } from "@/components/StatusInspector";
import { unifiedSearchWithMeta, type SearchResultWithMeta } from "@/lib/api";
import { useSelectedProperty } from "@/contexts/SelectedPropertyContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Property, Media, SearchCriteria, SavedSearch } from "@shared/schema";

// Inventory summary interface from backend
interface InventorySummary {
  dataSource: string;
  totalCount: number;
  countsByStatus: Record<string, number>;
  countsBySubtype: Record<string, number>;
  lastUpdatedAt: string;
}

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
      criteria.status = statusParam.split(',') as ('Active' | 'Active Under Contract' | 'Closed' | 'Pending')[];
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
    
    // Parse date range (full date range picker support)
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    if (dateFrom || dateTo) {
      criteria.dateRange = {
        from: dateFrom || undefined,
        to: dateTo || undefined,
      };
    }
    
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
  // Note: neighborhood filter removed per RESO compliance - use subdivision instead
  // Old neighborhood params are still parsed for backward compatibility but not serialized
  
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
  // Serialize date range (full date range picker support)
  if (criteria.dateRange?.from) {
    params.set('dateFrom', criteria.dateRange.from);
  }
  if (criteria.dateRange?.to) {
    params.set('dateTo', criteria.dateRange.to);
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
  const { toast } = useToast();
  
  // Parse criteria from URL - reactive to URL changes (browser back/forward, shared URLs)
  const urlCriteria = useMemo(() => parseCriteriaFromUrl(searchString), [searchString]);
  
  const [activeTab, setActiveTab] = useState(urlCriteria ? "results" : "search");
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(urlCriteria);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Save Search modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [searchName, setSearchName] = useState("");
  
  // Dev-only status inspector toggle
  const [statusInspectorEnabled, setStatusInspectorEnabled] = useState(false);
  
  // Sync searchCriteria with URL when URL changes (browser history navigation)
  // Also check for tab=results parameter to return to results view after property detail
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabParam = params.get('tab');
    
    if (urlCriteria) {
      setSearchCriteria(urlCriteria);
      // If tab=results is explicitly set (coming back from property detail), go to results
      // Otherwise default to results since we have criteria
      setActiveTab("results");
    } else if (tabParam === 'results') {
      // Coming back from property detail but no criteria - still go to results (will show empty state)
      setActiveTab("results");
    } else {
      setSearchCriteria(null);
      setActiveTab("search");
    }
    
    // Clean up the tab parameter from URL to prevent it persisting
    if (tabParam) {
      params.delete('tab');
      const newSearch = params.toString();
      const newUrl = newSearch ? `/properties?${newSearch}` : '/properties';
      navigate(newUrl, { replace: true });
    }
  }, [searchString]); // Re-run when URL changes
  
  // Fetch saved searches
  const { data: savedSearches = [], isLoading: savedSearchesLoading } = useQuery<SavedSearch[]>({
    queryKey: ['/api/searches'],
    staleTime: 30 * 1000,
  });
  
  // Save search mutation
  const saveSearchMutation = useMutation({
    mutationFn: async (data: { name: string; criteria: SearchCriteria }) => {
      return apiRequest('/api/searches', 'POST', {
        userId: 'default-user',
        name: data.name,
        criteria: data.criteria,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/searches'] });
      setShowSaveModal(false);
      setSearchName("");
      setShowSuccessModal(true);
      toast({
        title: "Search saved successfully",
        description: "Your search has been saved and can be accessed anytime.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save search",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Delete search mutation
  const deleteSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/searches/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/searches'] });
      toast({
        title: "Search deleted",
        description: "The saved search has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete search",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Check if criteria has any meaningful filters set
  const hasMeaningfulCriteria = (criteria: SearchCriteria | null): boolean => {
    if (!criteria) return false;
    return !!(
      (criteria.status?.length && criteria.status.length > 0) ||
      criteria.cities?.length ||
      criteria.subdivisions?.length ||
      criteria.neighborhood?.length ||
      criteria.zipCodes?.length ||
      criteria.elementarySchools?.length ||
      criteria.middleSchools?.length ||
      criteria.highSchools?.length ||
      criteria.listPriceMin ||
      criteria.listPriceMax ||
      criteria.bedroomsMin ||
      criteria.bedroomsMax ||
      criteria.fullBathsMin ||
      criteria.fullBathsMax ||
      criteria.livingArea?.min ||
      criteria.livingArea?.max ||
      criteria.yearBuilt?.min ||
      criteria.yearBuilt?.max ||
      criteria.lotSizeSquareFeet?.min ||
      criteria.lotSizeSquareFeet?.max ||
      criteria.propertySubType
    );
  };
  
  // Generate auto search name from criteria
  const generateSearchName = (criteria: SearchCriteria): string => {
    const parts: string[] = [];
    if (criteria.cities?.length) parts.push(criteria.cities.slice(0, 2).join(', '));
    if (criteria.subdivisions?.length) parts.push(criteria.subdivisions[0]);
    if (criteria.listPriceMin || criteria.listPriceMax) {
      const min = criteria.listPriceMin ? `$${(criteria.listPriceMin / 1000).toFixed(0)}k` : '';
      const max = criteria.listPriceMax ? `$${(criteria.listPriceMax / 1000).toFixed(0)}k` : '';
      parts.push(`${min}-${max}`.replace(/^-|-$/g, ''));
    }
    if (criteria.bedroomsMin) parts.push(`${criteria.bedroomsMin}+ beds`);
    return parts.length > 0 ? parts.join(' | ') : `Search ${new Date().toLocaleDateString()}`;
  };
  
  // Handle save search button click
  const handleSaveSearch = () => {
    if (!searchCriteria || !hasMeaningfulCriteria(searchCriteria)) {
      toast({
        title: "Cannot save empty search",
        description: "Please add at least one filter (city, price range, bedrooms, etc.) before saving.",
        variant: "destructive",
      });
      return;
    }
    setSearchName(generateSearchName(searchCriteria));
    setShowSaveModal(true);
  };
  
  // Confirm save search
  const confirmSaveSearch = () => {
    if (!searchCriteria || !searchName.trim()) return;
    saveSearchMutation.mutate({ name: searchName.trim(), criteria: searchCriteria });
  };
  
  // Run a saved search - executes immediately with fresh data
  const runSavedSearch = (savedSearch: SavedSearch) => {
    const criteria = savedSearch.criteria as SearchCriteria;
    const queryString = serializeCriteriaToUrl(criteria);
    
    // 1. Clear any previous selections
    setSelectedIds(new Set());
    
    // 2. Invalidate the query cache to force fresh data fetch
    queryClient.invalidateQueries({ queryKey: ['/api/search', queryString] });
    
    // 3. Apply the saved filters
    setSearchCriteria(criteria);
    
    // 4. Navigate to URL with filters and switch to results tab
    navigate(`/properties?${queryString}`, { replace: true });
    setActiveTab("results");
    
    // 5. Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Format criteria summary for display
  const formatCriteriaSummary = (criteria: SearchCriteria): string => {
    const parts: string[] = [];
    if (criteria.status?.length) parts.push(`Status: ${criteria.status.join(', ')}`);
    if (criteria.cities?.length) parts.push(`Cities: ${criteria.cities.join(', ')}`);
    if (criteria.subdivisions?.length) parts.push(`Subdivisions: ${criteria.subdivisions.join(', ')}`);
    if (criteria.listPriceMin) parts.push(`Min: $${criteria.listPriceMin.toLocaleString()}`);
    if (criteria.listPriceMax) parts.push(`Max: $${criteria.listPriceMax.toLocaleString()}`);
    if (criteria.bedroomsMin) parts.push(`${criteria.bedroomsMin}+ beds`);
    if (criteria.fullBathsMin) parts.push(`${criteria.fullBathsMin}+ baths`);
    return parts.length > 0 ? parts.join(' | ') : 'No filters specified';
  };


  // Fetch inventory summary for display before search
  // Uses canonical /api/inventory/summary endpoint (same source as Dashboard)
  const { data: inventory, isLoading: inventoryLoading } = useQuery<InventorySummary>({
    queryKey: ['/api/inventory/summary'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

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

  // Format timestamp for tooltip display
  const formatLastUpdated = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleSearch = (criteria: SearchCriteria) => {
    setSearchCriteria(criteria);
    // Update URL with search criteria for persistence
    const queryString = serializeCriteriaToUrl(criteria);
    navigate(`/properties?${queryString}`, { replace: true });
    setActiveTab("results");
  };
  
  const handleReset = () => {
    setSearchCriteria(null);
    clearSelection(); // Clear selection when resetting search
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

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handlePropertyClick = (property: Property) => {
    // Clear selection when navigating to property detail to prevent sticky selections
    clearSelection();
    // Set the selected property in context before navigation
    setSelectedProperty({
      property,
      media: convertPhotosToMedia(property),
    });
    // Store the current URL with query params so "Back to Search" returns to results view
    // Add tab=results to ensure we return to the results tab, not search criteria
    const currentUrl = window.location.pathname + window.location.search;
    const returnUrl = currentUrl.includes('?') 
      ? `${currentUrl}&tab=results` 
      : `${currentUrl}?tab=results`;
    navigate(`/properties/${property.id}?from=${encodeURIComponent(returnUrl)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold" data-testid="text-properties-title">Properties</h1>
            {/* Info Icon with Hover Tooltip */}
            {(inventory || searchResult) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="text-muted-foreground hover:text-foreground transition-colors p-1" 
                    data-testid="button-info-tooltip"
                    aria-label="Data source information"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      Data Source: {searchResult?.dataSource || inventory?.dataSource || 'MLS'}
                    </p>
                    <p className="text-muted-foreground">
                      Property data sourced from MLS via Repliers API
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated every 5-15 minutes
                    </p>
                    {inventory?.lastUpdatedAt && (
                      <p className="text-muted-foreground">
                        Last updated: {formatLastUpdated(inventory.lastUpdatedAt)}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {/* Dynamic Inventory Summary */}
          {searchResult ? (
            <p className="text-muted-foreground" data-testid="text-search-summary">
              {searchResult.count.toLocaleString()} matching properties from {searchResult.dataSource}
            </p>
          ) : inventoryLoading ? (
            <Skeleton className="h-5 w-64" />
          ) : inventory ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground" data-testid="text-total-inventory">
                  {inventory.totalCount.toLocaleString()} properties in {inventory.dataSource}
                </span>
                <span className="text-muted-foreground">•</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs" data-testid="badge-inventory-active">
                  Active: {(inventory.countsByStatus['Active'] || 0).toLocaleString()}
                </Badge>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs" data-testid="badge-inventory-uc">
                  AUC: {(inventory.countsByStatus['Active Under Contract'] || 0).toLocaleString()}
                </Badge>
                <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs" data-testid="badge-inventory-closed">
                  Closed: {(inventory.countsByStatus['Closed'] || 0).toLocaleString()}
                </Badge>
              </div>
              {/* Subtype counts - show all required categories with acronym tooltip */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Property Types:</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 cursor-help" data-testid="button-acronym-info">
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1 text-xs">
                      <p><strong>Property Type Definitions:</strong></p>
                      <p><strong>SFR</strong> = Single Family Residence</p>
                      <p><strong>Condo</strong> = Condominium</p>
                      <p><strong>TH</strong> = Townhouse</p>
                      <p><strong>Multi</strong> = Multi-Family (2-4 units)</p>
                      <p><strong>Mfg</strong> = Manufactured / Mobile Home</p>
                      <p><strong>Ranch</strong> = Ranch / Farm / Acreage</p>
                      <p><strong>Land</strong> = Unimproved Land / Lots</p>
                      <p><strong>Lots</strong> = Multiple Lots (Adjacent)</p>
                      <p><strong>Other</strong> = Commercial / Industrial</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
                {inventory.countsBySubtype ? (
                  <>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-sfr">
                      <Home className="w-3 h-3 mr-1" />
                      SFR: {(inventory.countsBySubtype['Single Family Residence'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-condo">
                      <Building2 className="w-3 h-3 mr-1" />
                      Condo: {(inventory.countsBySubtype['Condominium'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-townhouse">
                      TH: {(inventory.countsBySubtype['Townhouse'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-multi">
                      Multi: {(inventory.countsBySubtype['Multi-Family'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-mfg">
                      Mfg: {(inventory.countsBySubtype['Manufactured Home'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-ranch">
                      <TreePine className="w-3 h-3 mr-1" />
                      Ranch: {(inventory.countsBySubtype['Ranch'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-land">
                      Land: {(inventory.countsBySubtype['Unimproved Land'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-lots">
                      Lots: {(inventory.countsBySubtype['Multiple Lots (Adjacent)'] || 0).toLocaleString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs" data-testid="badge-inventory-other">
                      Other: {(inventory.countsBySubtype['Other'] || 0).toLocaleString()}
                    </Badge>
                  </>
                ) : (
                  <span className="italic">Loading property types...</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Search and browse property listings</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {searchCriteria && (
            <>
              <Button 
                variant="default" 
                onClick={handleSaveSearch}
                disabled={saveSearchMutation.isPending || !hasMeaningfulCriteria(searchCriteria)}
                data-testid="button-save-search"
                title={!hasMeaningfulCriteria(searchCriteria) ? "Add at least one filter to save this search" : undefined}
              >
                {saveSearchMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Search
              </Button>
              <Button variant="outline" onClick={handleReset} data-testid="button-reset-search">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button variant="outline" onClick={() => { clearSelection(); setActiveTab("search"); }} data-testid="button-modify-search">
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
                <Globe className="w-4 h-4 text-muted-foreground" />
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
                    Active Under Contract: {searchResult.inventoryByStatus['Active Under Contract']}
                  </Badge>
                  <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" data-testid="badge-status-closed">
                    Closed: {searchResult.inventoryByStatus['Closed']}
                  </Badge>
                </div>
              </div>
              
              {/* Inventory by Subtype */}
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Property Type</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 cursor-help" data-testid="button-acronym-info-results">
                        <Info className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1 text-xs">
                        <p><strong>Property Type Definitions:</strong></p>
                        <p><strong>SFR</strong> = Single Family Residence</p>
                        <p><strong>Condo</strong> = Condominium</p>
                        <p><strong>TH</strong> = Townhouse</p>
                        <p><strong>Multi</strong> = Multi-Family (2-4 units)</p>
                        <p><strong>Mfg</strong> = Manufactured / Mobile Home</p>
                        <p><strong>Ranch</strong> = Ranch / Farm / Acreage</p>
                        <p><strong>Land</strong> = Unimproved Land / Lots</p>
                        <p><strong>Lots</strong> = Multiple Lots (Adjacent)</p>
                        <p><strong>Other</strong> = Commercial / Industrial</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" data-testid="badge-subtype-sfr">
                    <Home className="w-3 h-3 mr-1" />
                    SFR: {searchResult.inventoryBySubtype?.['Single Family Residence'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-condo">
                    <Building2 className="w-3 h-3 mr-1" />
                    Condo: {searchResult.inventoryBySubtype?.['Condominium'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-townhouse">
                    TH: {searchResult.inventoryBySubtype?.['Townhouse'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-multi">
                    Multi: {searchResult.inventoryBySubtype?.['Multi-Family'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-mfg">
                    Mfg: {searchResult.inventoryBySubtype?.['Manufactured Home'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-ranch">
                    <TreePine className="w-3 h-3 mr-1" />
                    Ranch: {searchResult.inventoryBySubtype?.['Ranch'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-land">
                    Land: {searchResult.inventoryBySubtype?.['Unimproved Land'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-lots">
                    Lots: {searchResult.inventoryBySubtype?.['Multiple Lots (Adjacent)'] || 0}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-subtype-other">
                    Other: {searchResult.inventoryBySubtype?.['Other'] || 0}
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
          <SearchCriteriaForm 
            onSearch={handleSearch} 
            initialCriteria={searchCriteria || {}} 
          />
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
            <div className="space-y-4">
              {import.meta.env.DEV && (
                <StatusInspectorToggle 
                  enabled={statusInspectorEnabled} 
                  onToggle={setStatusInspectorEnabled}
                />
              )}
              <PropertyResults
                properties={properties}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                onPropertyClick={handlePropertyClick}
                statusInspectorEnabled={statusInspectorEnabled}
                criteriaKey={criteriaKey}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Saved Searches Section */}
      {savedSearches.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5" />
              Saved Searches
            </CardTitle>
            <CardDescription>
              Your saved buyer search criteria. Click "Run Search" to load the filters and view results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savedSearches
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((savedSearch) => (
                  <div 
                    key={savedSearch.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`saved-search-${savedSearch.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate" data-testid={`text-search-name-${savedSearch.id}`}>
                          {savedSearch.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          {formatCriteriaSummary(savedSearch.criteria as SearchCriteria)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(savedSearch.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => runSavedSearch(savedSearch)}
                        data-testid={`button-run-search-${savedSearch.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Run Search
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteSearchMutation.mutate(savedSearch.id)}
                        disabled={deleteSearchMutation.isPending}
                        data-testid={`button-delete-search-${savedSearch.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Search Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
            <DialogDescription>
              Give your search a name so you can easily find and run it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Search Name</Label>
              <Input
                id="search-name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="e.g., Austin 3+ beds under $500k"
                data-testid="input-search-name"
              />
            </div>
            {searchCriteria && (
              <div className="space-y-2">
                <Label>Search Filters</Label>
                <p className="text-sm text-muted-foreground">
                  {formatCriteriaSummary(searchCriteria)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmSaveSearch}
              disabled={!searchName.trim() || saveSearchMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveSearchMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Search"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-green-500" />
              Search Saved Successfully
            </DialogTitle>
            <DialogDescription>
              Your search has been saved. What would you like to do next?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSuccessModal(false)}
              className="w-full sm:w-auto"
              data-testid="button-continue-browsing"
            >
              Continue Browsing
            </Button>
            <Button 
              onClick={() => {
                setShowSuccessModal(false);
                // Scroll to saved searches section
                document.querySelector('[data-testid^="saved-search-"]')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto"
              data-testid="button-view-saved-searches"
            >
              <Bookmark className="w-4 h-4 mr-2" />
              View Saved Searches
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
