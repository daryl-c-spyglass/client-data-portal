import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Bed, Bath, Maximize, MapPin, Calendar, TrendingUp, Home } from "lucide-react";
import type { Property, Media } from "@shared/schema";
import { formatPropertyType } from "@/lib/property-type-utils";
import { StatusInspector } from "./StatusInspector";

interface PropertyCardProps {
  property: Property;
  media?: Media[];
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onAddToCart?: () => void;
  onClick?: () => void;
  statusInspectorEnabled?: boolean;
}

const statusConfig = {
  Active: { color: "bg-emerald-500", textColor: "text-white" },
  "Active Under Contract": { color: "bg-amber-500", textColor: "text-white" },
  Closed: { color: "bg-slate-500", textColor: "text-white" },
  Pending: { color: "bg-blue-500", textColor: "text-white" },
} as const;

export function PropertyCard({ 
  property, 
  media, 
  selected, 
  onSelect, 
  onAddToCart,
  onClick,
  statusInspectorEnabled = false
}: PropertyCardProps) {
  const primaryImage = media?.[0]?.mediaURL || media?.[0]?.localPath;
  const formattedPrice = property.listPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(property.listPrice))
    : 'Price upon request';

  return (
    <Card className="overflow-hidden group hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-property-${property.id}`}>
      {/* Image Container with Overlay */}
      <div className="relative aspect-[16/9] bg-muted" onClick={onClick}>
        {primaryImage ? (
          <img 
            src={primaryImage} 
            alt={property.unparsedAddress || ''} 
            className="w-full h-full object-cover"
            data-testid={`img-property-${property.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Maximize className="w-12 h-12" />
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Price on Image */}
        <div className="absolute top-4 left-4">
          <div className="text-white font-semibold text-xl px-3 py-1 bg-black/40 backdrop-blur-sm rounded-md">
            {formattedPrice}
          </div>
        </div>
        
        {/* Status Badge */}
        {property.standardStatus && (
          <div className="absolute top-4 right-4">
            <Badge 
              className={`${(statusConfig[property.standardStatus as keyof typeof statusConfig]?.color || 'bg-slate-500')} ${(statusConfig[property.standardStatus as keyof typeof statusConfig]?.textColor || 'text-white')}`}
              data-testid={`badge-status-${property.id}`}
            >
              {property.standardStatus}
            </Badge>
          </div>
        )}
        
        {/* Selection Checkbox & Cart */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          {onSelect && (
            <div className="bg-white rounded-md p-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox 
                checked={selected} 
                onCheckedChange={onSelect}
                data-testid={`checkbox-select-${property.id}`}
              />
            </div>
          )}
          {onAddToCart && (
            <Button 
              size="icon" 
              variant="secondary" 
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart();
              }}
              data-testid={`button-cart-${property.id}`}
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Property Details */}
      <div className="p-4 space-y-3" onClick={onClick}>
        {/* Key Stats Row */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          {property.bedroomsTotal !== null && (
            <div className="flex items-center gap-1.5" data-testid={`text-beds-${property.id}`}>
              <Bed className="w-4 h-4" />
              <span className="font-medium">{property.bedroomsTotal}</span>
            </div>
          )}
          {property.bathroomsTotalInteger !== null && (
            <div className="flex items-center gap-1.5" data-testid={`text-baths-${property.id}`}>
              <Bath className="w-4 h-4" />
              <span className="font-medium">{property.bathroomsTotalInteger}</span>
            </div>
          )}
          {property.livingArea && (
            <div className="flex items-center gap-1.5" data-testid={`text-sqft-${property.id}`}>
              <Maximize className="w-4 h-4" />
              <span className="font-medium">{Number(property.livingArea).toLocaleString()} sqft</span>
            </div>
          )}
        </div>
        
        {/* Address */}
        <h3 className="font-semibold text-base line-clamp-2 leading-tight" data-testid={`text-address-${property.id}`}>
          {property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''}, ${property.city || ''}, ${property.stateOrProvince || ''} ${property.postalCode || ''}`.trim()}
        </h3>
        
        {/* Location & Property Type */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {property.city && property.stateOrProvince && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{property.city}, {property.stateOrProvince}</span>
            </div>
          )}
          {property.propertySubType && (
            <div className="flex items-center gap-1">
              <Home className="w-3 h-3" />
              <span className="line-clamp-1">{formatPropertyType(property.propertySubType)}</span>
            </div>
          )}
        </div>
        
        {/* Additional Metrics */}
        <div className="flex items-center justify-between gap-2 text-xs">
          {property.daysOnMarket !== null && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{property.daysOnMarket} days on market</span>
            </div>
          )}
          {property.livingArea && property.listPrice && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span className="font-medium">
                ${Math.round(Number(property.listPrice) / Number(property.livingArea)).toLocaleString()}/sqft
              </span>
            </div>
          )}
        </div>
        
        {/* Year Built */}
        {property.yearBuilt && (
          <div className="text-xs text-muted-foreground">
            Built in {property.yearBuilt}
          </div>
        )}
        
        {/* Dev-only Status Inspector */}
        {statusInspectorEnabled && (
          <StatusInspector 
            property={{
              id: property.id,
              listingId: property.listingId,
              standardStatus: property.standardStatus || undefined,
              status: (property as any).status || undefined,
              lastStatus: (property as any).lastStatus || undefined,
              raw: (property as any).raw || undefined,
            }}
          />
        )}
      </div>
    </Card>
  );
}
