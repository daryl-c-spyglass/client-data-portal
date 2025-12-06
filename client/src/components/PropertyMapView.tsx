import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Bed, Bath, Ruler, ExternalLink, AlertTriangle } from "lucide-react";
import type { Property } from "@shared/schema";
import "leaflet/dist/leaflet.css";

interface PropertyMapViewProps {
  properties: Property[];
  onPropertyClick?: (property: Property) => void;
  isLoading?: boolean;
}

const defaultCenter: [number, number] = [30.2672, -97.7431];
const defaultZoom = 10;

const createPropertyIcon = (status: string) => {
  const color = status === "Active" 
    ? "#22c55e" 
    : status === "Under Contract" || status === "Pending"
    ? "#f59e0b"
    : "#6b7280";
  
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg style="transform: rotate(45deg); width: 14px; height: 14px; color: white;" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

function MapBoundsUpdater({ properties }: { properties: Property[] }) {
  const map = useMap();
  
  useEffect(() => {
    const validProperties = properties.filter(
      p => p.latitude != null && p.longitude != null
    );
    
    if (validProperties.length > 0) {
      const bounds = L.latLngBounds(
        validProperties.map(p => [Number(p.latitude), Number(p.longitude)] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [properties, map]);
  
  return null;
}

function PropertyPopup({ property, onPropertyClick }: { property: Property; onPropertyClick?: (property: Property) => void }) {
  const price = property.listPrice || property.closePrice;
  const formattedPrice = price 
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(price))
    : "Price N/A";

  const statusColor = property.standardStatus === "Active" 
    ? "bg-green-500" 
    : property.standardStatus === "Under Contract" || property.standardStatus === "Pending"
    ? "bg-amber-500"
    : "bg-gray-500";

  return (
    <div className="min-w-[240px] p-1">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-bold text-lg text-foreground">{formattedPrice}</span>
        <Badge className={`${statusColor} text-white text-xs`}>
          {property.standardStatus || "Unknown"}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
        {property.unparsedAddress || `${property.streetNumber} ${property.streetName}`}
        {property.city && `, ${property.city}`}
      </p>
      
      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
        {property.bedroomsTotal && (
          <span className="flex items-center gap-1">
            <Bed className="w-3 h-3" />
            {property.bedroomsTotal}
          </span>
        )}
        {property.bathroomsTotalInteger && (
          <span className="flex items-center gap-1">
            <Bath className="w-3 h-3" />
            {property.bathroomsTotalInteger}
          </span>
        )}
        {property.livingArea && (
          <span className="flex items-center gap-1">
            <Ruler className="w-3 h-3" />
            {Number(property.livingArea).toLocaleString()} sqft
          </span>
        )}
      </div>
      
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
  );
}

export function PropertyMapView({ properties, onPropertyClick, isLoading }: PropertyMapViewProps) {
  const [mapReady, setMapReady] = useState(false);

  const propertiesWithCoords = useMemo(() => 
    properties.filter(p => p.latitude != null && p.longitude != null),
    [properties]
  );

  const propertiesWithoutCoords = useMemo(() => 
    properties.filter(p => p.latitude == null || p.longitude == null),
    [properties]
  );

  const center = useMemo(() => {
    if (propertiesWithCoords.length > 0) {
      const avgLat = propertiesWithCoords.reduce((sum, p) => sum + Number(p.latitude), 0) / propertiesWithCoords.length;
      const avgLng = propertiesWithCoords.reduce((sum, p) => sum + Number(p.longitude), 0) / propertiesWithCoords.length;
      return [avgLat, avgLng] as [number, number];
    }
    return defaultCenter;
  }, [propertiesWithCoords]);

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
        <MapContainer
          center={center}
          zoom={defaultZoom}
          className="h-full w-full"
          whenReady={() => setMapReady(true)}
          data-testid="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {mapReady && <MapBoundsUpdater properties={propertiesWithCoords} />}
          
          {propertiesWithCoords.map((property) => {
            const uniqueKey = property.listingId || property.id;
            return (
              <Marker
                key={uniqueKey}
                position={[Number(property.latitude), Number(property.longitude)]}
                icon={createPropertyIcon(property.standardStatus || "Active")}
              >
                <Popup>
                  <PropertyPopup property={property} onPropertyClick={onPropertyClick} />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
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

      <div className="absolute bottom-4 left-4 z-[1000]">
        <Card className="p-3 bg-background/95 backdrop-blur-sm">
          <p className="text-xs font-medium mb-2">Legend</p>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span>Under Contract</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span>Closed/Other</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
