import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine, ScatterChart, Scatter, ZAxis, Cell } from "recharts";
import { Save, Edit, FileText, Printer, Info, Home, Mail, ChevronLeft, ChevronRight, Bed, Bath, Maximize, MapPin, Calendar, Map as MapIcon, ExternalLink, DollarSign, TrendingUp, Target, Zap, Clock, BarChart3 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Property, PropertyStatistics, TimelineDataPoint, Media } from "@shared/schema";
import { isLikelyRentalProperty, filterOutRentalProperties } from "@shared/schema";

// Component to fit map bounds to markers
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(pos => L.latLng(pos[0], pos[1])));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
}

// Custom marker icon for subject property
const subjectIcon = new L.DivIcon({
  html: '<div style="background-color:#ef4444;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
  className: 'custom-div-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Custom marker icon for comp properties based on status
const getCompIcon = (status: string) => {
  const statusLower = (status || '').toLowerCase();
  let borderColor = '#22c55e'; // green for active
  let bgColor = 'rgba(34, 197, 94, 0.15)'; // light green background
  
  // Check for sold/closed status
  if (statusLower === 'closed' || statusLower === 'sold') {
    borderColor = '#6b7280'; // gray for sold
    bgColor = 'rgba(107, 114, 128, 0.15)';
  } 
  // Check for pending/under contract status (including variants like "Active Under Contract - Showing")
  else if (
    statusLower.includes('under contract') || 
    statusLower.includes('pending') || 
    statusLower.includes('in contract') ||
    statusLower.includes('contingent')
  ) {
    borderColor = '#f59e0b'; // orange for under contract/pending
    bgColor = 'rgba(245, 158, 11, 0.15)';
  }
  
  return new L.DivIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background-color:${bgColor};border:3px solid ${borderColor};border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:18px;">🏠</div>`,
    className: 'custom-house-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Price label marker icon - shows price directly on map
const getPriceMarkerIcon = (price: number, status: string) => {
  const statusLower = (status || '').toLowerCase();
  let bgColor = '#22c55e'; // green for active
  let textColor = '#ffffff';
  
  if (statusLower === 'closed' || statusLower === 'sold') {
    bgColor = '#6b7280'; // gray for sold
  } else if (
    statusLower.includes('under contract') || 
    statusLower.includes('pending') || 
    statusLower.includes('in contract') ||
    statusLower.includes('contingent')
  ) {
    bgColor = '#f59e0b'; // orange for under contract/pending
  }
  
  // Format price to compact form (e.g., $525K or $1.2M)
  const formatCompactPrice = (p: number) => {
    if (p >= 1000000) {
      return `$${(p / 1000000).toFixed(1)}M`;
    }
    return `$${Math.round(p / 1000)}K`;
  };
  
  const priceLabel = formatCompactPrice(price);
  
  return new L.DivIcon({
    html: `<div style="
      display:inline-block;
      padding:4px 8px;
      background-color:${bgColor};
      color:${textColor};
      font-size:11px;
      font-weight:600;
      border-radius:4px;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      white-space:nowrap;
      border:2px solid white;
    ">${priceLabel}</div>`,
    className: 'price-marker-icon',
    iconSize: [60, 24],
    iconAnchor: [30, 24],
    popupAnchor: [0, -24],
  });
};

type StatMetricKey = 'price' | 'pricePerSqFt' | 'daysOnMarket' | 'livingArea' | 'lotSize' | 'acres' | 'bedrooms' | 'bathrooms' | 'yearBuilt';

interface CMAReportProps {
  properties: Property[];
  statistics: PropertyStatistics;
  timelineData: TimelineDataPoint[];
  isPreview?: boolean;
  expiresAt?: Date;
  visibleMetrics?: StatMetricKey[];
  notes?: string | null;
  reportTitle?: string;
  onSave?: () => void;
  onShareCMA?: () => void;
  onPublicLink?: () => void;
  onModifySearch?: () => void;
  onModifyStats?: () => void;
  onAddNotes?: () => void;
  onPrint?: () => void;
}

const ALL_METRICS: StatMetricKey[] = ['price', 'pricePerSqFt', 'daysOnMarket', 'livingArea', 'lotSize', 'acres', 'bedrooms', 'bathrooms', 'yearBuilt'];

export function CMAReport({ 
  properties, 
  statistics, 
  timelineData, 
  isPreview,
  expiresAt,
  visibleMetrics = ALL_METRICS,
  notes,
  reportTitle,
  onSave,
  onShareCMA,
  onPublicLink,
  onModifySearch,
  onModifyStats,
  onAddNotes,
  onPrint
}: CMAReportProps) {
  const [activeTab, setActiveTab] = useState("home-averages");
  const [activeListingTab, setActiveListingTab] = useState("all");
  
  // Property exclusion state for Include All/Exclude All functionality
  const [excludedPropertyIds, setExcludedPropertyIds] = useState<Set<string>>(new Set());
  
  // Property notes state for Notes & Adjustments
  const [propertyNotes, setPropertyNotes] = useState<Record<string, string>>({});
  
  // Floating card state
  const [floatingCardOpen, setFloatingCardOpen] = useState(false);
  const [floatingCardProperty, setFloatingCardProperty] = useState<Property | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Timeline status filters
  const [showActiveOnTimeline, setShowActiveOnTimeline] = useState(true);
  const [showUnderContractOnTimeline, setShowUnderContractOnTimeline] = useState(true);
  const [showSoldOnTimeline, setShowSoldOnTimeline] = useState(true);
  
  // Helper to get photos from property
  const getPropertyPhotos = (property: Property): string[] => {
    const photos = (property as any).photos as string[] | undefined;
    const media = (property as any).media as any[] | undefined;
    if (photos && photos.length > 0) return photos;
    if (media && media.length > 0) {
      return media.map((m: any) => m.mediaURL || m.mediaUrl).filter(Boolean);
    }
    return [];
  };
  
  // Handle property click to open floating card
  const handlePropertyClick = (property: Property) => {
    setFloatingCardProperty(property);
    setCarouselIndex(0);
    setFloatingCardOpen(true);
  };
  
  // Carousel auto-advance
  useEffect(() => {
    if (autoAdvanceRef.current) {
      clearInterval(autoAdvanceRef.current);
    }
    
    if (floatingCardProperty && floatingCardOpen) {
      const photos = getPropertyPhotos(floatingCardProperty);
      if (photos.length > 1) {
        autoAdvanceRef.current = setInterval(() => {
          setCarouselIndex((prev) => (prev + 1) % photos.length);
        }, 3000);
      }
    }
    
    return () => {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
      }
    };
  }, [floatingCardProperty, floatingCardOpen]);
  
  const handlePrevImage = () => {
    if (!floatingCardProperty) return;
    const photos = getPropertyPhotos(floatingCardProperty);
    if (photos.length > 1) {
      setCarouselIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };
  
  const handleNextImage = () => {
    if (!floatingCardProperty) return;
    const photos = getPropertyPhotos(floatingCardProperty);
    if (photos.length > 1) {
      setCarouselIndex((prev) => (prev + 1) % photos.length);
    }
  };

  // Group properties by status, filtering out rentals from sold properties
  // Uses shared rental detection logic from @shared/schema
  const allProperties = properties;
  const closedProperties = properties.filter(p => p.standardStatus === 'Closed');
  const soldProperties = filterOutRentalProperties(closedProperties);
  const rentalProperties = closedProperties.filter(p => isLikelyRentalProperty(p));
  const underContractProperties = properties.filter(p => p.standardStatus === 'Active Under Contract');
  const activeProperties = properties.filter(p => p.standardStatus === 'Active');
  
  // Log filtered rentals for debugging
  if (rentalProperties.length > 0) {
    console.log(`CMAReport: Filtered ${rentalProperties.length} rental properties from Sold section:`, 
      rentalProperties.map(p => `${p.unparsedAddress}: $${Number(p.closePrice).toLocaleString()}`));
  }

  // Compute filtered counts based on excluded properties
  const includedAll = useMemo(() => allProperties.filter(p => !excludedPropertyIds.has(p.id)), [allProperties, excludedPropertyIds]);
  const includedSold = useMemo(() => soldProperties.filter(p => !excludedPropertyIds.has(p.id)), [soldProperties, excludedPropertyIds]);
  const includedActive = useMemo(() => activeProperties.filter(p => !excludedPropertyIds.has(p.id)), [activeProperties, excludedPropertyIds]);
  const includedUnderContract = useMemo(() => underContractProperties.filter(p => !excludedPropertyIds.has(p.id)), [underContractProperties, excludedPropertyIds]);

  // Compute filtered statistics based on excluded properties
  const filteredStatistics = useMemo(() => {
    const includedProperties = properties.filter(p => !excludedPropertyIds.has(p.id));
    
    if (includedProperties.length === 0) {
      // Return zeros if all properties are excluded
      return {
        price: { average: 0, median: 0, range: { min: 0, max: 0 } },
        pricePerSqFt: { average: 0, median: 0, range: { min: 0, max: 0 } },
        daysOnMarket: { average: 0, median: 0, range: { min: 0, max: 0 } },
        livingArea: { average: 0, median: 0, range: { min: 0, max: 0 } },
        lotSize: { average: 0, median: 0, range: { min: 0, max: 0 } },
        acres: { average: 0, median: 0, range: { min: 0, max: 0 } },
        bedrooms: { average: 0, median: 0, range: { min: 0, max: 0 } },
        bathrooms: { average: 0, median: 0, range: { min: 0, max: 0 } },
        yearBuilt: { average: 0, median: 0, range: { min: 0, max: 0 } },
      };
    }

    const computeStats = (values: number[]) => {
      const filtered = values.filter(v => v > 0);
      if (filtered.length === 0) {
        return { average: 0, median: 0, range: { min: 0, max: 0 } };
      }
      const sorted = [...filtered].sort((a, b) => a - b);
      const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
      return {
        average,
        median,
        range: { min: sorted[0], max: sorted[sorted.length - 1] }
      };
    };

    const prices = includedProperties.map(p => {
      const isClosed = p.standardStatus === 'Closed';
      return isClosed 
        ? (p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0))
        : Number(p.listPrice || 0);
    });
    
    const pricesPerSqFt = includedProperties
      .filter(p => p.livingArea && Number(p.livingArea) > 0)
      .map(p => {
        const isClosed = p.standardStatus === 'Closed';
        const price = isClosed 
          ? (p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0))
          : Number(p.listPrice || 0);
        return price / Number(p.livingArea);
      });

    return {
      price: computeStats(prices),
      pricePerSqFt: computeStats(pricesPerSqFt),
      daysOnMarket: computeStats(includedProperties.map(p => p.daysOnMarket || 0)),
      livingArea: computeStats(includedProperties.map(p => Number(p.livingArea || 0))),
      lotSize: computeStats(includedProperties.map(p => Number(p.lotSizeSquareFeet || 0))),
      acres: computeStats(includedProperties.map(p => Number(p.lotSizeAcres || 0))),
      bedrooms: computeStats(includedProperties.map(p => p.bedroomsTotal || 0)),
      bathrooms: computeStats(includedProperties.map(p => p.bathroomsTotalInteger || 0)),
      yearBuilt: computeStats(includedProperties.map(p => p.yearBuilt || 0)),
    };
  }, [properties, excludedPropertyIds]);

  // Dynamic pricing suggestion calculation based on market trends
  const pricingSuggestion = useMemo(() => {
    // Get included sold properties for analysis
    const soldForAnalysis = soldProperties.filter(p => !excludedPropertyIds.has(p.id));
    
    if (soldForAnalysis.length < 2) {
      return null; // Need at least 2 sold properties for analysis
    }

    // Calculate base metrics from sold properties
    const soldPrices = soldForAnalysis
      .map(p => p.closePrice ? Number(p.closePrice) : 0)
      .filter(price => price > 0);
    
    const soldPricesPerSqFt = soldForAnalysis
      .filter(p => p.livingArea && Number(p.livingArea) > 0 && p.closePrice)
      .map(p => Number(p.closePrice) / Number(p.livingArea));

    if (soldPrices.length === 0) return null;

    // Calculate average price per sqft
    const avgPricePerSqFt = soldPricesPerSqFt.length > 0 
      ? soldPricesPerSqFt.reduce((a, b) => a + b, 0) / soldPricesPerSqFt.length 
      : 0;

    // Calculate market trend adjustment based on recent sales
    let marketTrendAdjustment = 0;
    const soldWithDates = soldForAnalysis.filter(p => p.closeDate && p.closePrice);
    
    if (soldWithDates.length >= 3) {
      // Sort by close date
      const sortedByDate = [...soldWithDates].sort((a, b) => 
        new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime()
      );
      
      // Compare first half vs second half average prices
      const midpoint = Math.floor(sortedByDate.length / 2);
      const earlyHalf = sortedByDate.slice(0, midpoint);
      const lateHalf = sortedByDate.slice(midpoint);
      
      const earlyAvg = earlyHalf.reduce((sum, p) => sum + Number(p.closePrice), 0) / earlyHalf.length;
      const lateAvg = lateHalf.reduce((sum, p) => sum + Number(p.closePrice), 0) / lateHalf.length;
      
      if (earlyAvg > 0) {
        marketTrendAdjustment = ((lateAvg - earlyAvg) / earlyAvg) * 100;
      }
    }

    // Calculate list-to-sale ratio from sold properties
    const ratios = soldForAnalysis
      .filter(p => p.listPrice && p.closePrice && Number(p.listPrice) > 0)
      .map(p => (Number(p.closePrice) / Number(p.listPrice)) * 100);
    
    const avgListToSaleRatio = ratios.length > 0 
      ? ratios.reduce((a, b) => a + b, 0) / ratios.length 
      : 100;

    // Calculate DOM (Days on Market) analysis
    const doms = soldForAnalysis
      .map(p => p.daysOnMarket || 0)
      .filter(dom => dom > 0);
    const avgDom = doms.length > 0 ? doms.reduce((a, b) => a + b, 0) / doms.length : 0;

    // Determine market condition based on DOM
    let marketCondition: 'hot' | 'balanced' | 'slow' = 'balanced';
    if (avgDom < 21) marketCondition = 'hot';
    else if (avgDom > 60) marketCondition = 'slow';

    // Calculate suggested price range
    const sortedPrices = [...soldPrices].sort((a, b) => a - b);
    const q1Index = Math.floor(sortedPrices.length * 0.25);
    const q3Index = Math.floor(sortedPrices.length * 0.75);
    const q1 = sortedPrices[q1Index] || sortedPrices[0];
    const q3 = sortedPrices[q3Index] || sortedPrices[sortedPrices.length - 1];
    const iqr = q3 - q1;
    
    // Apply market trend adjustment to suggestion (capped at ±10%)
    const trendMultiplier = 1 + Math.max(-0.1, Math.min(0.1, marketTrendAdjustment / 100));
    
    // Suggested range based on quartiles with trend adjustment
    const suggestedLow = Math.round(q1 * trendMultiplier);
    const suggestedHigh = Math.round(q3 * trendMultiplier);
    const suggestedMid = Math.round(((q1 + q3) / 2) * trendMultiplier);

    // Quick sale vs maximum value suggestions
    const quickSalePrice = Math.round(suggestedLow * 0.98); // Slightly below low for quick sale
    const maxValuePrice = Math.round(suggestedHigh * 1.02); // Slightly above high for max value

    // Confidence score based on data quality (0-100)
    let confidenceScore = 50; // Base score
    confidenceScore += Math.min(20, soldForAnalysis.length * 2); // More comps = higher confidence
    confidenceScore += soldPricesPerSqFt.length > 3 ? 10 : 0; // Good sqft data
    confidenceScore += ratios.length > 2 ? 10 : 0; // Good ratio data
    confidenceScore -= Math.abs(marketTrendAdjustment) > 10 ? 10 : 0; // Volatile market reduces confidence
    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    return {
      suggestedLow,
      suggestedMid,
      suggestedHigh,
      quickSalePrice,
      maxValuePrice,
      avgPricePerSqFt,
      marketTrendAdjustment,
      avgListToSaleRatio,
      avgDom,
      marketCondition,
      confidenceScore,
      compsAnalyzed: soldForAnalysis.length,
      priceRange: { min: sortedPrices[0], max: sortedPrices[sortedPrices.length - 1] },
    };
  }, [soldProperties, excludedPropertyIds]);

  // Prepare chart data - use filtered statistics
  const priceRangeData = [
    { 
      name: 'Low', 
      value: filteredStatistics.price.range.min,
      fill: 'hsl(var(--chart-1))'
    },
    { 
      name: 'Avg', 
      value: filteredStatistics.price.average,
      fill: 'hsl(var(--chart-2))'
    },
    { 
      name: 'Med', 
      value: filteredStatistics.price.median,
      fill: 'hsl(var(--chart-3))'
    },
    { 
      name: 'High', 
      value: filteredStatistics.price.range.max,
      fill: 'hsl(var(--chart-4))'
    },
  ];

  return (
    <div className="space-y-6 cma-print">
      {/* Preview Banner - hidden in print/PDF */}
      {isPreview && expiresAt && (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-md p-4 flex items-center justify-between gap-4 flex-wrap print:hidden cma-preview-banner" data-testid="cma-preview-banner">
          <p className="text-sm">
            You are seeing a preview of the report.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={onSave} data-testid="button-save-cma">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onPublicLink} data-testid="button-copy-live-url">
              <ExternalLink className="w-4 h-4 mr-2" />
              Copy Live URL
            </Button>
            <Button size="sm" variant="outline" onClick={onShareCMA} data-testid="button-share-cma-email">
              <Mail className="w-4 h-4 mr-2" />
              Share CMA
            </Button>
            <Button size="sm" variant="outline" onClick={onModifySearch} data-testid="button-modify-search">
              <Edit className="w-4 h-4 mr-2" />
              Modify Search
            </Button>
            {activeTab === "home-averages" && (
              <Button size="sm" variant="outline" onClick={onModifyStats} data-testid="button-modify-stats">
                <FileText className="w-4 h-4 mr-2" />
                Modify Stats
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onAddNotes} data-testid="button-notes">
              Notes
            </Button>
          </div>
        </div>
      )}

      {/* Print-only Summary Section - mirrors Share CMA layout for print/PDF */}
      <div className="hidden print:block space-y-6">
        {/* Report Title */}
        {reportTitle && (
          <div className="border-b pb-4">
            <h1 className="text-2xl font-bold">{reportTitle}</h1>
            <p className="text-sm text-muted-foreground">Comparative Market Analysis</p>
          </div>
        )}

        {/* Key Stats Cards Row - matches Share view */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Average Price</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">${Math.round(filteredStatistics.price.average).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                Range: ${filteredStatistics.price.range.min.toLocaleString()} - ${filteredStatistics.price.range.max.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Price Per Sqft</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${filteredStatistics.pricePerSqFt.average.toFixed(0)}<span className="text-sm">/sqft</span></p>
              <p className="text-xs text-muted-foreground">
                Range: ${filteredStatistics.pricePerSqFt.range.min.toFixed(0)} - ${filteredStatistics.pricePerSqFt.range.max.toFixed(0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Avg Living Area</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{Math.round(filteredStatistics.livingArea.average).toLocaleString()}<span className="text-sm"> sqft</span></p>
              <p className="text-xs text-muted-foreground">
                {filteredStatistics.bedrooms.average.toFixed(1)} beds / {filteredStatistics.bathrooms.average.toFixed(1)} baths avg
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CMA Market Review - Print Version (always included in PDF) */}
        <Card className="border-primary/30 bg-primary/5 print-cma-market-review">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              CMA Market Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Market Overview</h4>
                <p className="text-sm text-muted-foreground">
                  Based on {includedAll.length} comparable properties, the average price is{' '}
                  <span className="font-semibold text-foreground">${Math.round(filteredStatistics.price.average).toLocaleString()}</span>{' '}
                  with a median of{' '}
                  <span className="font-semibold text-foreground">${Math.round(filteredStatistics.price.median).toLocaleString()}</span>.
                  {' '}Prices range from ${filteredStatistics.price.range.min.toLocaleString()} to ${filteredStatistics.price.range.max.toLocaleString()}.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Price Per Square Foot</h4>
                <p className="text-sm text-muted-foreground">
                  Average price per square foot is{' '}
                  <span className="font-semibold text-foreground">${filteredStatistics.pricePerSqFt.average.toFixed(2)}</span>{' '}
                  across comparable properties. This ranges from ${filteredStatistics.pricePerSqFt.range.min.toFixed(2)} to ${filteredStatistics.pricePerSqFt.range.max.toFixed(2)}/sqft.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Days on Market</h4>
                <p className="text-sm text-muted-foreground">
                  Average: <span className="font-semibold text-foreground">{Math.round(filteredStatistics.daysOnMarket.average)} days</span>
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Property Size</h4>
                <p className="text-sm text-muted-foreground">
                  Avg: <span className="font-semibold text-foreground">{Math.round(filteredStatistics.livingArea.average).toLocaleString()} sqft</span>
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Bed/Bath</h4>
                <p className="text-sm text-muted-foreground">
                  Avg: <span className="font-semibold text-foreground">{filteredStatistics.bedrooms.average.toFixed(1)} beds / {filteredStatistics.bathrooms.average.toFixed(1)} baths</span>
                </p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic">
                This analysis is based on {includedActive.length} Active, {includedUnderContract.length} Active Under Contract, and {includedSold.length} Closed properties in your selection.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Notes Section - shown when notes exist */}
      {notes && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Agent Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="home-averages" data-testid="tab-home-averages" className="flex items-center gap-1">
            Home Averages
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="max-w-md z-50">
                <p>Aggregated statistics including price, price per square foot, days on market, and property features across all comparable properties.</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          <TabsTrigger value="listings" data-testid="tab-listings" className="flex items-center gap-1">
            <MapIcon className="w-4 h-4" />
            Listings
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="max-w-md z-50">
                <p>Detailed breakdown of comparable properties with interactive map showing locations.</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline" className="flex items-center gap-1">
            Timeline
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="max-w-md z-50">
                <p>Visual chart showing property prices over time with status indicators to identify market trends.</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
          <TabsTrigger value="market-stats" data-testid="tab-market-stats" className="flex items-center gap-1">
            Market Stats
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="max-w-md z-50">
                <p>Key market indicators including average price, price per square foot, days on market, and list-to-sold ratio.</p>
              </TooltipContent>
            </Tooltip>
          </TabsTrigger>
        </TabsList>

        {/* Home Averages Tab */}
        <TabsContent value="home-averages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Statistics ({includedAll.length} Properties)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]"></TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Median</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMetrics.includes('price') && (
                    <TableRow>
                      <TableCell className="font-medium">Price</TableCell>
                      <TableCell data-testid="text-price-range">
                        ${filteredStatistics.price.range.min.toLocaleString()} - ${filteredStatistics.price.range.max.toLocaleString()}
                      </TableCell>
                      <TableCell data-testid="text-price-average">
                        ${Math.round(filteredStatistics.price.average).toLocaleString()}
                      </TableCell>
                      <TableCell data-testid="text-price-median">
                        ${Math.round(filteredStatistics.price.median).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('pricePerSqFt') && (
                    <TableRow>
                      <TableCell className="font-medium">Price/SqFt</TableCell>
                      <TableCell>
                        ${filteredStatistics.pricePerSqFt.range.min.toFixed(2)}/SqFt - ${filteredStatistics.pricePerSqFt.range.max.toFixed(2)}/SqFt
                      </TableCell>
                      <TableCell>
                        ${filteredStatistics.pricePerSqFt.average.toFixed(2)}/SqFt
                      </TableCell>
                      <TableCell>
                        ${filteredStatistics.pricePerSqFt.median.toFixed(2)}/SqFt
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('daysOnMarket') && (
                    <TableRow>
                      <TableCell className="font-medium">Days on Market</TableCell>
                      <TableCell>
                        {filteredStatistics.daysOnMarket.range.min} - {filteredStatistics.daysOnMarket.range.max}
                      </TableCell>
                      <TableCell>{Math.round(filteredStatistics.daysOnMarket.average)}</TableCell>
                      <TableCell>{Math.round(filteredStatistics.daysOnMarket.median)}</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('livingArea') && (
                    <TableRow>
                      <TableCell className="font-medium">Liv SqFt</TableCell>
                      <TableCell>
                        {filteredStatistics.livingArea.range.min.toLocaleString()} SqFt - {filteredStatistics.livingArea.range.max.toLocaleString()} SqFt
                      </TableCell>
                      <TableCell>{Math.round(filteredStatistics.livingArea.average).toLocaleString()} SqFt</TableCell>
                      <TableCell>{Math.round(filteredStatistics.livingArea.median).toLocaleString()} SqFt</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('lotSize') && (
                    <TableRow>
                      <TableCell className="font-medium">Lot SqFt</TableCell>
                      <TableCell>
                        {filteredStatistics.lotSize.range.min.toLocaleString()} SqFt - {filteredStatistics.lotSize.range.max.toLocaleString()} SqFt
                      </TableCell>
                      <TableCell>{Math.round(filteredStatistics.lotSize.average).toLocaleString()} SqFt</TableCell>
                      <TableCell>{Math.round(filteredStatistics.lotSize.median).toLocaleString()} SqFt</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('acres') && (
                    <TableRow>
                      <TableCell className="font-medium">Acres</TableCell>
                      <TableCell>
                        {filteredStatistics.acres.range.min.toFixed(2)} Acres - {filteredStatistics.acres.range.max.toFixed(2)} Acres
                      </TableCell>
                      <TableCell>{filteredStatistics.acres.average.toFixed(2)} Acres</TableCell>
                      <TableCell>{filteredStatistics.acres.median.toFixed(2)} Acres</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('bedrooms') && (
                    <TableRow>
                      <TableCell className="font-medium">Beds</TableCell>
                      <TableCell>
                        {filteredStatistics.bedrooms.range.min} - {filteredStatistics.bedrooms.range.max}
                      </TableCell>
                      <TableCell>{filteredStatistics.bedrooms.average.toFixed(1)}</TableCell>
                      <TableCell>{filteredStatistics.bedrooms.median}</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('bathrooms') && (
                    <TableRow>
                      <TableCell className="font-medium">Baths</TableCell>
                      <TableCell>
                        {filteredStatistics.bathrooms.range.min} - {filteredStatistics.bathrooms.range.max}
                      </TableCell>
                      <TableCell>{filteredStatistics.bathrooms.average.toFixed(1)}</TableCell>
                      <TableCell>{filteredStatistics.bathrooms.median}</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('yearBuilt') && (
                    <TableRow>
                      <TableCell className="font-medium">Year Built</TableCell>
                      <TableCell>
                        {filteredStatistics.yearBuilt.range.min} - {filteredStatistics.yearBuilt.range.max}
                      </TableCell>
                      <TableCell>{Math.round(filteredStatistics.yearBuilt.average)}</TableCell>
                      <TableCell>{filteredStatistics.yearBuilt.median}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Dynamic Pricing Suggestion Card */}
          {pricingSuggestion && (
            <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Suggested Price Range
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm">
                      <p className="text-sm">
                        Price suggestions based on {pricingSuggestion.compsAnalyzed} sold comparable properties, 
                        adjusted for current market trends. Not a formal appraisal.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Main Price Range Display */}
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-3 text-3xl font-bold">
                    <span className="text-muted-foreground">${pricingSuggestion.suggestedLow.toLocaleString()}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-primary">${pricingSuggestion.suggestedHigh.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Suggested listing range based on {pricingSuggestion.compsAnalyzed} comparable sales
                  </p>
                </div>

                {/* Visual Price Range Bar */}
                {(() => {
                  const rangeSpan = pricingSuggestion.priceRange.max - pricingSuggestion.priceRange.min;
                  const hasValidRange = rangeSpan > 0;
                  
                  const clamp = (val: number) => Math.max(0, Math.min(100, val));
                  
                  const leftPct = hasValidRange 
                    ? clamp(((pricingSuggestion.suggestedLow - pricingSuggestion.priceRange.min) / rangeSpan) * 100)
                    : 10;
                  const rightPct = hasValidRange 
                    ? clamp(100 - ((pricingSuggestion.suggestedHigh - pricingSuggestion.priceRange.min) / rangeSpan) * 100)
                    : 10;
                  const midPct = hasValidRange
                    ? clamp(((pricingSuggestion.suggestedMid - pricingSuggestion.priceRange.min) / rangeSpan) * 100)
                    : 50;
                  
                  return (
                    <div className="space-y-2">
                      <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                        {hasValidRange ? (
                          <>
                            <div 
                              className="absolute h-full bg-gradient-to-r from-green-500/40 via-primary/60 to-orange-500/40 rounded-md"
                              style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
                            />
                            <div 
                              className="absolute w-1 h-full bg-primary"
                              style={{ left: `${midPct}%` }}
                            />
                          </>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-primary/40 rounded-md" />
                            <div className="absolute w-1 h-full bg-primary left-1/2 transform -translate-x-1/2" />
                          </>
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>${pricingSuggestion.priceRange.min.toLocaleString()}</span>
                        <span className="font-medium text-primary">Target: ${pricingSuggestion.suggestedMid.toLocaleString()}</span>
                        <span>${pricingSuggestion.priceRange.max.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Price Strategy Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-700 dark:text-green-400">Quick Sale Price</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      ${pricingSuggestion.quickSalePrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                      Competitive pricing for faster sale
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span className="font-medium text-orange-700 dark:text-orange-400">Maximum Value</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                      ${pricingSuggestion.maxValuePrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-1">
                      Aggressive pricing for maximum return
                    </p>
                  </div>
                </div>

                {/* Market Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Avg $/SqFt</span>
                    </div>
                    <p className="text-lg font-bold">${pricingSuggestion.avgPricePerSqFt.toFixed(0)}</p>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Market Trend</span>
                    </div>
                    <p className={cn(
                      "text-lg font-bold",
                      pricingSuggestion.marketTrendAdjustment >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {pricingSuggestion.marketTrendAdjustment >= 0 ? '+' : ''}{pricingSuggestion.marketTrendAdjustment.toFixed(1)}%
                    </p>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">List/Sale Ratio</span>
                    </div>
                    <p className="text-lg font-bold">{pricingSuggestion.avgListToSaleRatio.toFixed(1)}%</p>
                  </div>

                  <div className="text-center p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Avg DOM</span>
                    </div>
                    <p className="text-lg font-bold">{Math.round(pricingSuggestion.avgDom)} days</p>
                  </div>
                </div>

                {/* Market Condition & Confidence */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Market:</span>
                    <Badge 
                      variant="outline"
                      className={cn(
                        pricingSuggestion.marketCondition === 'hot' && "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
                        pricingSuggestion.marketCondition === 'balanced' && "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
                        pricingSuggestion.marketCondition === 'slow' && "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700"
                      )}
                    >
                      {pricingSuggestion.marketCondition === 'hot' ? 'Hot Market' : 
                       pricingSuggestion.marketCondition === 'balanced' ? 'Balanced Market' : 'Slow Market'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Confidence:</span>
                    <div className="flex items-center gap-1">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            pricingSuggestion.confidenceScore >= 70 ? "bg-green-500" :
                            pricingSuggestion.confidenceScore >= 50 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${pricingSuggestion.confidenceScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{pricingSuggestion.confidenceScore}%</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  This analysis is based on comparable sales data and market trends. 
                  Consult with your agent for a comprehensive pricing strategy.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Property List at Bottom of Home Averages */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Properties Used in Analysis ({includedAll.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...includedAll].sort((a, b) => {
                  const priceA = a.standardStatus === 'Closed' 
                    ? (a.closePrice ? Number(a.closePrice) : Number(a.listPrice || 0))
                    : Number(a.listPrice || 0);
                  const priceB = b.standardStatus === 'Closed'
                    ? (b.closePrice ? Number(b.closePrice) : Number(b.listPrice || 0))
                    : Number(b.listPrice || 0);
                  return priceA - priceB;
                }).map((property) => {
                  const photos = (property as any).photos as string[] | undefined;
                  const media = (property as any).media as any[] | undefined;
                  const primaryPhoto = photos?.[0] || media?.[0]?.mediaURL || media?.[0]?.mediaUrl;
                  const isSold = property.standardStatus === 'Closed';
                  const price = isSold 
                    ? (property.closePrice ? Number(property.closePrice) : (property.listPrice ? Number(property.listPrice) : 0))
                    : (property.listPrice ? Number(property.listPrice) : 0);
                  const pricePerSqft = property.livingArea ? price / Number(property.livingArea) : null;
                  
                  const statusConfig = {
                    'Active': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
                    'Active Under Contract': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
                    'Closed': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' }
                  };
                  const status = statusConfig[property.standardStatus as keyof typeof statusConfig] || statusConfig['Active'];
                  
                  return (
                    <div 
                      key={property.id} 
                      className={`flex gap-3 p-3 rounded-md border cursor-pointer hover-elevate transition-colors ${status.border}`}
                      onClick={() => handlePropertyClick(property)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePropertyClick(property)}
                      tabIndex={0}
                      role="button"
                      data-testid={`home-avg-card-${property.id}`}
                    >
                      {primaryPhoto ? (
                        <img src={primaryPhoto} alt={property.unparsedAddress || ''} className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded-md flex flex-col items-center justify-center flex-shrink-0 p-1">
                          <Home className="w-5 h-5 text-muted-foreground/50 mb-0.5" />
                          <span className="text-[8px] text-muted-foreground text-center leading-tight">No photos available</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate max-w-[200px]">{property.unparsedAddress}</p>
                          <Badge variant="outline" className={`${status.bg} ${status.text} text-xs flex-shrink-0`}>
                            {property.standardStatus}
                          </Badge>
                        </div>
                        {(property.propertySubType || property.propertyType) && (
                          <p className="text-xs text-muted-foreground">{property.propertySubType || property.propertyType}</p>
                        )}
                        <p className="text-lg font-bold text-primary">${price.toLocaleString()}</p>
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                          <span>{property.bedroomsTotal || 0} beds</span>
                          <span>{property.bathroomsTotalInteger || 0} baths</span>
                          {property.livingArea && <span>{Number(property.livingArea).toLocaleString()} sqft</span>}
                          {pricePerSqft && <span>${pricePerSqft.toFixed(0)}/sqft</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                          {(property as any).listDate && <span>Listed: {new Date((property as any).listDate).toLocaleDateString()}</span>}
                          {isSold && property.closeDate && <span>Closed: {new Date(property.closeDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Listings Tab - Properties sorted by price low→high with Map */}
        <TabsContent value="listings" className="space-y-6">
          {/* Side-by-side layout: List on left, Map on right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Property List */}
            <div className="space-y-4">
              <Tabs value={activeListingTab} onValueChange={setActiveListingTab}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <TabsList>
                    <TabsTrigger value="all" data-testid="subtab-all">All ({includedAll.length})</TabsTrigger>
                    <TabsTrigger value="sold" data-testid="subtab-sold">Closed ({includedSold.length})</TabsTrigger>
                    <TabsTrigger value="under-contract" data-testid="subtab-under-contract">
                      AUC ({includedUnderContract.length})
                    </TabsTrigger>
                    <TabsTrigger value="active" data-testid="subtab-active">Active ({includedActive.length})</TabsTrigger>
                  </TabsList>
                  
                  {/* Include All / Exclude All buttons - CloudCMA style */}
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setExcludedPropertyIds(new Set())}
                      data-testid="button-include-all"
                    >
                      Include All
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setExcludedPropertyIds(new Set(allProperties.map(p => p.id)))}
                      data-testid="button-exclude-all"
                    >
                      Exclude All
                    </Button>
                    {excludedPropertyIds.size > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {excludedPropertyIds.size} excluded
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
              {/* Summary Stats Cards at Top - CloudCMA style: Low/Median/Average/High */}
              {(() => {
                const filteredProps = (activeListingTab === 'all' ? allProperties :
                  activeListingTab === 'sold' ? soldProperties :
                  activeListingTab === 'under-contract' ? underContractProperties : activeProperties)
                  .filter(p => !excludedPropertyIds.has(p.id));
                
                const totalCount = activeListingTab === 'all' ? includedAll.length :
                  activeListingTab === 'sold' ? includedSold.length :
                  activeListingTab === 'under-contract' ? includedUnderContract.length : includedActive.length;
                
                if (totalCount === 0) return null;
                
                const prices = filteredProps.map(p => {
                  const isSold = p.standardStatus === 'Closed';
                  return isSold 
                    ? (p.closePrice ? Number(p.closePrice) : (p.listPrice ? Number(p.listPrice) : 0))
                    : (p.listPrice ? Number(p.listPrice) : 0);
                }).filter(p => p > 0).sort((a, b) => a - b);
                
                const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
                const minPrice = prices.length > 0 ? prices[0] : 0;
                const maxPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
                const medianPrice = prices.length > 0 
                  ? prices.length % 2 === 0 
                    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
                    : prices[Math.floor(prices.length / 2)]
                  : 0;
                
                return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card>
                      <CardContent className="pt-3 pb-3">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Properties</div>
                        <div className="text-2xl font-bold">{filteredProps.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-3 pb-3">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Low</div>
                        <div className="text-lg font-bold text-green-600">${minPrice.toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-3 pb-3">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Median</div>
                        <div className="text-lg font-bold">${Math.round(medianPrice).toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-3 pb-3">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Average</div>
                        <div className="text-lg font-bold">${Math.round(avgPrice).toLocaleString()}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-3 pb-3">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">High</div>
                        <div className="text-lg font-bold text-red-600">${maxPrice.toLocaleString()}</div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
              
              {/* Properties List - Sorted by price low→high */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {activeListingTab === 'all' ? 'All Properties' :
                     activeListingTab === 'sold' ? 'Closed Properties' :
                     activeListingTab === 'under-contract' ? 'Active Under Contract' : 'Active Listings'} - Price Low to High
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Show all properties (including excluded) for toggle functionality
                    // Excluded properties are visually indicated with opacity-50
                    const filteredProps = activeListingTab === 'all' ? allProperties :
                      activeListingTab === 'sold' ? soldProperties :
                      activeListingTab === 'under-contract' ? underContractProperties : activeProperties;
                    
                    // Sort by price low→high
                    const sortedProps = [...filteredProps].sort((a, b) => {
                      const priceA = a.standardStatus === 'Closed' 
                        ? (a.closePrice ? Number(a.closePrice) : Number(a.listPrice || 0))
                        : Number(a.listPrice || 0);
                      const priceB = b.standardStatus === 'Closed'
                        ? (b.closePrice ? Number(b.closePrice) : Number(b.listPrice || 0))
                        : Number(b.listPrice || 0);
                      return priceA - priceB;
                    });
                    
                    if (sortedProps.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No properties in this category
                        </p>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {sortedProps.map((property) => {
                          const photos = (property as any).photos as string[] | undefined;
                          const media = (property as any).media as any[] | undefined;
                          const primaryPhoto = photos?.[0] || media?.[0]?.mediaURL || media?.[0]?.mediaUrl;
                          const isSold = property.standardStatus === 'Closed';
                          const price = isSold 
                            ? (property.closePrice ? Number(property.closePrice) : (property.listPrice ? Number(property.listPrice) : 0))
                            : (property.listPrice ? Number(property.listPrice) : 0);
                          const pricePerSqft = property.livingArea ? price / Number(property.livingArea) : null;
                          
                          // Status badge styling
                          const statusConfig = {
                            'Active': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
                            'Active Under Contract': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
                            'Closed': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' }
                          };
                          const status = statusConfig[property.standardStatus as keyof typeof statusConfig] || statusConfig['Active'];
                          const isExcluded = excludedPropertyIds.has(property.id);
                          
                          const toggleExclude = (e: React.MouseEvent | React.KeyboardEvent) => {
                            e.stopPropagation();
                            const newSet = new Set(excludedPropertyIds);
                            if (isExcluded) {
                              newSet.delete(property.id);
                            } else {
                              newSet.add(property.id);
                            }
                            setExcludedPropertyIds(newSet);
                          };
                          
                          return (
                            <div 
                              key={property.id} 
                              className={cn(
                                `flex gap-3 p-3 rounded-md border cursor-pointer hover-elevate transition-colors ${status.border}`,
                                isExcluded && 'opacity-50 bg-muted/30'
                              )}
                              onClick={() => handlePropertyClick(property)}
                              onKeyDown={(e) => e.key === 'Enter' && handlePropertyClick(property)}
                              tabIndex={0}
                              role="button"
                              data-testid={`listing-card-${property.id}`}
                            >
                              {/* Exclude toggle */}
                              <div 
                                className="flex items-start pt-1"
                                onClick={toggleExclude}
                                onKeyDown={(e) => e.key === 'Enter' && toggleExclude(e)}
                              >
                                <Checkbox 
                                  checked={!isExcluded}
                                  className="h-4 w-4"
                                  data-testid={`checkbox-include-${property.id}`}
                                />
                              </div>
                              {primaryPhoto ? (
                                <img src={primaryPhoto} alt={property.unparsedAddress || ''} className="w-24 h-24 object-cover rounded-md flex-shrink-0" />
                              ) : (
                                <div className="w-24 h-24 bg-muted rounded-md flex flex-col items-center justify-center flex-shrink-0 p-1">
                                  <Home className="w-6 h-6 text-muted-foreground/50 mb-1" />
                                  <span className="text-[9px] text-muted-foreground text-center leading-tight">No photos available</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <p className="font-semibold text-sm truncate max-w-[200px]">{property.unparsedAddress}</p>
                                  <Badge variant="outline" className={`${status.bg} ${status.text} text-xs flex-shrink-0`}>
                                    {property.standardStatus}
                                  </Badge>
                                </div>
                                <p className="text-xl font-bold text-primary">${price.toLocaleString()}</p>
                                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                                  <span>{property.bedroomsTotal || 0} beds</span>
                                  <span>{property.bathroomsTotalInteger || 0} baths</span>
                                  {property.livingArea && <span>{Number(property.livingArea).toLocaleString()} sqft</span>}
                                  {pricePerSqft && <span>${pricePerSqft.toFixed(0)}/sqft</span>}
                                </div>
                                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                                  {isSold && property.closeDate && <span>Closed: {new Date(property.closeDate).toLocaleDateString()}</span>}
                                  {!isSold && property.daysOnMarket !== null && property.daysOnMarket !== undefined && <span>{property.daysOnMarket} DOM</span>}
                                  {property.propertySubType && <span>{property.propertySubType}</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </Tabs>
        </div>

        {/* Right Column: Property Map */}
            <div className="lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapIcon className="w-4 h-4" />
                      Property Locations
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-lg">🏠</span>
                        <div className="w-2 h-2 rounded-sm bg-green-500"></div>
                        <span>Active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">🏠</span>
                        <div className="w-2 h-2 rounded-sm bg-orange-500"></div>
                        <span>Pending</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">🏠</span>
                        <div className="w-2 h-2 rounded-sm bg-gray-500"></div>
                        <span>Closed</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Sync map with filter: use filtered properties based on activeListingTab and exclusions
                    const filteredForMap = (activeListingTab === 'all' ? allProperties :
                      activeListingTab === 'sold' ? soldProperties :
                      activeListingTab === 'under-contract' ? underContractProperties : activeProperties)
                      .filter(p => !excludedPropertyIds.has(p.id));
                    
                    const propertiesWithCoords = filteredForMap.filter(
                      p => p.latitude && p.longitude && 
                      typeof p.latitude === 'number' && typeof p.longitude === 'number' &&
                      !isNaN(p.latitude) && !isNaN(p.longitude)
                    );
                    
                    if (propertiesWithCoords.length === 0) {
                      return (
                        <div className="h-[400px] flex items-center justify-center bg-muted/10 rounded-lg border border-dashed">
                          <div className="text-center">
                            <MapIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-muted-foreground">No location data available</p>
                          </div>
                        </div>
                      );
                    }
                    
                    const positions: [number, number][] = propertiesWithCoords.map(
                      p => [Number(p.latitude), Number(p.longitude)]
                    );
                    const center: [number, number] = [
                      positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length,
                      positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length
                    ];
                    
                    return (
                      <div className="h-[400px] rounded-lg overflow-hidden border">
                        <MapContainer
                          key={activeListingTab}
                          center={center}
                          zoom={13}
                          style={{ height: '100%', width: '100%' }}
                          scrollWheelZoom={true}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <FitBounds positions={positions} />
                          {propertiesWithCoords.map((property) => {
                            const status = property.standardStatus || 'Active';
                            const isClosed = status === 'Closed';
                            const price = isClosed 
                              ? (property.closePrice ? Number(property.closePrice) : (property.listPrice ? Number(property.listPrice) : 0))
                              : (property.listPrice ? Number(property.listPrice) : 0);
                            
                            return (
                              <Marker
                                key={property.listingId}
                                position={[Number(property.latitude), Number(property.longitude)]}
                                icon={getPriceMarkerIcon(price, status)}
                              >
                                <Popup>
                                  <div className="min-w-[200px]">
                                    <p className="font-semibold text-sm">{property.unparsedAddress}</p>
                                    <p className="text-lg font-bold text-primary">${Number(price).toLocaleString()}</p>
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {status}
                                    </Badge>
                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                                      <span>{property.bedroomsTotal || 0} beds</span>
                                      <span>{property.bathroomsTotalInteger || 0} baths</span>
                                      {property.livingArea && <span>{Number(property.livingArea).toLocaleString()} sqft</span>}
                                    </div>
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}
                        </MapContainer>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Price Distribution - moved below Property Locations */}
          <Card>
            <CardHeader>
              <CardTitle>Price Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priceRangeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          {/* Market Insights - Texas Agent Metrics */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Market Insights</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Filter out excluded properties for all calculations
                const includedSold = soldProperties.filter(p => !excludedPropertyIds.has(p.id));
                
                const soldPrices = includedSold
                  .map(p => p.closePrice ? Number(p.closePrice) : null)
                  .filter((p): p is number => p !== null && p > 0)
                  .sort((a, b) => a - b);
                
                const medianSoldPrice = soldPrices.length > 0 
                  ? soldPrices[Math.floor(soldPrices.length / 2)] 
                  : 0;
                
                const avgSoldPrice = soldPrices.length > 0
                  ? soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length
                  : 0;
                
                const avgDOMSold = includedSold.length > 0
                  ? includedSold.reduce((sum, p) => sum + (p.daysOnMarket || 0), 0) / includedSold.length
                  : 0;
                
                const ratios = includedSold
                  .filter(p => p.listPrice && p.closePrice && Number(p.listPrice) > 0)
                  .map(p => (Number(p.closePrice) / Number(p.listPrice)) * 100);
                const avgListToSaleRatio = ratios.length > 0 
                  ? ratios.reduce((a, b) => a + b, 0) / ratios.length 
                  : 0;
                
                const now = new Date();
                const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
                
                const currentYearSold = includedSold.filter(p => {
                  if (!p.closeDate) return false;
                  const closeDate = new Date(p.closeDate);
                  return closeDate >= oneYearAgo && closeDate <= now;
                });
                
                const priorYearSold = includedSold.filter(p => {
                  if (!p.closeDate) return false;
                  const closeDate = new Date(p.closeDate);
                  return closeDate >= twoYearsAgo && closeDate < oneYearAgo;
                });
                
                const currentYearPrices = currentYearSold
                  .map(p => p.closePrice ? Number(p.closePrice) : 0)
                  .filter(p => p > 0)
                  .sort((a, b) => a - b);
                
                const priorYearPrices = priorYearSold
                  .map(p => p.closePrice ? Number(p.closePrice) : 0)
                  .filter(p => p > 0)
                  .sort((a, b) => a - b);
                
                const currentYearAvg = currentYearPrices.length > 0
                  ? currentYearPrices.reduce((a, b) => a + b, 0) / currentYearPrices.length
                  : 0;
                const priorYearAvg = priorYearPrices.length > 0
                  ? priorYearPrices.reduce((a, b) => a + b, 0) / priorYearPrices.length
                  : 0;
                
                const currentYearMedian = currentYearPrices.length > 0
                  ? currentYearPrices[Math.floor(currentYearPrices.length / 2)]
                  : 0;
                const priorYearMedian = priorYearPrices.length > 0
                  ? priorYearPrices[Math.floor(priorYearPrices.length / 2)]
                  : 0;
                
                const yoyAvgChange = (priorYearAvg > 0 && currentYearAvg > 0)
                  ? ((currentYearAvg - priorYearAvg) / priorYearAvg) * 100
                  : null;
                
                const yoyMedianChange = (priorYearMedian > 0 && currentYearMedian > 0)
                  ? ((currentYearMedian - priorYearMedian) / priorYearMedian) * 100
                  : null;
                
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-background rounded-lg border">
                        <div className="text-2xl font-bold text-primary">
                          {medianSoldPrice > 0 ? `$${medianSoldPrice.toLocaleString()}` : 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Median Close Price</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded-lg border">
                        <div className="text-2xl font-bold">
                          {avgDOMSold > 0 ? `${Math.round(avgDOMSold)} days` : 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Days on Market (Closed)</div>
                      </div>
                      <div className="text-center p-3 bg-background rounded-lg border">
                        <div className="text-2xl font-bold">
                          {avgListToSaleRatio > 0 ? `${avgListToSaleRatio.toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">List-to-Sale Ratio</div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Year-over-Year (YoY) Comparison</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                          <div>
                            <div className="text-sm text-muted-foreground">YoY Avg Close Price</div>
                            <div className="text-xs text-muted-foreground/70">vs prior 12 months</div>
                          </div>
                          <div className={`text-xl font-bold flex items-center gap-1 ${
                            yoyAvgChange === null ? 'text-muted-foreground' :
                            yoyAvgChange >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {yoyAvgChange === null ? (
                              'N/A'
                            ) : (
                              <>
                                {yoyAvgChange >= 0 ? '↑' : '↓'}
                                {Math.abs(yoyAvgChange).toFixed(1)}%
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                          <div>
                            <div className="text-sm text-muted-foreground">YoY Median Close Price</div>
                            <div className="text-xs text-muted-foreground/70">vs prior 12 months</div>
                          </div>
                          <div className={`text-xl font-bold flex items-center gap-1 ${
                            yoyMedianChange === null ? 'text-muted-foreground' :
                            yoyMedianChange >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {yoyMedianChange === null ? (
                              'N/A'
                            ) : (
                              <>
                                {yoyMedianChange >= 0 ? '↑' : '↓'}
                                {Math.abs(yoyMedianChange).toFixed(1)}%
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Price Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle>Price Timeline</CardTitle>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm">Active Under Contract</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm">Closed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-blue-500"></div>
                    <span className="text-sm">Avg Price</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                // Filter timeline data based on exclusions and status filters
                const filteredTimelineData = timelineData.filter(d => {
                  // First filter by excluded property IDs
                  if (excludedPropertyIds.has(d.propertyId)) return false;
                  // Then filter by status toggles
                  if (d.status === 'Active' && !showActiveOnTimeline) return false;
                  if (d.status === 'Active Under Contract' && !showUnderContractOnTimeline) return false;
                  if (d.status === 'Closed' && !showSoldOnTimeline) return false;
                  return true;
                });
                
                // Calculate timeline statistics
                const prices = filteredTimelineData.map(d => d.price).filter(p => p > 0);
                const sortedPrices = [...prices].sort((a, b) => a - b);
                const timelineStats = {
                  count: prices.length,
                  min: sortedPrices.length > 0 ? sortedPrices[0] : 0,
                  max: sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : 0,
                  avg: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
                  median: sortedPrices.length > 0 ? sortedPrices[Math.floor(sortedPrices.length / 2)] : 0,
                };
                
                const getStatusColor = (status: string) => {
                  if (status === 'Active') return '#22c55e';
                  if (status === 'Active Under Contract') return '#eab308';
                  return '#ef4444';
                };
                
                return filteredTimelineData.length > 0 ? (
                <>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                      <XAxis 
                        type="number"
                        dataKey="dateNum"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                        name="Date"
                      />
                      <YAxis 
                        type="number"
                        dataKey="price"
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                        domain={['auto', 'auto']}
                        name="Price"
                      />
                      <ZAxis range={[80, 80]} />
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length > 0) {
                            const data = payload[0].payload;
                            const statusColor = data.status === 'Active' ? 'text-green-600' : 
                                               data.status === 'Active Under Contract' ? 'text-yellow-600' : 'text-red-600';
                            return (
                              <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                <p className="font-semibold text-foreground mb-1">{data.address || 'Property'}</p>
                                <div className="space-y-1 text-muted-foreground">
                                  <p className="flex justify-between gap-4">
                                    <span>Status:</span>
                                    <span className={`font-medium ${statusColor}`}>{data.status}</span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span>{data.status === 'Closed' ? 'Close Price:' : 'List Price:'}</span>
                                    <span className="font-medium text-foreground">${Number(data.price).toLocaleString()}</span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span>{data.status === 'Closed' ? 'Close Date:' : 'List Date:'}</span>
                                    <span className="font-medium text-foreground">{new Date(data.date).toLocaleDateString()}</span>
                                  </p>
                                  {data.status === 'Closed' && data.daysOnMarket != null && (
                                    <p className="flex justify-between gap-4">
                                      <span>Days on Market:</span>
                                      <span className="font-medium text-foreground">{data.daysOnMarket} days</span>
                                    </p>
                                  )}
                                  {data.status === 'Active' && data.daysActive != null && (
                                    <p className="flex justify-between gap-4">
                                      <span>Days Active:</span>
                                      <span className="font-medium text-foreground">{data.daysActive} days</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine 
                        y={timelineStats.avg} 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        label={{ value: 'Avg', position: 'right', fontSize: 11, fill: '#3b82f6' }}
                      />
                      <ReferenceLine 
                        y={timelineStats.median} 
                        stroke="#a855f7" 
                        strokeWidth={2}
                        label={{ value: 'Median', position: 'left', fontSize: 11, fill: '#a855f7' }}
                      />
                      <Scatter 
                        name="Properties"
                        data={filteredTimelineData.map(d => ({
                          ...d,
                          dateNum: new Date(d.date).getTime(),
                        }))}
                        shape={(props: any) => {
                          const { cx, cy, payload } = props;
                          const color = getStatusColor(payload.status);
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={8} 
                              fill={color} 
                              stroke="white" 
                              strokeWidth={2}
                              style={{ cursor: 'pointer' }}
                            />
                          );
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Statistics Summary Table */}
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Metric</TableHead>
                        <TableHead className="text-right">Range</TableHead>
                        <TableHead className="text-right">Average</TableHead>
                        <TableHead className="text-right">Median</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Price</TableCell>
                        <TableCell className="text-right">
                          ${timelineStats.min.toLocaleString()} - ${timelineStats.max.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-blue-600">
                          ${Math.round(timelineStats.avg).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-purple-500">
                          ${Math.round(timelineStats.median).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                </>
                ) : (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-2">No timeline data available</p>
                    <p className="text-sm">Timeline data requires properties with listing or closing dates.</p>
                  </div>
                </div>
              );
              })()}
              
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market Stats Tab */}
        <TabsContent value="market-stats" className="space-y-6">
          {/* Key Metrics Row - Prioritized: Avg Price, Median Price, Price/SqFt, Avg DOM */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Math.round(filteredStatistics.price.average).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Across all {includedAll.length} comparables</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Median Price</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Math.round(filteredStatistics.price.median).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">50th percentile</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Price/SqFt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${filteredStatistics.pricePerSqFt.average.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Per square foot</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg DOM</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(filteredStatistics.daysOnMarket.average)}</div>
                <p className="text-xs text-muted-foreground">Days on market</p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Metrics - Property Features (moved above CMA Market Review per QA request) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Price Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">${(filteredStatistics.price.range.min / 1000).toFixed(0)}K - ${(filteredStatistics.price.range.max / 1000).toFixed(0)}K</div>
                <p className="text-xs text-muted-foreground">Min to max</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg SqFt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(filteredStatistics.livingArea.average).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Living area</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg Beds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredStatistics.bedrooms.average.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Bedrooms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg Baths</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredStatistics.bathrooms.average.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Bathrooms</p>
              </CardContent>
            </Card>
          </div>

          {/* CMA Market Review Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                CMA Market Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Market Overview</h4>
                  <p className="text-sm text-muted-foreground">
                    Based on {includedAll.length} comparable properties, the average price is{' '}
                    <span className="font-semibold text-foreground">${Math.round(filteredStatistics.price.average).toLocaleString()}</span>{' '}
                    with a median of{' '}
                    <span className="font-semibold text-foreground">${Math.round(filteredStatistics.price.median).toLocaleString()}</span>.
                    {' '}Prices range from ${filteredStatistics.price.range.min.toLocaleString()} to ${filteredStatistics.price.range.max.toLocaleString()}.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Price Per Square Foot</h4>
                  <p className="text-sm text-muted-foreground">
                    Average price per square foot is{' '}
                    <span className="font-semibold text-foreground">${filteredStatistics.pricePerSqFt.average.toFixed(2)}</span>{' '}
                    across comparable properties. This ranges from ${filteredStatistics.pricePerSqFt.range.min.toFixed(2)} to ${filteredStatistics.pricePerSqFt.range.max.toFixed(2)}/sqft.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Days on Market</h4>
                  <p className="text-sm text-muted-foreground">
                    Average: <span className="font-semibold text-foreground">{Math.round(filteredStatistics.daysOnMarket.average)} days</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Property Size</h4>
                  <p className="text-sm text-muted-foreground">
                    Avg: <span className="font-semibold text-foreground">{Math.round(filteredStatistics.livingArea.average).toLocaleString()} sqft</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Bed/Bath</h4>
                  <p className="text-sm text-muted-foreground">
                    Avg: <span className="font-semibold text-foreground">{filteredStatistics.bedrooms.average.toFixed(1)} beds / {filteredStatistics.bathrooms.average.toFixed(1)} baths</span>
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground italic">
                  This analysis is based on {includedActive.length} Active, {includedUnderContract.length} Active Under Contract, and {includedSold.length} Closed properties in your selection.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Time to Sell Analysis - CloudCMA style */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Time to Sell Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Filter out excluded properties from Time to Sell analysis
                const closedWithData = soldProperties.filter(p => 
                  !excludedPropertyIds.has(p.id) &&
                  p.closePrice && p.listPrice && p.daysOnMarket !== null && p.daysOnMarket !== undefined
                );
                
                if (closedWithData.length === 0) {
                  return (
                    <div className="text-center py-6 text-muted-foreground">
                      <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No closed sales data available for Time to Sell analysis</p>
                    </div>
                  );
                }
                
                const avgDOM = closedWithData.reduce((sum, p) => sum + (p.daysOnMarket || 0), 0) / closedWithData.length;
                const medianDOM = (() => {
                  const sorted = closedWithData.map(p => p.daysOnMarket || 0).sort((a, b) => a - b);
                  return sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)];
                })();
                
                const listToSaleRatios = closedWithData.map(p => {
                  const closePrice = Number(p.closePrice);
                  const listPrice = Number(p.listPrice);
                  return listPrice > 0 ? (closePrice / listPrice) * 100 : 0;
                }).filter(r => r > 0);
                
                const avgListToSaleRatio = listToSaleRatios.length > 0 
                  ? listToSaleRatios.reduce((a, b) => a + b, 0) / listToSaleRatios.length 
                  : 0;
                const minRatio = listToSaleRatios.length > 0 ? Math.min(...listToSaleRatios) : 0;
                const maxRatio = listToSaleRatios.length > 0 ? Math.max(...listToSaleRatios) : 0;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <div className="text-3xl font-bold">{Math.round(avgDOM)}</div>
                      <div className="text-sm text-muted-foreground">Avg Days on Market</div>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <div className="text-3xl font-bold">{Math.round(medianDOM)}</div>
                      <div className="text-sm text-muted-foreground">Median Days on Market</div>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <div className={cn(
                        "text-3xl font-bold",
                        avgListToSaleRatio >= 100 ? "text-green-600" : "text-red-600"
                      )}>
                        {avgListToSaleRatio.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Avg List-to-Sale Ratio</div>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <div className="text-lg font-bold">
                        {minRatio.toFixed(1)}% - {maxRatio.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Ratio Range</div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Side-by-Side: Inventory Dial + Property Map */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Market Health Indicator - Inventory Dial */}
            <div>
              {(() => {
                // Filter out excluded properties for inventory calculations
                const includedActive = activeProperties.filter(p => !excludedPropertyIds.has(p.id));
                const includedSold = soldProperties.filter(p => !excludedPropertyIds.has(p.id));
                
                const activeCount = includedActive.length;
                const soldCount = includedSold.length;
                const avgSoldPerMonth = soldCount > 0 ? soldCount / 6 : 0;
                const monthsOfInventory = avgSoldPerMonth > 0 ? activeCount / avgSoldPerMonth : 0;
                const absorptionRate = avgSoldPerMonth;
                
                let marketCondition = 'Balanced';
                let marketColor = 'text-blue-600';
                let gaugePosition = 50;
                
                if (monthsOfInventory < 4) {
                  marketCondition = "Seller's Market";
                  marketColor = 'text-red-600';
                  gaugePosition = Math.max(10, 25 - (4 - monthsOfInventory) * 6);
                } else if (monthsOfInventory > 6) {
                  marketCondition = "Buyer's Market";
                  marketColor = 'text-green-600';
                  gaugePosition = Math.min(90, 75 + (monthsOfInventory - 6) * 3);
                } else {
                  gaugePosition = 25 + ((monthsOfInventory - 4) / 2) * 50;
                }
                
                return (
                  <Card className="border-2 border-primary/20 h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Market Health Indicator</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <div className="min-w-[200px]">
                          <div className="relative h-4 bg-gradient-to-r from-red-500 via-blue-500 to-green-500 rounded-full overflow-hidden">
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 w-4 h-6 bg-foreground rounded-sm border-2 border-background shadow-lg transition-all duration-500"
                              style={{ left: `calc(${gaugePosition}% - 8px)` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-2">
                            <span>Seller's Market</span>
                            <span>Balanced</span>
                            <span>Buyer's Market</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className={`text-xl font-bold ${marketColor}`}>
                              {monthsOfInventory > 0 ? monthsOfInventory.toFixed(1) : 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">Months Inventory</div>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xl font-bold text-primary">
                              {absorptionRate > 0 ? absorptionRate.toFixed(1) : 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">Sales/Month</div>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className={`text-lg font-bold ${marketColor}`}>
                              {marketCondition}
                            </div>
                            <div className="text-xs text-muted-foreground">Market Type</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">Analysis:</span>{' '}
                          {monthsOfInventory < 4 ? (
                            <>Low inventory ({monthsOfInventory.toFixed(1)} mo) favors sellers.</>
                          ) : monthsOfInventory > 6 ? (
                            <>High inventory ({monthsOfInventory.toFixed(1)} mo) favors buyers.</>
                          ) : (
                            <>Balanced market ({monthsOfInventory.toFixed(1)} mo).</>
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {/* Right: Property Map */}
            <div>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapIcon className="w-4 h-4" />
                      Property Locations
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-lg">🏠</span>
                        <div className="w-2 h-2 rounded-sm bg-green-500"></div>
                        <span>Active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">🏠</span>
                        <div className="w-2 h-2 rounded-sm bg-orange-500"></div>
                        <span>Pending</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">🏠</span>
                        <div className="w-2 h-2 rounded-sm bg-gray-500"></div>
                        <span>Closed</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Filter out excluded properties
                    const propertiesWithCoords = allProperties
                      .filter(p => !excludedPropertyIds.has(p.id))
                      .filter(
                        p => p.latitude && p.longitude && 
                        typeof p.latitude === 'number' && typeof p.longitude === 'number' &&
                        !isNaN(p.latitude) && !isNaN(p.longitude)
                      );
                    
                    if (propertiesWithCoords.length === 0) {
                      return (
                        <div className="h-[300px] flex items-center justify-center bg-muted/10 rounded-lg border border-dashed">
                          <div className="text-center">
                            <MapIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-muted-foreground">No location data available</p>
                          </div>
                        </div>
                      );
                    }
                    
                    const bounds = propertiesWithCoords.map(p => [Number(p.latitude), Number(p.longitude)] as [number, number]);
                    const centerLat = bounds.reduce((sum, [lat]) => sum + lat, 0) / bounds.length;
                    const centerLng = bounds.reduce((sum, [, lng]) => sum + lng, 0) / bounds.length;
                    
                    return (
                      <div className="h-[300px] rounded-lg overflow-hidden border">
                        <MapContainer
                          center={[centerLat, centerLng]}
                          zoom={12}
                          style={{ height: '100%', width: '100%' }}
                          scrollWheelZoom={false}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          {propertiesWithCoords.map((property) => {
                            const status = property.standardStatus || 'Active';
                            const isClosed = status === 'Closed';
                            const price = isClosed 
                              ? (property.closePrice ? Number(property.closePrice) : (property.listPrice ? Number(property.listPrice) : 0))
                              : (property.listPrice ? Number(property.listPrice) : 0);
                            
                            return (
                              <Marker
                                key={property.listingId}
                                position={[Number(property.latitude), Number(property.longitude)]}
                                icon={getPriceMarkerIcon(price, status)}
                              >
                                <Popup>
                                  <div className="min-w-[180px]">
                                    <p className="font-semibold text-sm">{property.unparsedAddress}</p>
                                    <p className="text-lg font-bold text-primary">${Number(price).toLocaleString()}</p>
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {status}
                                    </Badge>
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}
                        </MapContainer>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Price Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Price Trend Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Group sold properties by month for trend analysis (respecting exclusions)
                const soldByMonth: { [key: string]: { prices: number[]; count: number } } = {};
                
                includedSold.forEach(p => {
                  const closeDate = p.closeDate ? new Date(p.closeDate) : null;
                  const price = p.closePrice ? Number(p.closePrice) : 0;
                  
                  if (closeDate && price > 0) {
                    const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`;
                    if (!soldByMonth[monthKey]) {
                      soldByMonth[monthKey] = { prices: [], count: 0 };
                    }
                    soldByMonth[monthKey].prices.push(price);
                    soldByMonth[monthKey].count++;
                  }
                });
                
                const trendData = Object.entries(soldByMonth)
                  .map(([month, data]) => ({
                    month,
                    monthLabel: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                    avgPrice: data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
                    count: data.count,
                    minPrice: Math.min(...data.prices),
                    maxPrice: Math.max(...data.prices),
                  }))
                  .sort((a, b) => a.month.localeCompare(b.month));
                
                if (trendData.length < 2) {
                  return (
                    <div className="h-[250px] flex items-center justify-center bg-muted/10 rounded-lg border border-dashed">
                      <div className="text-center text-muted-foreground">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>Not enough sold data for trend analysis</p>
                        <p className="text-xs">Requires at least 2 months of sales data</p>
                      </div>
                    </div>
                  );
                }
                
                // Calculate YoY change if we have data
                const firstMonth = trendData[0];
                const lastMonth = trendData[trendData.length - 1];
                const priceChange = ((lastMonth.avgPrice - firstMonth.avgPrice) / firstMonth.avgPrice) * 100;
                
                return (
                  <>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                          <XAxis 
                            dataKey="monthLabel" 
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis 
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 11 }}
                            domain={['auto', 'auto']}
                          />
                          <RechartsTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length > 0) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                    <p className="font-semibold">{data.monthLabel}</p>
                                    <p className="text-primary">Avg: ${Math.round(data.avgPrice).toLocaleString()}</p>
                                    <p className="text-muted-foreground text-xs">{data.count} sales</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="avgPrice" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 p-3 bg-muted/30 rounded-lg">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Period:</span>{' '}
                        <span className="font-medium">{firstMonth.monthLabel} → {lastMonth.monthLabel}</span>
                      </div>
                      <div className={`text-lg font-bold ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
                        <span className="text-xs text-muted-foreground ml-1">price change</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Status Breakdown with Property Details - Sorted by count descending */}
          {(() => {
            const statusSections = [
              {
                key: 'active',
                label: 'Active Listings',
                properties: includedActive,
                borderClass: 'border-green-200 dark:border-green-800',
                bgClass: 'bg-green-50 dark:bg-green-950/30',
                dotClass: 'bg-green-500',
                titleClass: 'text-green-700 dark:text-green-400',
                emptyText: 'No active listings in this CMA',
                isSold: false
              },
              {
                key: 'under-contract',
                label: 'Active Under Contract',
                properties: includedUnderContract,
                borderClass: 'border-yellow-200 dark:border-yellow-800',
                bgClass: 'bg-yellow-50 dark:bg-yellow-950/30',
                dotClass: 'bg-yellow-500',
                titleClass: 'text-yellow-700 dark:text-yellow-400',
                emptyText: 'No active under contract listings in this CMA',
                isSold: false
              },
              {
                key: 'sold',
                label: 'Closed',
                properties: includedSold,
                borderClass: 'border-red-200 dark:border-red-800',
                bgClass: 'bg-red-50 dark:bg-red-950/30',
                dotClass: 'bg-red-500',
                titleClass: 'text-red-700 dark:text-red-400',
                emptyText: 'No closed listings in this CMA',
                isSold: true
              }
            ];
            
            const sortedSections = [...statusSections].sort((a, b) => b.properties.length - a.properties.length);
            
            return sortedSections.map((section) => (
              <Card key={section.key} className={section.borderClass}>
                <CardHeader className={`${section.bgClass} rounded-t-lg`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${section.dotClass}`}></div>
                    <CardTitle className={`text-base ${section.titleClass}`}>
                      {section.label} ({section.properties.length})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {section.properties.length > 0 ? (
                    <div className="space-y-3">
                      {section.properties.map((property) => {
                        const photos = (property as any).photos as string[] | undefined;
                        const media = (property as any).media as any[] | undefined;
                        const primaryPhoto = photos?.[0] || media?.[0]?.mediaURL || media?.[0]?.mediaUrl;
                        const price = section.isSold 
                          ? (property.closePrice ? Number(property.closePrice) : (property.listPrice ? Number(property.listPrice) : 0))
                          : (property.listPrice ? Number(property.listPrice) : 0);
                        const pricePerSqft = property.livingArea ? price / Number(property.livingArea) : null;
                        return (
                          <div 
                            key={property.id} 
                            className="flex gap-3 p-2 rounded-md border bg-card cursor-pointer hover-elevate transition-colors"
                            onClick={() => handlePropertyClick(property)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePropertyClick(property)}
                            tabIndex={0}
                            role="button"
                            data-testid={`card-property-${property.id}`}
                          >
                            {primaryPhoto ? (
                              <img src={primaryPhoto} alt={property.unparsedAddress || ''} className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                            ) : (
                              <div className="w-20 h-20 bg-muted rounded-md flex flex-col items-center justify-center flex-shrink-0 p-1">
                                <Home className="w-5 h-5 text-muted-foreground/50 mb-0.5" />
                                <span className="text-[8px] text-muted-foreground text-center leading-tight">No photos available</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{property.unparsedAddress}</p>
                              <p className="text-lg font-bold text-primary">${price.toLocaleString()}</p>
                              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                <span>{property.bedroomsTotal || 0} beds</span>
                                <span>{property.bathroomsTotalInteger || 0} baths</span>
                                {property.livingArea && <span>{Number(property.livingArea).toLocaleString()} sqft</span>}
                                {pricePerSqft && <span>${pricePerSqft.toFixed(0)}/sqft</span>}
                                {section.isSold && property.closeDate && <span>Closed: {new Date(property.closeDate).toLocaleDateString()}</span>}
                                {!section.isSold && property.daysOnMarket && <span>{property.daysOnMarket} DOM</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">{property.propertySubType || property.propertyType}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">{section.emptyText}</p>
                  )}
                </CardContent>
              </Card>
            ));
          })()}
        </TabsContent>
      </Tabs>
      
      {/* Floating Property Card Modal (Centered) */}
      <Dialog open={floatingCardOpen} onOpenChange={setFloatingCardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {floatingCardProperty && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Property Details</DialogTitle>
                <DialogDescription>View detailed information about this property including photos, price, and specifications.</DialogDescription>
              </DialogHeader>
              
              {/* Image Carousel */}
              <div className="relative aspect-[16/9] bg-muted rounded-lg overflow-hidden mb-4 -mx-6 -mt-6">
                {(() => {
                  const photos = getPropertyPhotos(floatingCardProperty);
                  return photos.length > 0 ? (
                    <>
                      <img 
                        src={photos[carouselIndex]} 
                        alt={floatingCardProperty.unparsedAddress || 'Property'} 
                        className="w-full h-full object-cover"
                        data-testid="img-floating-card-property"
                      />
                      {/* Carousel Controls - Click zones for navigation (full height, invisible background) */}
                      {photos.length > 1 && (
                        <>
                          {/* Left click zone - covers left half */}
                          <div 
                            className="absolute left-0 top-0 w-1/2 h-full cursor-pointer z-10 group"
                            onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                            data-testid="zone-carousel-prev"
                          >
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-70 group-hover:opacity-100">
                              <ChevronLeft className="w-5 h-5" />
                            </div>
                          </div>
                          {/* Right click zone - covers right half */}
                          <div 
                            className="absolute right-0 top-0 w-1/2 h-full cursor-pointer z-10 group"
                            onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                            data-testid="zone-carousel-next"
                          >
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-70 group-hover:opacity-100">
                              <ChevronRight className="w-5 h-5" />
                            </div>
                          </div>
                        </>
                      )}
                      {/* Photo Count - centered at bottom */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                        {carouselIndex + 1} / {photos.length}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                      <Home className="w-12 h-12 opacity-50 mb-2" />
                      <span className="text-sm">No photos available for this property</span>
                    </div>
                  );
                })()}
                {/* Status Badge */}
                {floatingCardProperty.standardStatus && (
                  <div className="absolute top-2 left-2 z-20">
                    <Badge 
                      className={cn(
                        floatingCardProperty.standardStatus === 'Active' && "bg-emerald-500 text-white",
                        floatingCardProperty.standardStatus === 'Active Under Contract' && "bg-amber-500 text-white",
                        floatingCardProperty.standardStatus === 'Closed' && "bg-slate-500 text-white"
                      )}
                    >
                      {floatingCardProperty.standardStatus}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="mb-4">
                <p className="text-2xl font-bold text-primary" data-testid="text-floating-price">
                  {floatingCardProperty.standardStatus === 'Closed' && floatingCardProperty.closePrice
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(floatingCardProperty.closePrice))
                    : floatingCardProperty.listPrice 
                      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(floatingCardProperty.listPrice))
                      : 'Price upon request'}
                </p>
                {floatingCardProperty.listPrice && floatingCardProperty.livingArea && (
                  <p className="text-sm text-muted-foreground">
                    ${(Number(floatingCardProperty.standardStatus === 'Closed' && floatingCardProperty.closePrice ? floatingCardProperty.closePrice : floatingCardProperty.listPrice) / Number(floatingCardProperty.livingArea)).toFixed(0)}/sqft
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="flex items-start gap-2 mb-4">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium" data-testid="text-floating-address">
                    {floatingCardProperty.unparsedAddress || 'Address not available'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      floatingCardProperty.city,
                      floatingCardProperty.stateOrProvince,
                      floatingCardProperty.postalCode
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {floatingCardProperty.bedroomsTotal !== null && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Bed className="w-4 h-4" />
                    </div>
                    <p className="font-semibold" data-testid="text-floating-beds">{floatingCardProperty.bedroomsTotal}</p>
                    <p className="text-xs text-muted-foreground">Beds</p>
                  </div>
                )}
                {floatingCardProperty.bathroomsTotalInteger !== null && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Bath className="w-4 h-4" />
                    </div>
                    <p className="font-semibold" data-testid="text-floating-baths">{floatingCardProperty.bathroomsTotalInteger}</p>
                    <p className="text-xs text-muted-foreground">Baths</p>
                  </div>
                )}
                {floatingCardProperty.livingArea && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Maximize className="w-4 h-4" />
                    </div>
                    <p className="font-semibold" data-testid="text-floating-sqft">{Number(floatingCardProperty.livingArea).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Sq Ft</p>
                  </div>
                )}
              </div>

              {/* Additional Details */}
              <div className="space-y-2 text-sm">
                {(floatingCardProperty.propertySubType || floatingCardProperty.propertyType) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property Type</span>
                    <span className="font-medium">{floatingCardProperty.propertySubType || floatingCardProperty.propertyType}</span>
                  </div>
                )}
                {floatingCardProperty.yearBuilt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Year Built</span>
                    <span className="font-medium">{floatingCardProperty.yearBuilt}</span>
                  </div>
                )}
                {/* Subdivision (tract/community label from listing) */}
                {/* Note: Neighborhood is only available via boundary resolution on Property Detail page */}
                {(floatingCardProperty.subdivision || (floatingCardProperty as any).subdivisionName) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subdivision</span>
                    <span className="font-medium">{floatingCardProperty.subdivision || (floatingCardProperty as any).subdivisionName}</span>
                  </div>
                )}
                {floatingCardProperty.daysOnMarket !== null && floatingCardProperty.daysOnMarket !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days on Market</span>
                    <span className="font-medium">{floatingCardProperty.daysOnMarket}</span>
                  </div>
                )}
                {floatingCardProperty.standardStatus === 'Closed' && floatingCardProperty.closeDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Close Date</span>
                    <span className="font-medium">{new Date(floatingCardProperty.closeDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
