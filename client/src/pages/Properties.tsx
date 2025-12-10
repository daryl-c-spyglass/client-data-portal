import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Map as MapIcon, Search } from "lucide-react";
import { SearchCriteriaForm } from "@/components/SearchCriteria";
import { PropertyResults } from "@/components/PropertyResults";
import { PropertyMapView } from "@/components/PropertyMapView";
import { unifiedSearch } from "@/lib/api";
import { useSelectedProperty } from "@/contexts/SelectedPropertyContext";
import type { Property, Media, SearchCriteria } from "@shared/schema";

export default function Properties() {
  const [activeTab, setActiveTab] = useState("search");
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, navigate] = useLocation();
  const { setSelectedProperty } = useSelectedProperty();

  // Fetch total property count
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['/api/properties/count'],
  });
  const totalCount = countData?.count ?? 0;

  // Fetch properties with search criteria if available
  // Uses unified search API: Repliers for active, HomeReview/DB for closed
  const { data: properties = [], isLoading, error } = useQuery<Property[]>({
    queryKey: ['/api/search', searchCriteria],
    queryFn: () => unifiedSearch(searchCriteria!),
    enabled: (searchCriteria !== null),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const handleSearch = (criteria: SearchCriteria) => {
    setSearchCriteria(criteria);
    setActiveTab("results");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-properties-title">Properties</h1>
          <p className="text-muted-foreground">
            {totalCount > 0 
              ? `${totalCount.toLocaleString()} properties available in MLS Grid`
              : 'Search and browse MLS Grid listings'
            }
          </p>
        </div>
        {searchCriteria && (
          <Button onClick={() => setActiveTab("search")} data-testid="button-modify-search">
            <Search className="w-4 h-4 mr-2" />
            Modify Search
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search" data-testid="tab-search-criteria">
            Search Criteria
          </TabsTrigger>
          <TabsTrigger value="map" data-testid="tab-view-map">
            <MapIcon className="w-4 h-4 mr-2" />
            View Map
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-view-results">
            View Results
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
