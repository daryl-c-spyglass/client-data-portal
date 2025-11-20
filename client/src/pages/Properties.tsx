import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Map as MapIcon, Search } from "lucide-react";
import { SearchCriteriaForm } from "@/components/SearchCriteria";
import { PropertyResults } from "@/components/PropertyResults";
import { searchProperties } from "@/lib/api";
import type { Property, Media, SearchCriteria } from "@shared/schema";

export default function Properties() {
  const [activeTab, setActiveTab] = useState("search");
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch properties with search criteria if available, otherwise fetch all
  const { data: properties = [], isLoading, error } = useQuery<Property[]>({
    queryKey: ['/api/properties', 'search', searchCriteria],
    queryFn: () => searchCriteria ? searchProperties(searchCriteria) : fetch('/api/properties').then(r => r.json()),
  });

  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    queryFn: async () => {
      const response = await fetch('/api/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
  });

  // Mock media map - will be populated with real data in production
  const [mediaMap] = useState<Map<string, Media[]>>(new Map());

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

  const handlePropertyClick = (property: Property) => {
    window.location.href = `/properties/${property.id}`;
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
            {allProperties.length > 0 
              ? `${allProperties.length} properties available in MLS Grid`
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
          <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MapIcon className="w-12 h-12 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">Interactive Map View</p>
              <p className="text-sm">Map integration coming soon with property markers and drawing tools</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results">
          {isLoading ? (
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
              mediaMap={mediaMap}
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
