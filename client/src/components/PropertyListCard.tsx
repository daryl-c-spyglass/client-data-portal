import { Property } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Maximize, MapPin, Home, Calendar, DollarSign, ShoppingCart } from "lucide-react";
import { formatPropertyType } from "@/lib/property-type-utils";

interface PropertyListCardProps {
  property: Property;
  media?: { mediaURL: string; localPath?: string | null }[];
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
  onAddToCart?: () => void;
}

export function PropertyListCard({ 
  property, 
  media, 
  selected, 
  onSelect, 
  onClick,
  onAddToCart 
}: PropertyListCardProps) {
  const primaryImage = media?.[0]?.mediaURL || media?.[0]?.localPath;
  
  // Get status badge color
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

  // Calculate price per sqft
  const pricePerSqft = property.listPrice && property.livingArea 
    ? (Number(property.listPrice) / Number(property.livingArea)).toFixed(0)
    : null;

  return (
    <div 
      className="flex gap-4 p-4 bg-card rounded-md border hover-elevate active-elevate-2 cursor-pointer"
      data-testid={`card-property-${property.id}`}
    >
      {/* Checkbox */}
      <div className="flex items-start pt-1" onClick={(e) => e.stopPropagation()}>
        <Checkbox 
          checked={selected}
          onCheckedChange={onSelect}
          data-testid={`checkbox-select-${property.id}`}
        />
      </div>

      {/* Image */}
      <div 
        className="relative w-48 h-32 flex-shrink-0 rounded-md overflow-hidden bg-muted"
        onClick={onClick}
      >
        {primaryImage ? (
          <img 
            src={primaryImage} 
            alt={property.unparsedAddress || 'Property'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Status Badge */}
        {property.standardStatus && (
          <Badge 
            className={`absolute top-2 left-2 ${getStatusColor(property.standardStatus)}`}
            data-testid={`badge-status-${property.id}`}
          >
            {property.standardStatus}
          </Badge>
        )}
      </div>

      {/* Property Details */}
      <div className="flex-1 min-w-0 space-y-2" onClick={onClick}>
        {/* Price */}
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-2xl font-bold" data-testid={`text-price-${property.id}`}>
            ${Number(property.listPrice || 0).toLocaleString()}
          </h3>
          {pricePerSqft && (
            <span className="text-sm text-muted-foreground">
              ${pricePerSqft}/sqft
            </span>
          )}
        </div>

        {/* Key Stats */}
        <div className="flex items-center gap-4 text-sm">
          {property.bedroomsTotal !== null && (
            <div className="flex items-center gap-1.5" data-testid={`text-beds-${property.id}`}>
              <Bed className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{property.bedroomsTotal} beds</span>
            </div>
          )}
          {property.bathroomsTotalInteger !== null && (
            <div className="flex items-center gap-1.5" data-testid={`text-baths-${property.id}`}>
              <Bath className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{property.bathroomsTotalInteger} baths</span>
            </div>
          )}
          {property.livingArea && (
            <div className="flex items-center gap-1.5" data-testid={`text-sqft-${property.id}`}>
              <Maximize className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{Number(property.livingArea).toLocaleString()} sqft</span>
            </div>
          )}
        </div>

        {/* Address */}
        <p className="font-medium text-base line-clamp-1" data-testid={`text-address-${property.id}`}>
          {property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''}, ${property.city || ''}, ${property.stateOrProvince || ''} ${property.postalCode || ''}`.trim()}
        </p>

        {/* Location & Property Type */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {property.city && property.stateOrProvince && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{property.city}, {property.stateOrProvince}</span>
            </div>
          )}
          {property.propertySubType && (
            <div className="flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span>{formatPropertyType(property.propertySubType)}</span>
            </div>
          )}
          {property.yearBuilt && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Built {property.yearBuilt}</span>
            </div>
          )}
          {property.daysOnMarket !== null && (
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              <span>{property.daysOnMarket} days on market</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddToCart}
          data-testid={`button-add-to-cart-${property.id}`}
        >
          <ShoppingCart className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
