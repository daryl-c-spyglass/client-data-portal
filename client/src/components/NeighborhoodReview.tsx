import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapboxMap, type MapMarker } from "@/components/shared/MapboxMap";
import { Map as MapIcon, Home, TrendingUp, Clock, DollarSign, Building } from "lucide-react";

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
  
  const mapCenter: [number, number] | undefined = centerLat && centerLng 
    ? [centerLng, centerLat] 
    : undefined;
  
  const mapMarkers: MapMarker[] = allListings.slice(0, 30)
    .filter(property => !isNaN(Number(property.latitude)) && !isNaN(Number(property.longitude)))
    .map((property, index) => {
      const status = property.standardStatus || property.status || 'Active';
      const price = property.closePrice || property.listPrice || 0;
      
      return {
        id: String(property.listingId || property.id || `listing-${index}`),
        latitude: Number(property.latitude),
        longitude: Number(property.longitude),
        price: Number(price),
        label: property.unparsedAddress || property.address || '',
        status: status as MapMarker['status'],
        beds: property.bedroomsTotal || property.beds,
        baths: property.bathroomsTotalInteger || property.baths,
        sqft: property.livingArea ? Number(property.livingArea) : undefined,
      };
    });

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
            label="Recently Closed"
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
                Median Close: {formatPrice(stats.medianSoldPrice)}
              </span>
            )}
          </div>
        )}

        {(boundary || mapCenter) && (
          <div className="rounded-lg overflow-hidden border" style={{ height: '300px' }}>
            <MapboxMap
              markers={mapMarkers}
              center={mapCenter}
              zoom={13}
              height="300px"
              showLegend={true}
              interactive={true}
              polygon={boundary || undefined}
              showPolygon={!!boundary}
              polygonColor="#ea580c"
            />
          </div>
        )}

        {!boundary && !mapCenter && (
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
              <span>Closed ({listings.sold.length})</span>
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
