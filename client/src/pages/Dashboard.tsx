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
  ChevronUp,
  Settings,
  Info,
  Bed,
  Bath,
  Maximize,
  MapPin,
  Calendar,
  GripVertical,
  Eye,
  EyeOff,
  Activity,
  Building2,
  RotateCcw,
  Loader2
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Cma, Property } from "@shared/schema";
import { formatPropertyType } from "@/lib/property-type-utils";
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

interface SystemStatus {
  repliersConfigured: boolean;
  mlsGridConfigured: boolean;
  mapboxConfigured: boolean;
  lastDataPull: string | null;
  lastSuccessfulSync: string | null;
  lastSyncAttempt: string | null;
  status: string;
  timestamp: string;
}

interface InventoryBySubtype {
  subtypes: Record<string, number>;
  total: number;
}

interface DomAnalytics {
  status: string;
  daysRange: number;
  count: number;
  avgDom: number;
  medianDom: number;
  minDom: number;
  maxDom: number;
  distribution: Record<string, number>;
}

interface RecentSoldProperty {
  id: string;
  listingId?: string;
  unparsedAddress?: string;
  city?: string;
  stateOrProvince?: string;
  closePrice?: number;
  closeDate?: string;
  bedroomsTotal?: number;
  bathroomsTotalInteger?: number;
  livingArea?: number;
  yearBuilt?: number;
  photos?: string[];
  standardStatus?: string;
  propertySubType?: string;
}

// Helper to display sold price consistently
function displaySoldPrice(price?: number): string {
  if (!price) return 'Price N/A';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(price);
}

interface RecentSoldResponse {
  properties: RecentSoldProperty[];
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  personalized?: boolean;
  filters?: {
    city?: string;
    subdivision?: string;
    minPrice?: number;
    maxPrice?: number;
  } | null;
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
  neighborhood?: string;
  poolFeatures?: string | string[] | null;
  garageSpaces?: number | null;
  elementarySchool?: string;
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
  
  // Reset image index when property changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [property?.id]);
  
  // Auto-carousel every 3 seconds
  useEffect(() => {
    if (!open || !property?.photos?.length || property.photos.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => 
        prev < (property.photos?.length || 1) - 1 ? prev + 1 : 0
      );
    }, 3000);
    
