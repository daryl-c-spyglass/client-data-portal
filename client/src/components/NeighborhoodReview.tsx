import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Map as MapIcon, Home, TrendingUp, Clock, DollarSign, Building } from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface NeighborhoodReviewProps {
  neighborhoodName: string;
  city?: string;
  months?: number;
}

interface NeighborhoodStats {
  neighborhoodName: string;
  boundary: number[][][] | null;
  centerLat: number | null;
  centerLng: number | null;
  stats: {
    activeCount: number;
    underContractCount: number;
    soldCount: number;
    avgListPrice: number | null;
    avgSoldPrice: number | null;
    avgPricePerSqFt: number | null;
    avgDaysOnMarket: number | null;
    medianListPrice: number | null;
    medianSoldPrice: number | null;
  };
  listings: {
    active: any[];
    underContract: any[];
    sold: any[];
  };
  message?: string;
}

function FitBounds({ boundary, center }: { boundary: number[][][] | null; center: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (boundary && boundary[0] && boundary[0].length > 0) {
      const latLngs = boundary[0].map(coord => L.latLng(coord[1], coord[0]));
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [30, 30] });
    } else if (center) {
      map.setView(center, 13);
    }
  }, [boundary, center, map]);
  
  return null;
}

function getMarkerIcon(status: string): L.DivIcon {
  const statusLower = status.toLowerCase();
  let color = '#22c55e';
  
  if (statusLower === 'closed' || statusLower === 'sold') {
    color = '#6b7280';
  } else if (statusLower.includes('pending') || statusLower.includes('contract')) {
    color = '#f97316';
  }
  
  return new L.DivIcon({
    html: `<div style="background-color:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'custom-div-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

function StatCard({ icon: Icon, label, value, subValue }: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold truncate">{value}</p>
        {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
      </div>
    </div>
  );
}

export function NeighborhoodReview({ neighborhoodName, city, months = 6 }: NeighborhoodReviewProps) {
  const { data, isLoading, error } = useQuery<NeighborhoodStats>({
    queryKey: ['/api/neighborhoods/review', neighborhoodName, city, months],
    queryFn: async () => {
      const params = new URLSearchParams({ name: neighborhoodName });
      if (city) params.append('city', city);
      params.append('months', months.toString());
      
      const response = await fetch(`/api/neighborhoods/review?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch neighborhood data');
      }
      return response.json();
    },
    enabled: !!neighborhoodName,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-neighborhood-review-loading">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="w-4 h-4" />
            Neighborhood Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="card-neighborhood-review-error">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="w-4 h-4" />
            Neighborhood Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Unable to load neighborhood data for "{neighborhoodName}"
          </p>
        </CardContent>
      </Card>
    );
  }

  const { stats, boundary, centerLat, centerLng, listings } = data;
  const hasListings = listings.active.length > 0 || listings.underContract.length > 0 || listings.sold.length > 0;
  const allListings = [...listings.active, ...listings.underContract, ...listings.sold];
  
  const center: [number, number] | null = centerLat && centerLng ? [centerLat, centerLng] : null;
  
  const polygonPositions = boundary && boundary[0] 
    ? boundary[0].map(coord => [coord[1], coord[0]] as [number, number])
    : null;

  return (
    <Card data-testid="card-neighborhood-review">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="w-4 h-4" />
            {neighborhoodName} Neighborhood
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Last {months} months
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={Home}
            label="Active Listings"
            value={stats.activeCount}
            subValue={stats.avgListPrice ? `Avg ${formatPrice(stats.avgListPrice)}` : undefined}
          />
          <StatCard
            icon={Building}
            label="Active Under Contract"
            value={stats.underContractCount}
          />
          <StatCard
            icon={TrendingUp}
            label="Recently Sold"
            value={stats.soldCount}
            subValue={stats.avgSoldPrice ? `Avg ${formatPrice(stats.avgSoldPrice)}` : undefined}
          />
          <StatCard
            icon={Clock}
            label="Avg Days on Market"
            value={stats.avgDaysOnMarket != null ? Math.round(stats.avgDaysOnMarket) : 'N/A'}
          />
        </div>

        {stats.avgPricePerSqFt && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Avg Price/SqFt: <span className="font-semibold">${Math.round(stats.avgPricePerSqFt)}</span>
            </span>
            {stats.medianSoldPrice && (
              <span className="text-sm text-muted-foreground ml-4">
                Median Sold: {formatPrice(stats.medianSoldPrice)}
              </span>
            )}
          </div>
        )}

        {(boundary || center) && (
          <div className="rounded-lg overflow-hidden border" style={{ height: '300px' }}>
            <MapContainer
              center={center || [30.2672, -97.7431]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds boundary={boundary} center={center} />
              
              {polygonPositions && (
                <Polygon
                  positions={polygonPositions}
                  pathOptions={{
                    color: '#ea580c',
                    weight: 2,
                    fillColor: '#ea580c',
                    fillOpacity: 0.15,
                  }}
                />
              )}
              
              {allListings.slice(0, 30).map((property, index) => {
                const lat = Number(property.latitude);
                const lng = Number(property.longitude);
                if (isNaN(lat) || isNaN(lng)) return null;
                
                const status = property.standardStatus || property.status || 'Active';
                const price = property.closePrice || property.listPrice || 0;
                
                return (
                  <Marker
                    key={property.listingId || property.id || index}
                    position={[lat, lng]}
                    icon={getMarkerIcon(status)}
                  >
                    <Popup>
                      <div className="min-w-[180px]">
                        <p className="font-semibold text-sm">{property.unparsedAddress || property.address}</p>
                        <p className="text-lg font-bold text-primary">{formatPrice(Number(price))}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {status}
                        </Badge>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                          <span>{property.bedroomsTotal || property.beds || 0} beds</span>
                          <span>{property.bathroomsTotalInteger || property.baths || 0} baths</span>
                          {property.livingArea && <span>{Number(property.livingArea).toLocaleString()} sqft</span>}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}

        {!boundary && !center && (
          <div className="h-[200px] flex items-center justify-center bg-muted/10 rounded-lg border border-dashed">
            <div className="text-center">
              <MapIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No boundary data available for this neighborhood</p>
            </div>
          </div>
        )}

        {hasListings && (
          <div className="flex items-center gap-3 text-xs pt-2 border-t">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Active ({listings.active.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Pending ({listings.underContract.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span>Sold ({listings.sold.length})</span>
            </div>
          </div>
        )}

        {data.message && (
          <p className="text-xs text-muted-foreground italic">{data.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
