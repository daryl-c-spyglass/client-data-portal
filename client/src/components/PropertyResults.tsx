import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3x3, List, Table as TableIcon } from "lucide-react";
import { PropertyCard } from "./PropertyCard";
import type { Property, Media } from "@shared/schema";

interface PropertyResultsProps {
  properties: Property[];
  mediaMap: Map<string, Media[]>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onPropertyClick: (property: Property) => void;
  onAddToCart: (property: Property) => void;
}

export function PropertyResults({ 
  properties, 
  mediaMap, 
  selectedIds, 
  onToggleSelect, 
  onSelectAll,
  onPropertyClick,
  onAddToCart 
}: PropertyResultsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [sortBy, setSortBy] = useState('status');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'under-contract' | 'closed'>('all');

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
        // Sort by status: Active -> Pending -> Under Contract -> Closed
        const statusOrder = { 'Active': 0, 'Pending': 1, 'Under Contract': 2, 'Closed': 3 };
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
    underContract: sortedProperties.filter(p => p.standardStatus === 'Under Contract'),
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
                {statusGroups.underContract.length} Under Contract
              </TabsTrigger>
              <TabsTrigger value="closed" data-testid="tab-closed">
                {statusGroups.closed.length} Closed (Sold)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
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
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[200px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Active - Pending - Closed</SelectItem>
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
          {filteredProperties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              media={mediaMap.get(property.listingId)}
              selected={selectedIds.has(property.id)}
              onSelect={(selected) => onToggleSelect(property.id)}
              onAddToCart={() => onAddToCart(property)}
              onClick={() => onPropertyClick(property)}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {filteredProperties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              media={mediaMap.get(property.listingId)}
              selected={selectedIds.has(property.id)}
              onSelect={(selected) => onToggleSelect(property.id)}
              onAddToCart={() => onAddToCart(property)}
              onClick={() => onPropertyClick(property)}
            />
          ))}
        </div>
      )}

      {/* Table View - placeholder for now */}
      {viewMode === 'table' && (
        <div className="text-center py-12 text-muted-foreground">
          Table view - Coming soon
        </div>
      )}

      {/* Empty State */}
      {filteredProperties.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No properties found</h3>
          <p className="text-muted-foreground">
            {statusFilter !== 'all' 
              ? `No ${statusFilter === 'under-contract' ? 'Under Contract' : statusFilter === 'pending' ? 'Pending' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} properties. Try a different filter.`
              : 'Try adjusting your search criteria to see more results'
            }
          </p>
        </div>
      )}
    </div>
  );
}