    return () => clearInterval(interval);
  }, [open, property?.photos?.length, property?.id]);
  
  if (!property) return null;
  
  const photos = property.photos || [];
  const address = property.unparsedAddress || property.address || 'Unknown Address';
  const formattedPrice = property.listPrice 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(property.listPrice))
    : 'Price upon request';
  const pricePerSqft = property.listPrice && property.livingArea 
    ? Number(property.listPrice) / Number(property.livingArea) 
    : null;
  
  // Handle click on left/right side of image for navigation
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (photos.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeftSide = x < rect.width / 2;
    
    if (isLeftSide) {
      setCurrentImageIndex(prev => prev > 0 ? prev - 1 : photos.length - 1);
    } else {
      setCurrentImageIndex(prev => prev < photos.length - 1 ? prev + 1 : 0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl flex flex-col p-0" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
        {/* Image Section - Fixed Height */}
        <div 
          className="relative aspect-[16/9] bg-muted flex-shrink-0 cursor-pointer"
          onClick={handleImageClick}
        >
          {photos.length > 0 ? (
            <>
              <img 
                src={photos[currentImageIndex]} 
                alt={address}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {currentImageIndex + 1} / {photos.length}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <Home className="w-16 h-16 mb-2" />
              <p className="text-sm">No photos available</p>
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
        
        {/* Content Section - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
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
              <p className="text-2xl font-bold">{property.bedroomsTotal !== null && property.bedroomsTotal !== undefined ? property.bedroomsTotal : '—'}</p>
              <p className="text-xs text-muted-foreground">Beds</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">{property.bathroomsTotalInteger !== null && property.bathroomsTotalInteger !== undefined ? property.bathroomsTotalInteger : '—'}</p>
              <p className="text-xs text-muted-foreground">Baths</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">{property.livingArea ? Number(property.livingArea).toLocaleString() : '—'}</p>
              <p className="text-xs text-muted-foreground">Sq Ft</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-md">
              <p className="text-2xl font-bold">{property.yearBuilt || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">Year Built</p>
            </div>
          </div>
          
          {/* Property Details Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {property.poolFeatures && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pool:</span>
                <span className="font-medium">{Array.isArray(property.poolFeatures) ? (property.poolFeatures.length > 0 ? 'Yes' : 'No') : (property.poolFeatures ? 'Yes' : 'No')}</span>
              </div>
            )}
            {property.garageSpaces !== null && property.garageSpaces !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Garage:</span>
                <span className="font-medium">{property.garageSpaces}</span>
              </div>
            )}
            {property.daysOnMarket !== null && property.daysOnMarket !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days on Market:</span>
                <span className="font-medium">{property.daysOnMarket}</span>
              </div>
            )}
            {property.propertySubType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property Type:</span>
                <span className="font-medium">{formatPropertyType(property.propertySubType)}</span>
              </div>
            )}
          </div>
          
          {/* Location & School Information */}
          <div className="space-y-2 text-sm border-t pt-4">
            <h4 className="font-medium text-muted-foreground">Location Details</h4>
            <div className="grid grid-cols-1 gap-2">
              {property.neighborhood && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Neighborhood:</span>
                  <span className="font-medium">{property.neighborhood}</span>
                </div>
              )}
              {property.subdivisionName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subdivision:</span>
                  <span className="font-medium">{property.subdivisionName}</span>
                </div>
              )}
              {property.elementarySchool && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elementary School:</span>
                  <span className="font-medium">{property.elementarySchool}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* MLS Number */}
          {property.listingId && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              MLS #: {property.listingId}
            </div>
          )}
          
          <div className="flex gap-2 pt-2 pb-4">
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
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [selectedProperty, setSelectedProperty] = useState<DashboardProperty | null>(null);
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [recentCmasOpen, setRecentCmasOpen] = useState(true);
  // Dashboard customization is TEMPORARY (session-only, resets on refresh)
  const [config, setConfig] = useState<DashboardConfig>(defaultConfig);
  // CMA sorting state (session-only)
  const [cmaSortBy, setCmaSortBy] = useState<'date' | 'date-asc' | 'name' | 'name-desc'>('date');
  
  // Auto-carousel state
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [carouselHovered, setCarouselHovered] = useState(false);
  const manualInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Recent Sold pagination state
  const [recentSoldPage, setRecentSoldPage] = useState(1);
  const [allRecentSoldProps, setAllRecentSoldProps] = useState<RecentSoldProperty[]>([]);
  const recentSoldScrollRef = useRef<HTMLDivElement>(null);
  
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

  const { data: systemStatus, isLoading: systemStatusLoading } = useQuery<SystemStatus>({
    queryKey: ['/api/dashboard/system-status'],
    staleTime: 60 * 1000,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery<InventoryBySubtype>({
    queryKey: ['/api/dashboard/inventory-by-subtype'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: domAnalytics, isLoading: domLoading } = useQuery<DomAnalytics[]>({
    queryKey: ['/api/dashboard/dom-analytics'],
    staleTime: 5 * 60 * 1000,
  });

  // Build personalized Recent Sold query URL
  const recentSoldQueryKey = (() => {
    const params = new URLSearchParams();
    params.set('page', String(recentSoldPage));
    if (personalizationParams.city) params.set('city', personalizationParams.city);
    if (personalizationParams.minPrice) params.set('minPrice', String(personalizationParams.minPrice));
    if (personalizationParams.maxPrice) params.set('maxPrice', String(personalizationParams.maxPrice));
    return `/api/dashboard/recent-sold?${params.toString()}`;
  })();
  
  const { data: recentSoldData, isLoading: recentSoldLoading, isFetching: recentSoldFetching } = useQuery<RecentSoldResponse>({
    queryKey: [recentSoldQueryKey],
    staleTime: 5 * 60 * 1000,
  });
  
  // Accumulate paginated sold properties
  useEffect(() => {
    if (recentSoldData?.properties) {
      if (recentSoldPage === 1) {
        setAllRecentSoldProps(recentSoldData.properties);
      } else {
        setAllRecentSoldProps(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProps = recentSoldData.properties.filter(p => !existingIds.has(p.id));
          return [...prev, ...newProps];
        });
      }
    }
  }, [recentSoldData, recentSoldPage]);
  
  // Infinite scroll handler for recent sold
  const handleRecentSoldScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    if (nearBottom && recentSoldData?.hasMore && !recentSoldFetching) {
      setRecentSoldPage(prev => prev + 1);
    }
  };

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
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  
  const scrollCarousel = (direction: 'left' | 'right', isManual = false) => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      
      // Pause auto-scroll on manual interaction
      if (isManual) {
        setCarouselPaused(true);
        
        // Clear any existing timeout
        if (manualInteractionTimeoutRef.current) {
          clearTimeout(manualInteractionTimeoutRef.current);
        }
        
        // Resume auto-scroll after 5 seconds of inactivity
        manualInteractionTimeoutRef.current = setTimeout(() => {
          setCarouselPaused(false);
        }, 5000);
      }
    }
  };
  
  // Auto-scroll carousel every 3 seconds
  useEffect(() => {
    // Skip if reduced motion is preferred
    if (prefersReducedMotion) return;
    
    // Clear existing interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }
    
    // Only auto-scroll if not paused and not hovered
    if (!carouselPaused && !carouselHovered && activePropertiesData?.properties?.length) {
      autoScrollIntervalRef.current = setInterval(() => {
        if (carouselRef.current) {
          const container = carouselRef.current;
          const maxScroll = container.scrollWidth - container.clientWidth;
          
          // If at the end, loop back to start
          if (container.scrollLeft >= maxScroll - 10) {
            container.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            container.scrollBy({ left: 300, behavior: 'smooth' });
          }
        }
      }, 3000);
    }
    
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, [carouselPaused, carouselHovered, activePropertiesData?.properties?.length, prefersReducedMotion]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (manualInteractionTimeoutRef.current) {
        clearTimeout(manualInteractionTimeoutRef.current);
      }
    };
  }, []);
  
  const handlePropertyClick = (property: DashboardProperty) => {
    setSelectedProperty(property);
    setPropertyModalOpen(true);
  };
  
  const toggleWidget = (key: keyof DashboardConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const moveWidget = (widgetKey: string, direction: 'up' | 'down') => {
    setConfig(prev => {
      const order = [...prev.widgetOrder];
      const index = order.indexOf(widgetKey);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= order.length) return prev;
      
      // Swap positions
      [order[index], order[newIndex]] = [order[newIndex], order[index]];
      return { ...prev, widgetOrder: order };
    });
  };
  
  const resetDashboard = () => {
    setConfig(defaultConfig);
    setCmaSortBy('date');
  };
  
  const sortedCmas = [...cmas].sort((a, b) => {
    switch (cmaSortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'date':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
  
  // Widget visibility mapping
  const widgetVisibility: Record<string, boolean> = {
    metrics: config.showMetrics,
    quickActions: config.showQuickActions,
    activeCarousel: config.showActiveCarousel,
    marketInsights: config.showMarketInsights,
    recentCmas: config.showRecentCmas,
  };

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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Dashboard Configuration</CardTitle>
                <Badge variant="secondary" className="text-xs">Session Only</Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetDashboard}
                data-testid="button-reset-dashboard"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Customizations apply to this session only and reset on page refresh.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Toggle Visibility</p>
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
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Widget Order (drag to reorder)</p>
              <div className="flex flex-col gap-2">
                {config.widgetOrder.map((widgetKey, index) => {
                  const widgetLabels: Record<string, string> = {
                    metrics: 'Metrics Cards',
                    quickActions: 'Quick Actions',
                    activeCarousel: 'Active Properties',
                    marketInsights: 'Market Insights',
                    recentCmas: 'Recent CMAs',
                  };
                  return (
                    <div 
                      key={widgetKey}
                      className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
                    >
                      <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                      <span className="flex-1 text-sm">{widgetLabels[widgetKey] || widgetKey}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveWidget(widgetKey, 'up')}
                        disabled={index === 0}
                        data-testid={`button-move-up-${widgetKey}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveWidget(widgetKey, 'down')}
                        disabled={index === config.widgetOrder.length - 1}
                        data-testid={`button-move-down-${widgetKey}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
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

      {/* Render widgets in user-specified order */}
      {config.widgetOrder.map((widgetKey) => {
        if (!widgetVisibility[widgetKey]) return null;
        
        switch (widgetKey) {
          case 'metrics':
            return (
              <div key="metrics" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link href="/properties">
                  <Card className="cursor-pointer hover-elevate transition-colors" tabIndex={0} role="button" aria-label="View all properties" onKeyDown={(e) => e.key === 'Enter' && navigate('/properties')} data-testid="card-total-properties">
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
                </Link>

                <Link href="/cmas">
                  <Card className="cursor-pointer hover-elevate transition-colors" tabIndex={0} role="button" aria-label="View all CMAs" onKeyDown={(e) => e.key === 'Enter' && navigate('/cmas')} data-testid="card-active-cmas">
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
                </Link>

                <Link href="/seller-updates">
                  <Card className="cursor-pointer hover-elevate transition-colors" tabIndex={0} role="button" aria-label="View seller updates" onKeyDown={(e) => e.key === 'Enter' && navigate('/seller-updates')} data-testid="card-seller-updates">
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
                </Link>

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
            );
          
          case 'quickActions':
            return (
              <Card key="quickActions">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Link href="/properties" className="block">
                      <Button className="w-full h-auto py-4 flex flex-col items-center gap-2" data-testid="button-buyer-search">
                        <Search className="w-5 h-5" />
                        <span className="text-xs font-medium">Buyer Search</span>
                      </Button>
                    </Link>
                    <Link href="/cmas/new" className="block">
                      <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2" data-testid="button-create-cma">
                        <Plus className="w-5 h-5" />
                        <span className="text-xs font-medium">Create CMA</span>
                      </Button>
                    </Link>
                    <Link href="/cmas" className="block">
                      <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2" data-testid="button-view-cmas">
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-xs font-medium">View CMAs</span>
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      className="w-full h-auto py-4 flex flex-col items-center gap-2"
                      data-testid="button-sync-data"
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                    >
                      <RefreshCw className={`w-5 h-5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                      <span className="text-xs font-medium">{syncMutation.isPending ? 'Syncing...' : 'Sync Data'}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          
          case 'activeCarousel':
            return (
              <Card key="activeCarousel">
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
                      onClick={() => scrollCarousel('left', true)}
                      data-testid="button-carousel-left"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => scrollCarousel('right', true)}
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
                      onMouseEnter={() => setCarouselHovered(true)}
                      onMouseLeave={() => setCarouselHovered(false)}
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
            );
          
          case 'marketInsights':
            return (
              <div key="marketInsights" className="space-y-6">
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
                
                {/* Property Inventory by Subtype and DOM Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Property Inventory by Subtype */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Property Inventory by Type
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {inventoryLoading ? (
                        <Skeleton className="h-48 w-full" />
                      ) : inventoryData && Object.keys(inventoryData.subtypes || {}).length > 0 ? (
                        <div className="space-y-3">
                          {Object.entries(inventoryData.subtypes)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([subtype, count]) => (
                              <div key={subtype} className="flex items-center justify-between">
                                <span className="text-sm">{subtype || 'Unknown'}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary rounded-full" 
                                      style={{ width: `${(count / inventoryData.total) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium w-10 text-right">{count.toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          <div className="pt-2 border-t text-sm text-muted-foreground">
                            Total Active: {inventoryData.total.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="h-48 flex items-center justify-center text-muted-foreground">
                          No inventory data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Days on Market Analytics OR Recent Sold Fallback */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        {domAnalytics && domAnalytics.length > 0 && domAnalytics[0].count > 0 
                          ? 'Days on Market Analytics' 
                          : 'Recent Sold/Closed'}
                        {!domAnalytics?.length && recentSoldData?.personalized && (
                          <Badge variant="secondary" className="text-xs">Personalized</Badge>
                        )}
                      </CardTitle>
                      {!domAnalytics?.length && recentSoldData?.personalized && recentSoldData.filters?.city && (
                        <p className="text-sm text-muted-foreground">
                          Based on your recent activity in {recentSoldData.filters.city}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      {domLoading || recentSoldLoading ? (
                        <Skeleton className="h-48 w-full" />
                      ) : domAnalytics && domAnalytics.length > 0 && domAnalytics[0].count > 0 ? (
                        <div className="space-y-4">
                          {domAnalytics.map((data: DomAnalytics) => (
                            <div key={data.status} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant={data.status === 'Active' ? 'default' : 'secondary'}>
                                  {data.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {data.count.toLocaleString()} properties
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                  <p className="text-2xl font-bold">{Math.round(data.avgDom)}</p>
                                  <p className="text-xs text-muted-foreground">Avg DOM</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold">{Math.round(data.medianDom)}</p>
                                  <p className="text-xs text-muted-foreground">Median DOM</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold">{data.maxDom}</p>
                                  <p className="text-xs text-muted-foreground">Max DOM</p>
                                </div>
                              </div>
                              {data.distribution && (
                                <div className="flex gap-1 h-8">
                                  {Object.entries(data.distribution).map(([range, count]) => (
                                    <Tooltip key={range}>
                                      <TooltipTrigger asChild>
                                        <div 
                                          className="bg-primary/20 hover:bg-primary/40 transition-colors rounded-sm flex-1 cursor-help"
                                          style={{ opacity: Math.max(0.3, count / Math.max(...Object.values(data.distribution))) }}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{range}: {count} properties</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : allRecentSoldProps.length > 0 ? (
                        <div 
                          ref={recentSoldScrollRef}
                          className="space-y-3 max-h-80 overflow-y-auto"
                          onScroll={handleRecentSoldScroll}
                          data-testid="recent-sold-scroll-container"
                        >
                          {allRecentSoldProps.map((prop) => {
                            const pricePerSqft = prop.closePrice && prop.livingArea 
                              ? Number(prop.closePrice) / Number(prop.livingArea) 
                              : null;
                            
                            return (
                              <div 
                                key={prop.id} 
                                className="flex gap-3 p-3 rounded-md border border-red-200 dark:border-red-800 hover-elevate active-elevate-2 cursor-pointer"
                                onClick={() => handlePropertyClick(prop as DashboardProperty)}
                                onKeyDown={(e) => e.key === 'Enter' && handlePropertyClick(prop as DashboardProperty)}
                                tabIndex={0}
                                role="button"
                                data-testid={`recent-sold-${prop.id}`}
                              >
                                {prop.photos && prop.photos.length > 0 ? (
                                  <img src={prop.photos[0]} alt={prop.unparsedAddress || ''} className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                                ) : (
                                  <div className="w-20 h-20 bg-muted rounded-md flex flex-col items-center justify-center flex-shrink-0 p-1">
                                    <Home className="w-5 h-5 text-muted-foreground/50 mb-0.5" />
                                    <span className="text-[8px] text-muted-foreground text-center leading-tight">No photos available</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <p className="font-semibold text-sm truncate max-w-[200px]">{prop.unparsedAddress || 'Unknown Address'}</p>
                                    <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs flex-shrink-0">
                                      Sold
                                    </Badge>
                                  </div>
                                  <p className="text-primary font-bold text-base mt-0.5">
                                    {displaySoldPrice(prop.closePrice)}
                                    {pricePerSqft && (
                                      <span className="text-xs font-normal text-muted-foreground ml-1">
                                        (${pricePerSqft.toFixed(0)}/sqft)
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                    {prop.bedroomsTotal !== null && prop.bedroomsTotal !== undefined && (
                                      <span className="flex items-center gap-0.5"><Bed className="w-3 h-3" /> {prop.bedroomsTotal}</span>
                                    )}
                                    {prop.bathroomsTotalInteger !== null && prop.bathroomsTotalInteger !== undefined && (
                                      <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" /> {prop.bathroomsTotalInteger}</span>
                                    )}
                                    {prop.livingArea && (
                                      <span className="flex items-center gap-0.5"><Maximize className="w-3 h-3" /> {Number(prop.livingArea).toLocaleString()}</span>
                                    )}
                                    {prop.yearBuilt && (
                                      <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {prop.yearBuilt}</span>
                                    )}
                                  </div>
                                  {prop.closeDate && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Closed {new Date(prop.closeDate).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {recentSoldFetching && (
                            <div className="flex justify-center py-2">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            Showing {allRecentSoldProps.length} of {recentSoldData?.total || 0} sold properties
                            {recentSoldData?.hasMore && " (scroll for more)"}
                          </p>
                        </div>
                      ) : (
                        <div className="h-48 flex items-center justify-center text-muted-foreground">
                          No data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          
          case 'recentCmas':
            return (
              <Card key="recentCmas">
                <Collapsible open={recentCmasOpen} onOpenChange={setRecentCmasOpen}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      <CardTitle>Recent CMAs</CardTitle>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Sort:</span>
                        <div className="flex gap-1">
                          {[
                            { value: 'date', label: 'Newest' },
                            { value: 'date-asc', label: 'Oldest' },
                            { value: 'name', label: 'A-Z' },
                            { value: 'name-desc', label: 'Z-A' },
                          ].map((option) => (
                            <Button
                              key={option.value}
                              variant={cmaSortBy === option.value ? 'default' : 'ghost'}
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setCmaSortBy(option.value as 'date' | 'date-asc' | 'name' | 'name-desc')}
                              data-testid={`button-sort-cmas-${option.value}`}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
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
                                    {cma.comparablePropertyIds.length} properties {'\u2022'} Created {new Date(cma.createdAt).toLocaleDateString()}
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
            );
          
          default:
            return null;
        }
      })}
      
      {/* System Status at Bottom */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {systemStatusLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : systemStatus ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${systemStatus.repliersConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-sm font-medium">Repliers API</p>
                  <p className="text-xs text-muted-foreground">{systemStatus.repliersConfigured ? 'Connected' : 'Not Configured'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${systemStatus.mlsGridConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div>
                  <p className="text-sm font-medium">MLS Grid</p>
                  <p className="text-xs text-muted-foreground">{systemStatus.mlsGridConfigured ? 'Connected' : 'Optional'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${systemStatus.mapboxConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div>
                  <p className="text-sm font-medium">Mapbox</p>
                  <p className="text-xs text-muted-foreground">{systemStatus.mapboxConfigured ? 'Connected' : 'Optional'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Last Data Sync</p>
                <p className="text-xs text-muted-foreground">
                  {systemStatus.lastSuccessfulSync 
                    ? new Date(systemStatus.lastSuccessfulSync).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Unable to load system status</p>
          )}
        </CardContent>
      </Card>
      
      <PropertyDetailModal
        property={selectedProperty}
        open={propertyModalOpen}
        onClose={() => setPropertyModalOpen(false)}
      />
    </div>
  );
}
