import { useMemo, useState, useRef, useEffect } from "react";
import { MapboxMap, type MapMarker } from "@/components/shared/MapboxMap";
import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Bed, Bath, Ruler, ExternalLink, AlertTriangle, Calendar, ImageOff } from "lucide-react";
import type { Property } from "@shared/schema";

interface PropertyMapViewProps {
  properties: Property[];
  onPropertyClick?: (property: Property) => void;
  isLoading?: boolean;
}

const defaultCenter: [number, number] = [-97.7431, 30.2672];
const defaultZoom = 10;

function PropertyPopup({ property, onPropertyClick }: { property: Property; onPropertyClick?: (property: Property) => void }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get photos from property
  const photos = (property as any).photos as string[] | undefined;
  const hasPhotos = photos && photos.length > 0;
  
  // Auto-rotate images every 3 seconds
  useEffect(() => {
    if (hasPhotos && photos.length > 1) {
      autoPlayRef.current = setInterval(() => {
        setCurrentImageIndex(prev => (prev + 1) % photos.length);
      }, 3000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [hasPhotos, photos?.length]);
  
  // Handle click on left/right zones for manual navigation
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasPhotos || photos.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    // Reset auto-play timer on manual interaction
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = setInterval(() => {
        setCurrentImageIndex(prev => (prev + 1) % photos.length);
      }, 3000);
    }
    
    if (clickX < width / 2) {
      // Left side - go backward
      setCurrentImageIndex(prev => (prev - 1 + photos.length) % photos.length);
    } else {
      // Right side - go forward
      setCurrentImageIndex(prev => (prev + 1) % photos.length);
    }
  };
  
  const price = property.listPrice || property.closePrice;
  const formattedPrice = price 
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(price))
    : "Price N/A";

  const statusColor = property.standardStatus === "Active" 
    ? "bg-green-500" 
    : property.standardStatus === "Active Under Contract" || property.standardStatus === "Pending"
    ? "bg-amber-500"
    : "bg-gray-500";

  return (
    <div className="w-[320px]" data-testid={`popup-property-${property.id}`}>
      {/* Image Carousel */}
      <div 
        className="relative aspect-[16/10] bg-muted cursor-pointer overflow-hidden rounded-t-md"
        onClick={handleImageClick}
      >
        {hasPhotos ? (
          <>
            <img 
              src={photos[currentImageIndex]} 
              alt={`Property ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Image counter */}
            {photos.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {currentImageIndex + 1} / {photos.length}
              </div>
            )}
            {/* Click zone indicators (subtle) */}
            {photos.length > 1 && (
              <>
                <div className="absolute inset-y-0 left-0 w-1/2 hover:bg-black/5 transition-colors" />
                <div className="absolute inset-y-0 right-0 w-1/2 hover:bg-black/5 transition-colors" />
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <ImageOff className="w-10 h-10 mb-2" />
            <span className="text-sm">No photos available</span>
          </div>
        )}
      </div>
      
      {/* Property Details */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-bold text-lg text-foreground">{formattedPrice}</span>
          <Badge className={`${statusColor} text-white text-xs`}>
            {property.standardStatus || "Unknown"}
          </Badge>
        </div>
        
        <p className="text-sm font-medium mb-1" data-testid={`text-address-${property.id}`}>
          {property.unparsedAddress || `${property.streetNumber} ${property.streetName}`}
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          {property.city}{property.stateOrProvince && `, ${property.stateOrProvince}`} {property.postalCode}
        </p>
        
        {/* Subdivision (tract/community label from listing) */}
        {/* Note: Neighborhood is only available via boundary resolution on Property Detail page */}
        {property.subdivision && (
          <p className="text-xs text-muted-foreground mb-2">
            Subdivision: {property.subdivision}
          </p>
        )}
        
        {/* Property Stats */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 flex-wrap">
          {property.bedroomsTotal != null && (
            <span className="flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {property.bedroomsTotal} beds
            </span>
          )}
          {property.bathroomsTotalInteger != null && (
            <span className="flex items-center gap-1">
              <Bath className="w-3 h-3" />
              {property.bathroomsTotalInteger} baths
            </span>
          )}
          {property.livingArea && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3 h-3" />
              {Number(property.livingArea).toLocaleString()} sqft
            </span>
          )}
          {property.yearBuilt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {property.yearBuilt}
            </span>
          )}
        </div>
        
        {/* MLS # */}
        {property.listingId && (
          <p className="text-xs text-muted-foreground mb-3">
            MLS #: {property.listingId}
          </p>
        )}
        
        {onPropertyClick && (
          <Button 
            size="sm" 
            className="w-full"
            onClick={() => onPropertyClick(property)}
            data-testid={`button-view-property-${property.listingId || property.id}`}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View Details
          </Button>
        )}
      </div>
    </div>
  );
}

export function PropertyMapView({ properties, onPropertyClick, isLoading }: PropertyMapViewProps) {
  const { theme } = useTheme();
  const propertiesWithCoords = useMemo(() => 
    properties.filter(p => p.latitude != null && p.longitude != null),
    [properties]
  );

  const propertiesWithoutCoords = useMemo(() => 
    properties.filter(p => p.latitude == null || p.longitude == null),
    [properties]
  );

  const mapMarkers: MapMarker[] = useMemo(() => 
    propertiesWithCoords.map(property => ({
      id: String(property.listingId || property.id),
      latitude: Number(property.latitude),
      longitude: Number(property.longitude),
      price: Number(property.listPrice) || Number(property.closePrice) || 0,
      label: property.unparsedAddress || '',
      status: (property.standardStatus as MapMarker['status']) || 'Active',
      beds: property.bedroomsTotal ?? undefined,
      baths: property.bathroomsTotalInteger ?? undefined,
      sqft: property.livingArea ? Number(property.livingArea) : undefined,
      yearBuilt: property.yearBuilt ?? undefined,
      mlsNumber: property.listingId || undefined,
      photos: (property as any).photos || [],
    })),
    [propertiesWithCoords]
  );

  const mapCenter: [number, number] | undefined = useMemo(() => {
    if (propertiesWithCoords.length === 0) return undefined;
    const sumLng = propertiesWithCoords.reduce((sum, p) => sum + Number(p.longitude), 0);
    const sumLat = propertiesWithCoords.reduce((sum, p) => sum + Number(p.latitude), 0);
    return [sumLng / propertiesWithCoords.length, sumLat / propertiesWithCoords.length];
  }, [propertiesWithCoords]);

  const handleMarkerClick = (markerId: string) => {
    if (onPropertyClick) {
      const property = properties.find(p => String(p.listingId || p.id) === markerId);
      if (property) {
        onPropertyClick(property);
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative" data-testid="property-map-view">
      {propertiesWithoutCoords.length > 0 && propertiesWithCoords.length === 0 && (
        <Card className="mb-4 p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Map View Unavailable
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                {propertiesWithoutCoords.length} properties found but none have location coordinates. 
                The map will display markers once coordinate data becomes available.
              </p>
            </div>
          </div>
        </Card>
      )}

      {propertiesWithoutCoords.length > 0 && propertiesWithCoords.length > 0 && (
        <Card className="mb-4 p-3 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-blue-500" />
            <span className="text-blue-700 dark:text-blue-300">
              Showing {propertiesWithCoords.length} of {properties.length} properties on map.
              {propertiesWithoutCoords.length} properties are missing coordinates.
            </span>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden h-[600px]">
        <MapboxMap
          markers={mapMarkers}
          center={mapCenter}
          height="600px"
          zoom={defaultZoom}
          showLegend={true}
          interactive={true}
          onMarkerClick={handleMarkerClick}
          syncWithTheme={true}
          currentTheme={theme}
        />
      </Card>

      {properties.length === 0 && (
        <Card className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center p-6">
            <Home className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No Properties to Display</p>
            <p className="text-sm text-muted-foreground mt-1">
              Search for properties to see them on the map
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
