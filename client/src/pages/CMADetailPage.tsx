import { useState, useEffect, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Share2, Link as LinkIcon, Copy, Check, Trash2, ExternalLink, Printer, Loader2, Mail, LayoutGrid, MapPin, BarChart3, Map, TrendingUp, List, Table as TableIcon, RefreshCw, Save, Edit, FileText, DollarSign, Clock, Home } from "lucide-react";
import { SiFacebook, SiX, SiInstagram, SiTiktok } from "react-icons/si";
import { Link } from "wouter";
import { CMAReport } from "@/components/CMAReport";
import { CMAMapView } from "@/components/cma/CMAMapView";
import { CMAStatsView } from "@/components/cma/CMAStatsView";
import { PropertyDetailModal } from "@/components/cma/PropertyDetailModal";
import { CMAShareDropdown } from "@/components/cma/CMAShareDropdown";
import { CMAExportDropdown } from "@/components/cma/CMAExportDropdown";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, getStatusFromMLS, getStatusHexFromMLS } from "@/lib/statusColors";
import { useTheme } from "@/contexts/ThemeContext";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Cma, Property, PropertyStatistics, TimelineDataPoint } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';

// Initialize Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

// Available metrics for statistics display - keys must match CMAReport's StatMetricKey
export const STAT_METRICS = [
  { key: 'price', label: 'Price' },
  { key: 'pricePerSqFt', label: 'Price/SqFt' },
  { key: 'daysOnMarket', label: 'Days on Market' },
  { key: 'livingArea', label: 'Living SqFt' },
  { key: 'lotSize', label: 'Lot SqFt' },
  { key: 'acres', label: 'Acres' },
  { key: 'bedrooms', label: 'Beds' },
  { key: 'bathrooms', label: 'Baths' },
  { key: 'yearBuilt', label: 'Year Built' },
] as const;

export type StatMetricKey = typeof STAT_METRICS[number]['key'];

interface ShareResponse {
  shareToken: string;
  shareUrl: string;
}

// Helper to format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

// Helper to get photos from property
function getPropertyPhotos(property: Property): string[] {
  const photos = (property as any).photos as string[] | undefined;
  const media = (property as any).media as any[] | undefined;
  if (photos && photos.length > 0) return photos;
  if (media && media.length > 0) {
    return media.map((m: any) => m.mediaURL || m.mediaUrl).filter(Boolean);
  }
  return [];
}

// Helper to get property price
function getPropertyPrice(property: Property): number {
  const isClosed = property.standardStatus === 'Closed';
  return isClosed 
    ? (property.closePrice ? Number(property.closePrice) : Number(property.listPrice || 0))
    : Number(property.listPrice || 0);
}

// Helper to get price per sqft
function getPricePerSqft(property: Property): number {
  const price = getPropertyPrice(property);
  const sqft = property.livingArea ? Number(property.livingArea) : 0;
  return sqft > 0 ? Math.round(price / sqft) : 0;
}

// Helper to get days on market
function getDaysOnMarket(property: Property): number {
  return (property as any).daysOnMarket || (property as any).cumulativeDaysOnMarket || property.daysOnMarket || 0;
}

// Helper to get address
function getPropertyAddress(property: Property): string {
  return property.unparsedAddress || `${property.streetNumber || ''} ${property.streetName || ''}`.trim() || 'Unknown Address';
}

