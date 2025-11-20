import { Property } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, ExternalLink } from "lucide-react";

interface PropertyTableProps {
  properties: Property[];
  selectedIds: Set<string>;
  sortBy: string;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onPropertyClick: (property: Property) => void;
  onAddToCart: (property: Property) => void;
}

export function PropertyTable({
  properties,
  selectedIds,
  sortBy,
  onToggleSelect,
  onSelectAll,
  onPropertyClick,
  onAddToCart,
}: PropertyTableProps) {
  // Map parent's sortBy to column sorting
  const getSortInfo = () => {
    switch (sortBy) {
      case 'price-asc':
        return { column: 'price', direction: 'asc' as const };
      case 'price-desc':
        return { column: 'price', direction: 'desc' as const };
      case 'date-new':
        return { column: 'date', direction: 'desc' as const };
      case 'date-old':
        return { column: 'date', direction: 'asc' as const };
      case 'status':
        return { column: 'status', direction: 'asc' as const };
      default:
        return { column: null, direction: null };
    }
  };

  const { column: activeColumn, direction: activeDirection } = getSortInfo();

  const getSortIcon = (column: string) => {
    if (activeColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    }
    if (activeDirection === 'asc') {
      return <ArrowUp className="w-4 h-4 ml-1" />;
    }
    if (activeDirection === 'desc') {
      return <ArrowDown className="w-4 h-4 ml-1" />;
    }
    return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'Pending':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'Under Contract':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'Closed':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const allSelected = properties.length > 0 && properties.every(p => selectedIds.has(p.id));
  const someSelected = properties.some(p => selectedIds.has(p.id)) && !allSelected;

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={onSelectAll}
                data-testid="checkbox-select-all"
              />
            </TableHead>
            <TableHead>
              <span className="font-medium">Address</span>
            </TableHead>
            <TableHead>
              <span className="font-medium flex items-center">
                Price
                {getSortIcon('price')}
              </span>
            </TableHead>
            <TableHead className="text-center">
              <span className="font-medium">Beds</span>
            </TableHead>
            <TableHead className="text-center">
              <span className="font-medium">Baths</span>
            </TableHead>
            <TableHead className="text-right">
              <span className="font-medium">Sq Ft</span>
            </TableHead>
            <TableHead>
              <span className="font-medium flex items-center">
                Status
                {getSortIcon('status')}
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="font-medium">Days</span>
            </TableHead>
            <TableHead className="w-24 text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                No properties found
              </TableCell>
            </TableRow>
          ) : (
            properties.map((property) => (
              <TableRow
                key={property.id}
                className="hover-elevate cursor-pointer"
                onClick={() => onPropertyClick(property)}
                data-testid={`row-property-${property.id}`}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(property.id)}
                    onCheckedChange={() => onToggleSelect(property.id)}
                    data-testid={`checkbox-select-${property.id}`}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-xs">
                  <div className="truncate" data-testid={`text-address-${property.id}`}>
                    {property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''}`.trim()}
                  </div>
                  {property.city && property.stateOrProvince && (
                    <div className="text-xs text-muted-foreground truncate">
                      {property.city}, {property.stateOrProvince}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-semibold" data-testid={`text-price-${property.id}`}>
                  ${Number(property.listPrice || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-center" data-testid={`text-beds-${property.id}`}>
                  {property.bedroomsTotal !== null ? property.bedroomsTotal : '-'}
                </TableCell>
                <TableCell className="text-center" data-testid={`text-baths-${property.id}`}>
                  {property.bathroomsTotalInteger !== null ? property.bathroomsTotalInteger : '-'}
                </TableCell>
                <TableCell className="text-right" data-testid={`text-sqft-${property.id}`}>
                  {property.livingArea ? Number(property.livingArea).toLocaleString() : '-'}
                </TableCell>
                <TableCell>
                  {property.standardStatus && (
                    <Badge
                      className={getStatusColor(property.standardStatus)}
                      data-testid={`badge-status-${property.id}`}
                    >
                      {property.standardStatus}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right" data-testid={`text-dom-${property.id}`}>
                  {property.daysOnMarket !== null ? property.daysOnMarket : '-'}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAddToCart(property)}
                      data-testid={`button-add-to-cart-${property.id}`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onPropertyClick(property)}
                      data-testid={`button-view-${property.id}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
