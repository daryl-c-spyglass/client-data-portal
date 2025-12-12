import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Home, 
  FileText, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  BarChart3,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Info,
  Bed,
  Bath,
  Maximize,
  MapPin,
  Calendar,
  GripVertical,
  Eye,
  EyeOff
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Cma, Property } from "@shared/schema";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ListingsByMonth {
  month: string;
  active: number;
  closed: number;
}

interface PriceDistribution {
  range: string;
  count: number;
}

interface DashboardStats {
  totalActiveProperties: number;
  totalUnderContractProperties: number;
  totalClosedProperties: number;
  totalProperties: number;
  activeCmas: number;
  sellerUpdates: number;
  systemStatus: string;
  repliersConfigured: boolean;
  mlsGridConfigured: boolean;
}

interface DashboardProperty {
  id: string;
  listingId?: string;
  unparsedAddress?: string;
  address?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  listPrice?: number;
  standardStatus?: string;
  bedroomsTotal?: number;
  bathroomsTotalInteger?: number;
  livingArea?: number;
  yearBuilt?: number;
  photos?: string[];
  daysOnMarket?: number;
  latitude?: number;
  longitude?: number;
  propertySubType?: string;
  subdivisionName?: string;
}

interface DashboardConfig {
  showMetrics: boolean;
  showQuickActions: boolean;
  showActiveCarousel: boolean;
  showMarketInsights: boolean;
  showRecentCmas: boolean;
  widgetOrder: string[];
}

const defaultConfig: DashboardConfig = {
  showMetrics: true,
  showQuickActions: true,
  showActiveCarousel: true,
  showMarketInsights: true,
  showRecentCmas: true,
  widgetOrder: ['metrics', 'quickActions', 'activeCarousel', 'marketInsights', 'recentCmas']
};

const statusConfig = {
  Active: { color: "bg-emerald-500", textColor: "text-white" },
  "Under Contract": { color: "bg-amber-500", textColor: "text-white" },
  Closed: { color: "bg-slate-500", textColor: "text-white" },
  Pending: { color: "bg-blue-500", textColor: "text-white" },
} as const;