// Grid View Component
function PropertyGrid({ properties, subjectPropertyId, onPropertyClick }: { properties: Property[]; subjectPropertyId?: string | null; onPropertyClick?: (property: Property) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => {
        const photos = getPropertyPhotos(property);
        const price = getPropertyPrice(property);
        const isSubject = property.id === subjectPropertyId;
        const statusKey = getStatusFromMLS(property.standardStatus || 'Active', isSubject);
        const statusColors = STATUS_COLORS[statusKey];
        
        return (
          <Card 
            key={property.id} 
            className={cn(
              "overflow-hidden overflow-visible cursor-pointer hover-elevate active-elevate-2 transition-colors",
              isSubject && "ring-2 ring-blue-500"
            )}
            onClick={() => onPropertyClick?.(property)}
            data-testid={`card-property-${property.id}`}
          >
            <div className="aspect-video bg-muted relative">
              {photos[0] ? (
                <img 
                  src={photos[0]} 
                  alt={getPropertyAddress(property)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Home className="w-8 h-8" />
                </div>
              )}
              <span 
                className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium text-white"
                style={{ backgroundColor: statusColors.hex }}
              >
                {isSubject ? 'SUBJECT' : property.standardStatus}
              </span>
            </div>
            
            <CardContent className="p-4">
              <p className="font-semibold text-lg">{formatCurrency(price)}</p>
              <p className="text-sm text-muted-foreground truncate">{getPropertyAddress(property)}</p>
              <p className="text-sm">
                {property.bedroomsTotal || 0} bd • {property.bathroomsTotalInteger || 0} ba • {property.livingArea ? Number(property.livingArea).toLocaleString() : 0} sqft
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ${getPricePerSqft(property)}/sqft • {getDaysOnMarket(property)} DOM
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// List View Component
function PropertyList({ properties, subjectPropertyId, onPropertyClick }: { properties: Property[]; subjectPropertyId?: string | null; onPropertyClick?: (property: Property) => void }) {
  return (
    <div className="space-y-3">
      {properties.map((property) => {
        const photos = getPropertyPhotos(property);
        const price = getPropertyPrice(property);
        const isSubject = property.id === subjectPropertyId;
        const statusKey = getStatusFromMLS(property.standardStatus || 'Active', isSubject);
        const statusColors = STATUS_COLORS[statusKey];
        
        return (
          <div 
            key={property.id}
            className={cn(
              "flex gap-4 p-4 border rounded-lg cursor-pointer hover-elevate active-elevate-2 transition-colors",
              isSubject && "ring-2 ring-blue-500"
            )}
            onClick={() => onPropertyClick?.(property)}
            data-testid={`list-property-${property.id}`}
          >
            <div className="w-32 h-24 bg-muted rounded overflow-hidden flex-shrink-0">
              {photos[0] ? (
                <img 
                  src={photos[0]} 
                  alt={getPropertyAddress(property)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Home className="w-6 h-6" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{formatCurrency(price)}</p>
                <span 
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: statusColors.hex }}
                >
                  {isSubject ? 'SUBJECT' : property.standardStatus}
                </span>
              </div>
              <p className="text-sm truncate">{getPropertyAddress(property)}</p>
              <p className="text-sm text-muted-foreground">
                {property.bedroomsTotal || 0} bd • {property.bathroomsTotalInteger || 0} ba • {property.livingArea ? Number(property.livingArea).toLocaleString() : 0} sqft
              </p>
            </div>
            
            <div className="text-right text-sm">
              <p>${getPricePerSqft(property)}/sqft</p>
              <p className="text-muted-foreground">{getDaysOnMarket(property)} DOM</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper function to get coordinates from property (tries multiple field paths)
function getPropertyCoordinates(property: any): [number, number] | null {
  // Try multiple possible coordinate sources
  const lat = property?.latitude 
    || property?.map?.latitude 
    || property?.coordinates?.latitude 
    || property?.address?.latitude
    || (property?.geo?.lat);
  const lng = property?.longitude 
    || property?.map?.longitude 
    || property?.coordinates?.longitude 
    || property?.address?.longitude
    || (property?.geo?.lng);
  
  if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
    return [Number(lng), Number(lat)]; // Mapbox uses [lng, lat]
  }
  return null;
}

export default function CMADetailPage() {
  const [, params] = useRoute("/cmas/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailShareDialogOpen, setEmailShareDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Email share form state
  const [emailForm, setEmailForm] = useState({
    yourName: '',
    yourEmail: '',
    friendName: '',
    friendEmail: '',
    comments: 'Check out this CMA report I created for you.',
  });
  
  // Visible metrics state - all enabled by default
  const [visibleMetrics, setVisibleMetrics] = useState<StatMetricKey[]>(
    STAT_METRICS.map(m => m.key)
  );
  
  // View state for comparables section
  const [comparableView, setComparableView] = useState<'compare' | 'map' | 'stats'>('compare');
  const [listView, setListView] = useState<'grid' | 'list' | 'table'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Property detail modal state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property);
  };
  
  const handleClosePropertyModal = () => {
    setSelectedProperty(null);
  };
  
  const toggleMetric = (key: StatMetricKey) => {
    setVisibleMetrics(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const { data: cma, isLoading: cmaLoading, refetch: refetchCma } = useQuery<Cma>({
    queryKey: ['/api/cmas', id],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}`);
      if (!response.ok) throw new Error('Failed to fetch CMA');
      return response.json();
    },
  });

  const { data: statistics, isLoading: statsLoading } = useQuery<PropertyStatistics>({
    queryKey: ['/api/cmas', id, 'statistics'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/statistics`);
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    },
  });

  const { data: timelineData = [], isLoading: timelineLoading } = useQuery<TimelineDataPoint[]>({
    queryKey: ['/api/cmas', id, 'timeline'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/timeline`);
      if (!response.ok) throw new Error('Failed to fetch timeline');
      return response.json();
    },
  });


  const shareMutation = useMutation<ShareResponse>({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to generate share link');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      toast({
        title: "Share link generated",
        description: "Your CMA is now shareable via the link.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate share link.",
        variant: "destructive",
      });
    },
  });

  const unshareMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${id}/share`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove share link');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      setShareDialogOpen(false);
      toast({
        title: "Share link removed",
        description: "This CMA is no longer publicly accessible.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove share link.",
        variant: "destructive",
      });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await fetch(`/api/cmas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!response.ok) throw new Error('Failed to update notes');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      setNotesDialogOpen(false);
      toast({
        title: "Notes saved",
        description: "Your notes have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notes.",
        variant: "destructive",
      });
    },
  });

  const properties: Property[] = cma ? ((cma as any).propertiesData || []) : [];
  const subjectProperty = cma?.subjectPropertyId 
    ? properties.find((p: Property) => p.id === cma.subjectPropertyId) || null
    : null;

  // Sync notes state when CMA loads
  const handleOpenNotesDialog = () => {
    setNotes(cma?.notes || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  const handleSave = () => {
    // CMA is already saved - just show confirmation
    toast({
      title: "CMA Saved",
      description: "Your CMA has been saved successfully.",
    });
  };

  const [emailFallbackUrl, setEmailFallbackUrl] = useState<string | null>(null);
  
  const emailShareMutation = useMutation({
    mutationFn: async (data: typeof emailForm) => {
      // First ensure we have a public link
      if (!cma?.publicLink) {
        await shareMutation.mutateAsync();
      }
      // Then send the email
      const response = await fetch(`/api/cmas/${id}/email-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: data.yourName,
          senderEmail: data.yourEmail,
          recipientName: data.friendName,
          recipientEmail: data.friendEmail,
          message: data.comments,
        }),
      });
      if (!response.ok) throw new Error('Failed to send email');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        setEmailShareDialogOpen(false);
        toast({
          title: "CMA Shared",
          description: "Your CMA has been sent via email.",
        });
        setEmailFallbackUrl(null);
      } else {
        // Email service not configured - show fallback with URL
        setEmailFallbackUrl(data.shareUrl);
        toast({
          title: "Email Not Sent",
          description: data.message,
          variant: "destructive",
        });
      }
      // Reset form
      setEmailForm({
        yourName: '',
        yourEmail: '',
        friendName: '',
        friendEmail: '',
        comments: 'Check out this CMA report I created for you.',
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEmailShare = () => {
    // Validate form
    if (!emailForm.yourName || !emailForm.yourEmail || !emailForm.friendName || !emailForm.friendEmail) {
      toast({
        title: "Required fields missing",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    emailShareMutation.mutate(emailForm);
  };

  const handleModifySearch = () => {
    // Navigate to CMA builder with current CMA data pre-loaded
    setLocation(`/cmas/new?from=${id}`);
  };

  const handleModifyStats = () => {
    setStatsDialogOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRefreshMLS = async () => {
    setIsRefreshing(true);
    try {
      await refetchCma();
      toast({
        title: "MLS Data Refreshed",
        description: "Property data has been updated.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh MLS data.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateClientEmail = () => {
    if (!cma || !statistics) return '';
    
    const propertiesData = (cma as any).propertiesData || [];
    const compCount = propertiesData.length;
    
    const subjectProperty = cma.subjectPropertyId 
      ? propertiesData.find((p: Property) => p.id === cma.subjectPropertyId)
      : null;
    
    const subjectAddress = subjectProperty?.unparsedAddress || cma.name || 'your property';
    const subdivision = (cma.searchCriteria as any)?.subdivisionName || 
                        (cma.searchCriteria as any)?.subdivision ||
                        subjectProperty?.subdivision ||
                        (cma.searchCriteria as any)?.city || 
                        'your area';
    
    const soldWithinDays = (cma.searchCriteria as any)?.soldWithinDays;
    const timeframe = soldWithinDays 
      ? `last ${soldWithinDays} days`
      : 'last 6 months';
    
    const priceMin = statistics.price?.range?.min 
      ? `$${Math.round(statistics.price.range.min).toLocaleString()}`
      : 'N/A';
    const priceMax = statistics.price?.range?.max
      ? `$${Math.round(statistics.price.range.max).toLocaleString()}`
      : 'N/A';
    const avgPricePerSqFt = statistics.pricePerSqFt?.average
      ? `$${Math.round(statistics.pricePerSqFt.average)}`
      : 'N/A';
    const avgDOM = statistics.daysOnMarket?.average
      ? `${Math.round(statistics.daysOnMarket.average)}`
      : 'N/A';
    
    const subjectSqFt = subjectProperty?.livingArea 
      ? Number(subjectProperty.livingArea).toLocaleString()
      : (statistics.livingArea?.average ? Math.round(statistics.livingArea.average).toLocaleString() : 'comparable homes');
    
    const lowEstimate = statistics.price?.range?.min && statistics.price?.average
      ? `$${Math.round((statistics.price.range.min + statistics.price.average) / 2).toLocaleString()}`
      : priceMin;
    const highEstimate = statistics.price?.range?.max && statistics.price?.average
      ? `$${Math.round((statistics.price.average + statistics.price.range.max) / 2).toLocaleString()}`
      : priceMax;
    
    const medianDOM = statistics.daysOnMarket?.median 
      ? Math.round(statistics.daysOnMarket.median)
      : null;
    const domInsight = medianDOM 
      ? (medianDOM < 14 
          ? `Properties priced right are going under contract in under ${medianDOM} days`
          : `Typical time to contract is around ${medianDOM} days`)
      : 'Market activity is steady';
    
    const pricePerSqFtInsight = avgPricePerSqFt !== 'N/A'
      ? `Comparable homes are averaging ${avgPricePerSqFt}/sq ft`
      : '';

    const email = `Subject: Market Analysis for ${subjectAddress}

---

Hi there,

I put together a market analysis for your home based on recent activity in ${subdivision}. Here's what the data is showing:

**Comparable Sales Summary**
- Properties Analyzed: ${compCount} homes in ${subdivision} (${timeframe})
- Price Range: ${priceMin} – ${priceMax}
- Average Price/Sq Ft: ${avgPricePerSqFt}
- Average Days on Market: ${avgDOM} days

Based on your home's size (${subjectSqFt} sq ft) and features, the data suggests a competitive list price in the ${lowEstimate} – ${highEstimate} range.

A few things worth noting:
- ${pricePerSqFtInsight || 'Market conditions support pricing in this range'}
- ${domInsight}
- Well-priced homes are attracting strong buyer interest

I'd love to walk you through the full analysis and talk through your timing and goals. Want to grab 15 minutes this week?

Best regards`;

    return email;
  };

  const handleCopyClientEmail = async () => {
    const emailContent = generateClientEmail();
    if (!emailContent) {
      toast({
        title: "Unable to generate email",
        description: "CMA data is not available.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(emailContent);
      toast({
        title: "Email copied",
        description: "Paste into Follow Up Boss to send to your client.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const isLoading = cmaLoading || statsLoading || timelineLoading;

  const getShareUrl = () => {
    if (!cma?.publicLink) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/cma/${cma.publicLink}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied",
      description: "Share link copied to clipboard.",
    });
  };

  const mockStatistics: PropertyStatistics = {
    price: {
      range: { min: 371000, max: 710000 },
      average: 508577,
      median: 519500,
    },
    pricePerSqFt: {
      range: { min: 268.23, max: 503.06 },
      average: 406.53,
      median: 406.7,
    },
    daysOnMarket: {
      range: { min: 2, max: 139 },
      average: 37,
      median: 25,
    },
    livingArea: {
      range: { min: 1045, max: 1474 },
      average: 1263,
      median: 1296,
    },
    lotSize: {
      range: { min: 3816, max: 11609 },
      average: 8923,
      median: 8494,
    },
    acres: {
      range: { min: 0.09, max: 0.27 },
      average: 0.2,
      median: 0.2,
    },
    bedrooms: {
      range: { min: 3, max: 4 },
      average: 3,
      median: 3,
    },
    bathrooms: {
      range: { min: 1, max: 2 },
      average: 2,
      median: 2,
    },
    yearBuilt: {
      range: { min: 1953, max: 2018 },
      average: 1964,
      median: 1959,
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!cma) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">CMA not found</h2>
        <Link href="/cmas">
          <Button variant="outline">Back to CMAs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 cma-print">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <Link href="/cmas">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cmas">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to CMAs
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-cma-title">{cma.name}</h1>
          {cma.publicLink && (
            <Badge variant="secondary" className="mt-2">
              <LinkIcon className="w-3 h-3 mr-1" />
              Shared
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CMAShareDropdown 
            cma={cma} 
            statistics={statistics ?? null} 
            onRefetch={refetchCma}
          />
          <CMAExportDropdown 
            cma={cma}
          />
          <Button 
            variant="outline" 
            onClick={() => setLocation(`/cmas/${id}/presentation`)}
            data-testid="button-presentation-builder"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Presentation
          </Button>
        </div>
      </div>

      {/* Comparable Properties Card - Clean Design */}
      <Card className="overflow-hidden print:hidden">
        <CardContent className="p-6">
          {/* Header with title, count, and view toggle on the right */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            {/* Left side - Title and count */}
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold" data-testid="text-comparable-title">Comparable Properties</h2>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground" data-testid="text-property-count">{properties.length} properties</span>
            </div>
            
            {/* Right side - View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={comparableView === 'compare' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setComparableView('compare')}
                className={comparableView === 'compare' ? 'shadow-sm' : ''}
                data-testid="button-view-compare"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                Compare
              </Button>
              <Button
                variant={comparableView === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setComparableView('map')}
                className={comparableView === 'map' ? 'shadow-sm' : ''}
                data-testid="button-view-map"
              >
                <Map className="w-4 h-4 mr-1" />
                Map
              </Button>
              <Button
                variant={comparableView === 'stats' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setComparableView('stats')}
                className={comparableView === 'stats' ? 'shadow-sm' : ''}
                data-testid="button-view-stats"
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Stats
              </Button>
            </div>
          </div>
          
          {/* Status Filter Tabs - using Badge components */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {['All', 'Closed', 'Active Under Contract', 'Pending', 'Active'].map((status) => (
              <Badge
                key={status}
                variant={statusFilter === status ? 'default' : 'secondary'}
                className="cursor-pointer"
                onClick={() => setStatusFilter(status)}
                data-testid={`button-status-${status.toLowerCase().replace(/ /g, '-')}`}
              >
                {status}
              </Badge>
            ))}
          </div>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Low Price</p>
              <p className="text-lg font-semibold" data-testid="stat-low-price">
                {statistics?.price?.range?.min 
                  ? `$${Math.round(statistics.price.range.min).toLocaleString()}`
                  : 'N/A'}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">High Price</p>
              <p className="text-lg font-semibold" data-testid="stat-high-price">
                {statistics?.price?.range?.max
                  ? `$${Math.round(statistics.price.range.max).toLocaleString()}`
                  : 'N/A'}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Price</p>
              <p className="text-lg font-semibold" data-testid="stat-avg-price">
                {statistics?.price?.average
                  ? `$${Math.round(statistics.price.average).toLocaleString()}`
                  : 'N/A'}
              </p>
              {/* Market comparison indicator - shows when data available */}
              {statistics?.price?.average && statistics?.price?.median && (
                <p className={`text-xs flex items-center gap-1 ${
                  statistics.price.average > statistics.price.median ? 'text-green-600' : 'text-red-600'
                }`} data-testid="stat-market-comparison">
                  {statistics.price.average > statistics.price.median ? '↗' : '↘'} 
                  {Math.abs(((statistics.price.average - statistics.price.median) / statistics.price.median) * 100).toFixed(1)}% vs median
                </p>
              )}
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Median</p>
              <p className="text-lg font-semibold" data-testid="stat-median">
                {statistics?.price?.median
                  ? `$${Math.round(statistics.price.median).toLocaleString()}`
                  : 'N/A'}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg $/Sqft</p>
              <p className="text-lg font-semibold" data-testid="stat-avg-price-sqft">
                {statistics?.pricePerSqFt?.average
                  ? `$${Math.round(statistics.pricePerSqFt.average)}`
                  : 'N/A'}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg DOM</p>
              <p className="text-lg font-semibold" data-testid="stat-avg-dom">
                {statistics?.daysOnMarket?.average
                  ? `${Math.round(statistics.daysOnMarket.average)} Days`
                  : 'N/A'}
              </p>
            </div>
          </div>
          
          {/* View Mode Toggle - only show for Compare view */}
          {comparableView === 'compare' && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">View:</span>
              <div className="flex items-center border rounded-lg overflow-visible">
                <Button
                  variant={listView === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setListView('grid')}
                  className="rounded-r-none"
                  data-testid="button-list-grid"
                >
                  <LayoutGrid className="w-4 h-4 mr-1" />
                  Grid
                </Button>
                <Button
                  variant={listView === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setListView('list')}
                  className="rounded-none border-l"
                  data-testid="button-list-list"
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={listView === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setListView('table')}
                  className="rounded-l-none border-l"
                  data-testid="button-list-table"
                >
                  <TableIcon className="w-4 h-4 mr-1" />
                  Table
                </Button>
              </div>
            </div>
          )}
          
          {/* Property Display - Conditional rendering based on view mode */}
          <div className="mt-4">
            {/* Compare View - Grid, List, or Table */}
            {comparableView === 'compare' && (
              <>
                {listView === 'grid' && (
                  <PropertyGrid 
                    properties={statusFilter === 'All' ? properties : properties.filter(p => p.standardStatus === statusFilter)} 
                    subjectPropertyId={cma.subjectPropertyId}
                    onPropertyClick={handlePropertyClick}
                  />
                )}
                {listView === 'list' && (
                  <PropertyList 
                    properties={statusFilter === 'All' ? properties : properties.filter(p => p.standardStatus === statusFilter)} 
                    subjectPropertyId={cma.subjectPropertyId}
                    onPropertyClick={handlePropertyClick}
                  />
                )}
                {listView === 'table' && (
                  <CMAReport
                    properties={properties}
                    statistics={statistics || mockStatistics}
                    timelineData={timelineData}
                    isPreview={true}
                    expiresAt={cma.expiresAt ? new Date(cma.expiresAt) : new Date(Date.now() + 30 * 60 * 1000)}
                    visibleMetrics={visibleMetrics}
                    notes={cma.notes}
                    reportTitle={cma.name}
                    subjectPropertyId={cma.subjectPropertyId}
                    onSave={handleSave}
                    onShareCMA={() => setEmailShareDialogOpen(true)}
                    onPublicLink={async () => {
                      try {
                        let shareUrl: string;
                        if (cma?.publicLink) {
                          shareUrl = `${window.location.origin}/share/cma/${cma.publicLink}`;
                        } else {
                          const result = await shareMutation.mutateAsync();
                          shareUrl = `${window.location.origin}/share/cma/${result.shareToken}`;
                        }
                        await navigator.clipboard.writeText(shareUrl);
                        toast({
                          title: "URL copied to clipboard",
                          description: shareUrl,
                        });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to generate or copy share URL",
                          variant: "destructive",
                        });
                      }
                    }}
                    onModifySearch={handleModifySearch}
                    onModifyStats={handleModifyStats}
                    onAddNotes={handleOpenNotesDialog}
                    onPrint={handlePrint}
                    onPropertyClick={handlePropertyClick}
                  />
                )}
              </>
            )}
            
            {/* Map View */}
            {comparableView === 'map' && (
              <CMAMapView 
                properties={statusFilter === 'All' ? properties : properties.filter(p => p.standardStatus === statusFilter)} 
                subjectProperty={subjectProperty}
                onPropertyClick={handlePropertyClick}
              />
            )}
            
            {/* Stats View */}
            {comparableView === 'stats' && (
              <CMAStatsView 
                properties={statusFilter === 'All' ? properties : properties.filter(p => p.standardStatus === statusFilter)} 
                subjectProperty={subjectProperty}
                onPropertyClick={handlePropertyClick}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent Notes</DialogTitle>
            <DialogDescription>
              Add commentary or notes about this CMA for your client.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="notes">Your Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter your notes or commentary about this CMA..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="mt-2"
              data-testid="textarea-notes"
            />
            <p className="text-xs text-muted-foreground">
              These notes will appear on the shared CMA report and PDF.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveNotes}
              disabled={updateNotesMutation.isPending}
              data-testid="button-save-notes"
            >
              {updateNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Visibility Dialog */}
      <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Statistics</DialogTitle>
            <DialogDescription>
              Choose which metrics to show in the Home Averages tab.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {STAT_METRICS.map((metric) => (
              <div key={metric.key} className="flex items-center space-x-3">
                <Checkbox
                  id={`metric-${metric.key}`}
                  checked={visibleMetrics.includes(metric.key)}
                  onCheckedChange={() => toggleMetric(metric.key)}
                  data-testid={`checkbox-metric-${metric.key}`}
                />
                <Label htmlFor={`metric-${metric.key}`} className="cursor-pointer">
                  {metric.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setVisibleMetrics(STAT_METRICS.map(m => m.key))}
              data-testid="button-reset-stats"
            >
              Show All
            </Button>
            <Button 
              onClick={() => setStatsDialogOpen(false)}
              data-testid="button-apply-stats"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Share CMA Dialog */}
      <Dialog open={emailShareDialogOpen} onOpenChange={setEmailShareDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email CMA to a Friend</DialogTitle>
            <DialogDescription>
              Share this CMA report with your client via email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="your-name">Your Name *</Label>
                <Input
                  id="your-name"
                  placeholder="Your Name"
                  value={emailForm.yourName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, yourName: e.target.value }))}
                  data-testid="input-your-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="friend-name">Friend's Name *</Label>
                <Input
                  id="friend-name"
                  placeholder="Friend's Name"
                  value={emailForm.friendName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, friendName: e.target.value }))}
                  data-testid="input-friend-name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="your-email">Your Email Address *</Label>
                <Input
                  id="your-email"
                  type="email"
                  placeholder="name@website.com"
                  value={emailForm.yourEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, yourEmail: e.target.value }))}
                  data-testid="input-your-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="friend-email">Friend's Email Address *</Label>
                <Input
                  id="friend-email"
                  type="email"
                  placeholder="name@website.com"
                  value={emailForm.friendEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, friendEmail: e.target.value }))}
                  data-testid="input-friend-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                placeholder="Add a personal message..."
                value={emailForm.comments}
                onChange={(e) => setEmailForm(prev => ({ ...prev, comments: e.target.value }))}
                rows={3}
                data-testid="textarea-email-comments"
              />
            </div>
            {emailFallbackUrl && (
              <div className="p-3 bg-muted rounded-md space-y-2">
                <p className="text-sm text-muted-foreground">
                  Email service not configured. Share this link manually:
                </p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={emailFallbackUrl} 
                    readOnly 
                    className="text-xs"
                    data-testid="input-fallback-share-url"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(emailFallbackUrl);
                      toast({ title: "Copied!", description: "Link copied to clipboard." });
                    }}
                    data-testid="button-copy-fallback-url"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEmailShare}
              disabled={emailShareMutation.isPending}
              data-testid="button-send-email-share"
            >
              {emailShareMutation.isPending ? 'Sending...' : 'Share'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Property Detail Modal */}
      <PropertyDetailModal 
        property={selectedProperty}
        subjectProperty={subjectProperty}
        isOpen={!!selectedProperty}
        onClose={handleClosePropertyModal}
      />
    </div>
  );
}
