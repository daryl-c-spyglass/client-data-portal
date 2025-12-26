import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3x3, List, Table as TableIcon } from "lucide-react";
import { PropertyCard } from "./PropertyCard";
import { PropertyListCard } from "./PropertyListCard";
import { PropertyTable } from "./PropertyTable";
import type { Property, Media } from "@shared/schema";

// Helper function to convert property.photos array to Media[] format
function convertPhotosToMedia(property: Property): Media[] {
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
}

interface PropertyResultsProps {
  properties: Property[];
  mediaMap?: Map<string, Media[]>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPropertyClick: (property: Property) => void;
  statusInspectorEnabled?: boolean;
  criteriaKey?: string;
}

export function PropertyResults({ 
  properties, 
  mediaMap, 
  selectedIds, 
  onToggleSelect, 
  onSelectAll,
  onClearSelection,
  onPropertyClick,
  statusInspectorEnabled = false,
  criteriaKey = ''
}: PropertyResultsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [sortBy, setSortBy] = useState('status');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'under-contract' | 'closed'>('all');
  const [displayCount, setDisplayCount] = useState(20);
  
  const ITEMS_PER_PAGE = 20;
  
  // Reset pagination to page 1 when search criteria changes (e.g., Run Search)
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [criteriaKey]);

  // Sort properties based on selected sort option
  const sortedProperties = [...properties].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return (Number(a.listPrice) || 0) - (Number(b.listPrice) || 0);
      case 'price-desc':
        return (Number(b.listPrice) || 0) - (Number(a.listPrice) || 0);
      case 'date-new':
        return new Date(b.modificationTimestamp).getTime() - new Date(a.modificationTimestamp).getTime();
      case 'date-old':
        return new Date(a.modificationTimestamp).getTime() - new Date(b.modificationTimestamp).getTime();
      case 'status':
      default:
        // Sort by status: Active -> Pending -> Active Under Contract -> Closed
        const statusOrder = { 'Active': 0, 'Pending': 1, 'Active Under Contract': 2, 'Closed': 3 };
        const aOrder = statusOrder[a.standardStatus as keyof typeof statusOrder] ?? 99;
        const bOrder = statusOrder[b.standardStatus as keyof typeof statusOrder] ?? 99;
        return aOrder - bOrder;
    }
  });

  // Group properties by status
  const statusGroups = {
    all: sortedProperties,
    active: sortedProperties.filter(p => p.standardStatus === 'Active'),
    pending: sortedProperties.filter(p => p.standardStatus === 'Pending'),
    underContract: sortedProperties.filter(p => p.standardStatus === 'Active Under Contract'),
    closed: sortedProperties.filter(p => p.standardStatus === 'Closed'),
  };
  
  // Get current filtered properties
  const filteredProperties = statusFilter === 'all' 
    ? statusGroups.all
    : statusFilter === 'active'
    ? statusGroups.active
    : statusFilter === 'pending'
    ? statusGroups.pending
    : statusFilter === 'under-contract'
    ? statusGroups.underContract
    : statusGroups.closed;
  
  // Paginate the filtered properties
  const displayedProperties = filteredProperties.slice(0, displayCount);
  const hasMore = filteredProperties.length > displayCount;
  
  // Load more handler
  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredProperties.length));
  };
  
  // Reset pagination when filters, sort, or properties array changes
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [statusFilter, sortBy, properties]);
  
  // Clamp display count if it exceeds filtered properties
  useEffect(() => {
    if (displayCount > filteredProperties.length && filteredProperties.length > 0) {
      setDisplayCount(filteredProperties.length);
    }
  }, [displayCount, filteredProperties.length]);

  return (
    <div className="space-y-4">
      {/* Header with counts and controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-muted/50 rounded-md">
        <div className="flex items-center gap-4">
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)} className="w-auto">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">
                {statusGroups.all.length} All
              </TabsTrigger>
              <TabsTrigger value="active" data-testid="tab-active">
                {statusGroups.active.length} Active
              </TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">
                {statusGroups.pending.length} Pending
              </TabsTrigger>
              <TabsTrigger value="under-contract" data-testid="tab-under-contract">
                {statusGroups.underContract.length} AUC
              </TabsTrigger>
              <TabsTrigger value="closed" data-testid="tab-closed">
                {statusGroups.closed.length} Closed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm text-muted-foreground" data-testid="text-results-count">
            Showing {displayedProperties.length} of {filteredProperties.length}
          </span>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onSelectAll}
              data-testid="button-select-all"
            >
              Select All
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} Selected
            </span>
            {selectedIds.size > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onClearSelection}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            )}
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Active - AUC - Pending - Closed</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="date-new">Newest First</SelectItem>
              <SelectItem value="date-old">Oldest First</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 border rounded-md">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              data-testid="button-view-grid"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('table')}
              data-testid="button-view-table"
            >
              <TableIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedProperties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              media={mediaMap?.get(property.listingId) || convertPhotosToMedia(property)}
              selected={selectedIds.has(property.id)}
              onSelect={() => onToggleSelect(property.id)}
              onClick={() => onPropertyClick(property)}
              statusInspectorEnabled={statusInspectorEnabled}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {displayedProperties.map(property => (
            <PropertyListCard
              key={property.id}
              property={property}
              media={mediaMap?.get(property.listingId) || convertPhotosToMedia(property)}
              selected={selectedIds.has(property.id)}
              onSelect={() => onToggleSelect(property.id)}
              onClick={() => onPropertyClick(property)}
            />
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <PropertyTable
          properties={displayedProperties}
          selectedIds={selectedIds}
          sortBy={sortBy}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          onPropertyClick={onPropertyClick}
        />
      )}
      
      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center py-6">
          <Button
            variant="outline"
            onClick={loadMore}
            data-testid="button-load-more"
          >
            Load More ({filteredProperties.length - displayCount} remaining)
          </Button>
        </div>
      )}

      {/* Empty State */}
      {filteredProperties.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No properties found</h3>
          <p className="text-muted-foreground">
            {statusFilter !== 'all' 
              ? `No ${statusFilter === 'under-contract' ? 'Active Under Contract' : statusFilter === 'pending' ? 'Pending' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} properties. Try a different filter.`
              : 'Try adjusting your search criteria to see more results'
            }
          </p>
        </div>
      )}
    </div>
  );
}