function PropertyCarouselCard({ 
  property, 
  onClick 
}: { 
  property: DashboardProperty; 
  onClick: () => void;
}) {
  const primaryImage = property.photos?.[0];
  const formattedPrice = property.listPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(property.listPrice))
    : 'Price upon request';
  const address = property.unparsedAddress || property.address || 'Unknown Address';

  return (
    <Card 
      className="flex-shrink-0 w-72 overflow-hidden cursor-pointer hover-elevate active-elevate-2"
      onClick={onClick}
      data-testid={`carousel-card-${property.id}`}
    >
      <div className="relative aspect-[16/10] bg-muted">
        {primaryImage ? (
          <img 
            src={primaryImage} 
            alt={address} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Home className="w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-2 left-2">
          <div className="text-white font-semibold text-lg px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded">
            {formattedPrice}
          </div>
        </div>
        {property.standardStatus && (
          <div className="absolute top-2 right-2">
            <Badge 
              className={`${statusConfig[property.standardStatus as keyof typeof statusConfig]?.color || 'bg-slate-500'} ${statusConfig[property.standardStatus as keyof typeof statusConfig]?.textColor || 'text-white'} text-xs`}
            >
              {property.standardStatus}
            </Badge>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {property.bedroomsTotal !== null && property.bedroomsTotal !== undefined && (
            <span className="flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {property.bedroomsTotal}
            </span>
          )}
          {property.bathroomsTotalInteger !== null && property.bathroomsTotalInteger !== undefined && (
            <span className="flex items-center gap-1">
              <Bath className="w-3 h-3" />
              {property.bathroomsTotalInteger}
            </span>
          )}
          {property.livingArea && (
            <span className="flex items-center gap-1">
              <Maximize className="w-3 h-3" />
              {Number(property.livingArea).toLocaleString()} sqft
            </span>
          )}
        </div>
        <h4 className="font-medium text-sm line-clamp-1">{address}</h4>
        {property.city && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {property.city}, {property.stateOrProvince || 'TX'}
          </p>
        )}
      </div>
    </Card>
  );
}

function PropertyDetailModal({ 
  property, 
  open, 
  onClose 
}: { 
  property: DashboardProperty | null; 
  open: boolean; 
  onClose: () => void;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  if (!property) return null;
  
  const photos = property.photos || [];
  const address = property.unparsedAddress || property.address || 'Unknown Address';
  const formattedPrice = property.listPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(property.listPrice))
    : 'Price upon request';
  const pricePerSqft = property.listPrice && property.livingArea 
    ? Number(property.listPrice) / Number(property.livingArea) 
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <div className="relative aspect-[16/9] bg-muted">
          {photos.length > 0 ? (
            <>
              <img 
                src={photos[currentImageIndex]} 
                alt={address}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-80"
                    onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : photos.length - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80"
                    onClick={() => setCurrentImageIndex(prev => prev < photos.length - 1 ? prev + 1 : 0)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    {currentImageIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Home className="w-16 h-16" />
            </div>
          )}
          <div className="absolute top-4 right-4">
            {property.standardStatus && (
              <Badge 
                className={`${statusConfig[property.standardStatus as keyof typeof statusConfig]?.color || 'bg-slate-500'} ${statusConfig[property.standardStatus as keyof typeof statusConfig]?.textColor || 'text-white'}`}
              >
                {property.standardStatus}
              </Badge>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[40vh]">
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{address}</h2>
                {property.city && (
                  <p className="text-muted-foreground">
                    {property.city}, {property.stateOrProvince || 'TX'} {property.postalCode}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{formattedPrice}</p>
                {pricePerSqft && (
                  <p className="text-sm text-muted-foreground">${pricePerSqft.toFixed(0)}/sqft</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold">{property.bedroomsTotal || 0}</p>
                <p className="text-xs text-muted-foreground">Beds</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold">{property.bathroomsTotalInteger || 0}</p>
                <p className="text-xs text-muted-foreground">Baths</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold">{property.livingArea ? Number(property.livingArea).toLocaleString() : 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Sq Ft</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-md">
                <p className="text-2xl font-bold">{property.yearBuilt || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Year Built</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {property.daysOnMarket !== null && property.daysOnMarket !== undefined && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {property.daysOnMarket} days on market
                </span>
              )}
              {property.subdivisionName && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {property.subdivisionName}
                </span>
              )}
              {property.propertySubType && (
                <span className="flex items-center gap-1">
                  <Home className="w-4 h-4" />
                  {property.propertySubType}
                </span>
              )}
            </div>
            
            <div className="flex gap-2 pt-2">
              <Link href={`/properties/${property.id}`}>
                <Button data-testid="button-view-full-details">
                  View Full Details
                </Button>
              </Link>
              <Link href={`/cmas/new?property=${property.id}`}>
                <Button variant="outline" data-testid="button-create-cma-from-property">
                  <Plus className="w-4 h-4 mr-2" />
                  Create CMA
                </Button>
              </Link>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [selectedProperty, setSelectedProperty] = useState<DashboardProperty | null>(null);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [recentCmasOpen, setRecentCmasOpen] = useState(true);
  const [config, setConfig] = useState<DashboardConfig>(() => {
    const saved = localStorage.getItem('dashboard-config');
    return saved ? JSON.parse(saved) : defaultConfig;
  });
  
  useEffect(() => {
    localStorage.setItem('dashboard-config', JSON.stringify(config));
  }, [config]);
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats/dashboard'],
  });

  const { data: cmas = [], isLoading: cmasLoading } = useQuery<Cma[]>({
    queryKey: ['/api/cmas'],
  });

  const { data: listingsByMonth = [], isLoading: listingsLoading } = useQuery<ListingsByMonth[]>({
    queryKey: ['/api/stats/listings-by-month'],
  });

  const { data: priceDistribution = [], isLoading: priceLoading } = useQuery<PriceDistribution[]>({
    queryKey: ['/api/stats/price-distribution'],
  });
  
  // Extract personalization parameters from recent CMAs (city, price range, property type)
  const personalizationParams = (() => {
    if (cmas.length === 0) return { city: undefined, minPrice: undefined, maxPrice: undefined, propertyType: undefined };
    
    // Get unique cities from recent CMAs (last 5)
    const recentCmas = [...cmas]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    
    // Extract values from CMA criteria
    const cities: string[] = [];
    const priceRanges: { min?: number; max?: number }[] = [];
    const propertyTypes: string[] = [];
    
    recentCmas.forEach(cma => {
      const criteria = cma.searchCriteria as any;
      if (criteria?.city) cities.push(criteria.city);
      if (criteria?.minPrice || criteria?.maxPrice) {
        priceRanges.push({ min: criteria.minPrice, max: criteria.maxPrice });
      }
      if (criteria?.propertyType) propertyTypes.push(criteria.propertyType);
    });
    
    // Use most common city if available
    const cityCount: Record<string, number> = {};
    cities.forEach(city => { cityCount[city] = (cityCount[city] || 0) + 1; });
    const topCity = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    
    // Use average of recent price ranges
    let avgMinPrice: number | undefined;
    let avgMaxPrice: number | undefined;
    if (priceRanges.length > 0) {
      const minPrices = priceRanges.filter(r => r.min).map(r => r.min!);
      const maxPrices = priceRanges.filter(r => r.max).map(r => r.max!);
      if (minPrices.length > 0) avgMinPrice = Math.round(minPrices.reduce((a, b) => a + b, 0) / minPrices.length);
      if (maxPrices.length > 0) avgMaxPrice = Math.round(maxPrices.reduce((a, b) => a + b, 0) / maxPrices.length);
    }
    
    // Use most common property type
    const typeCount: Record<string, number> = {};
    propertyTypes.forEach(t => { typeCount[t] = (typeCount[t] || 0) + 1; });
    const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    
    return { city: topCity, minPrice: avgMinPrice, maxPrice: avgMaxPrice, propertyType: topType };
  })();
  
  // Build query string with all personalization params
  const activePropertiesQueryKey = (() => {
    const params = new URLSearchParams();
    if (personalizationParams.city) params.set('city', personalizationParams.city);
    if (personalizationParams.minPrice) params.set('minPrice', String(personalizationParams.minPrice));
    if (personalizationParams.maxPrice) params.set('maxPrice', String(personalizationParams.maxPrice));
    if (personalizationParams.propertyType) params.set('propertyType', personalizationParams.propertyType);
    const queryStr = params.toString();
    return queryStr ? `/api/dashboard/active-properties?${queryStr}` : '/api/dashboard/active-properties';
  })();
  
  const { data: activePropertiesData, isLoading: activePropertiesLoading } = useQuery<{ properties: DashboardProperty[], count: number, personalized?: boolean }>({
    queryKey: [activePropertiesQueryKey],
    staleTime: 5 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/sync', 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "Repliers data sync has been triggered. This may take a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start data sync",
        variant: "destructive",
      });
    },
  });

  const isLoading = statsLoading || cmasLoading;
  
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  
  const handlePropertyClick = (property: DashboardProperty) => {
    setSelectedProperty(property);
    setPropertyModalOpen(true);
  };
  
  const toggleWidget = (key: keyof DashboardConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const sortedCmas = [...cmas].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your Spyglass Realty agent platform</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setConfigOpen(!configOpen)}
          data-testid="button-customize-dashboard"
        >
          <Settings className="w-4 h-4 mr-2" />
          Customize Dashboard
        </Button>
      </div>
      
      {configOpen && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dashboard Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: 'showMetrics', label: 'Metrics Cards' },
                { key: 'showQuickActions', label: 'Quick Actions' },
                { key: 'showActiveCarousel', label: 'Active Properties' },
                { key: 'showMarketInsights', label: 'Market Insights' },
                { key: 'showRecentCmas', label: 'Recent CMAs' },
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={config[key as keyof DashboardConfig] ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleWidget(key as keyof DashboardConfig)}
                  className="justify-start gap-2"
                  data-testid={`toggle-${key}`}
                >
                  {config[key as keyof DashboardConfig] ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && !stats.mlsGridConfigured && !stats.repliersConfigured && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  API Not Configured
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  To start importing property data, please configure your API credentials in the environment variables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {config.showMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Active + Under Contract (from Repliers) + Sold (from database)</p>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-properties">
                    {stats?.totalProperties?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                    <p className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {stats?.totalActiveProperties?.toLocaleString() || 0} Active
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      {stats?.totalUnderContractProperties?.toLocaleString() || 0} Under Contract
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      {stats?.totalClosedProperties?.toLocaleString() || 0} Sold
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
              <CardTitle className="text-sm font-medium">Active CMAs</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total Comparative Market Analyses created</p>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-active-cmas">
                    {stats?.activeCmas || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Total created</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
              <CardTitle className="text-sm font-medium">Seller Updates</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Active market monitoring alerts for sellers</p>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-saved-searches">
                    {stats?.sellerUpdates || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Monitoring market</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Platform and API connection status</p>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-system-status">
                {stats?.systemStatus || 'Loading...'}
              </div>
              <p className="text-xs text-muted-foreground">Platform status</p>
            </CardContent>
          </Card>
        </div>
      )}

      {config.showQuickActions && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              className="w-full" 
              variant="outline" 
              data-testid="button-sync-data"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync Repliers Data'}
            </Button>
            <Link href="/cmas/new">
              <Button className="w-full" variant="outline" data-testid="button-create-cma">
                <Plus className="w-4 h-4 mr-2" />
                Create CMA
              </Button>
            </Link>
            <Link href="/properties">
              <Button className="w-full" data-testid="button-search-properties">
                <Search className="w-4 h-4 mr-2" />
                Search Properties
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
      
      {config.showActiveCarousel && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                Active Properties
                {activePropertiesData?.personalized && (
                  <Badge variant="secondary" className="text-xs">Personalized</Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {activePropertiesData?.personalized 
                  ? `Properties matching your recent activity${personalizationParams.city ? ` in ${personalizationParams.city}` : ''}`
                  : 'Recently listed properties from Repliers'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="icon" 
                variant="outline"
                onClick={() => scrollCarousel('left')}
                data-testid="button-carousel-left"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="outline"
                onClick={() => scrollCarousel('right')}
                data-testid="button-carousel-right"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activePropertiesLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="flex-shrink-0 w-72 h-64 rounded-lg" />
                ))}
              </div>
            ) : activePropertiesData?.properties && activePropertiesData.properties.length > 0 ? (
              <div 
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {activePropertiesData.properties.map(property => (
                  <PropertyCarouselCard
                    key={property.id}
                    property={property}
                    onClick={() => handlePropertyClick(property)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active properties available</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {config.showMarketInsights && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Market Insights</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Market Activity (Last 12 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                {listingsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : listingsByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={listingsByMonth.map(item => ({
                      ...item,
                      monthLabel: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="monthLabel" 
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="active" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="New Listings"
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="closed" 
                        stroke="hsl(142, 76%, 36%)" 
                        strokeWidth={2}
                        name="Closed Sales"
                        dot={{ fill: 'hsl(142, 76%, 36%)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Price Distribution (Active Listings)</CardTitle>
              </CardHeader>
              <CardContent>
                {priceLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : priceDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={priceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="range" 
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [value.toLocaleString(), 'Properties']}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                        name="Properties"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {config.showRecentCmas && (
        <Card>
          <Collapsible open={recentCmasOpen} onOpenChange={setRecentCmasOpen}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Recent CMAs</CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-toggle-recent-cmas">
                  <ChevronDown className={`w-4 h-4 transition-transform ${recentCmasOpen ? '' : '-rotate-90'}`} />
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {cmasLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : sortedCmas.length > 0 ? (
                  <div className="space-y-4">
                    {sortedCmas.slice(0, 5).map((cma) => (
                      <Link key={cma.id} href={`/cmas/${cma.id}`}>
                        <div className="flex items-center gap-4 p-4 rounded-md hover-elevate active-elevate-2 cursor-pointer">
                          <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                            <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{cma.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {cma.comparablePropertyIds.length} properties • Created {new Date(cma.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No CMAs yet. Create your first comparative market analysis.</p>
                    <Link href="/cmas/new">
                      <Button className="mt-4" variant="outline">
                        Get Started
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
      
      <PropertyDetailModal
        property={selectedProperty}
        open={propertyModalOpen}
        onClose={() => setPropertyModalOpen(false)}
      />
    </div>
  );
}
