import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, BarChart3, Maximize2, X, Database, Cloud } from "lucide-react";

interface ListingsByMonth {
  month: string;
  active: number;
  closed: number;
}

interface PriceDistribution {
  range: string;
  count: number;
}

interface SourceBreakdown {
  repliers: {
    Active: number;
    'Active Under Contract': number;
    Pending: number;
    Closed: number;
    total: number;
  };
  database: {
    Active: number;
    'Active Under Contract': number;
    Pending: number;
    Closed: number;
    total: number;
  };
}

interface MarketingInsightsCarouselProps {
  listingsByMonth?: ListingsByMonth[];
  priceDistribution?: PriceDistribution[];
  sourceBreakdown?: SourceBreakdown;
  isLoading?: boolean;
  lastUpdatedAt?: string;
}

interface ChartSlide {
  id: string;
  title: string;
  icon: typeof TrendingUp;
  description: string;
}

const CHART_SLIDES: ChartSlide[] = [
  {
    id: 'source-breakdown',
    title: 'Inventory by Status',
    icon: Database,
    description: 'Current inventory counts by RESO status',
  },
  {
    id: 'listings-trend',
    title: 'Listings Trend',
    icon: TrendingUp,
    description: 'Active and closed listings over time',
  },
  {
    id: 'price-distribution',
    title: 'Price Distribution',
    icon: BarChart3,
    description: 'Properties grouped by price range',
  },
];

export function MarketingInsightsCarousel({
  listingsByMonth,
  priceDistribution,
  sourceBreakdown,
  isLoading,
  lastUpdatedAt,
}: MarketingInsightsCarouselProps) {
  const [zoomedChart, setZoomedChart] = useState<string | null>(null);

  const sourceBreakdownData = useMemo(() => {
    if (!sourceBreakdown) return [];
    
    const statuses = ['Active', 'Active Under Contract', 'Pending', 'Closed'] as const;
    return statuses.map(status => ({
      status: status === 'Active Under Contract' ? 'AUC' : status,
      fullStatus: status,
      repliers: sourceBreakdown.repliers[status] || 0,
      database: sourceBreakdown.database[status] || 0,
      total: (sourceBreakdown.repliers[status] || 0) + (sourceBreakdown.database[status] || 0),
    })).filter(item => item.total > 0);
  }, [sourceBreakdown]);

  const renderSourceBreakdownChart = (expanded = false) => {
    if (!sourceBreakdownData.length) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          No source breakdown data available
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={expanded ? 400 : 200}>
        <BarChart data={sourceBreakdownData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis type="number" />
          <YAxis 
            dataKey="status" 
            type="category" 
            width={80}
            tick={{ fontSize: 12 }}
          />
          <RechartsTooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-background border rounded-md shadow-lg p-3">
                    <p className="font-semibold">{data.fullStatus}</p>
                    <p className="text-sm text-primary">
                      Repliers: {data.repliers.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Database: {data.database.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium border-t mt-1 pt-1">
                      Total: {data.total.toLocaleString()}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Bar 
            dataKey="repliers" 
            stackId="a" 
            fill="hsl(var(--primary))" 
            name="Repliers API"
            radius={[0, 0, 0, 0]}
          />
          <Bar 
            dataKey="database" 
            stackId="a" 
            fill="hsl(var(--muted-foreground))" 
            name="Database"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderListingsTrendChart = (expanded = false) => {
    if (!listingsByMonth?.length) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          No trend data available
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={expanded ? 400 : 200}>
        <LineChart data={listingsByMonth}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            tickFormatter={(value) => {
              const [year, month] = value.split('-');
              return `${month}/${year.slice(2)}`;
            }}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <RechartsTooltip
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === 'active' ? 'Active' : 'Closed'
            ]}
            labelFormatter={(label) => {
              const [year, month] = label.split('-');
              const date = new Date(parseInt(year), parseInt(month) - 1);
              return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="active" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Active"
          />
          <Line 
            type="monotone" 
            dataKey="closed" 
            stroke="hsl(var(--muted-foreground))" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Closed"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderPriceDistributionChart = (expanded = false) => {
    if (!priceDistribution?.length) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          No price distribution data available
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={expanded ? 400 : 200}>
        <BarChart data={priceDistribution}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="range" 
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <RechartsTooltip
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
    );
  };

  const renderChartContent = (chartId: string, expanded = false) => {
    switch (chartId) {
      case 'source-breakdown':
        return renderSourceBreakdownChart(expanded);
      case 'listings-trend':
        return renderListingsTrendChart(expanded);
      case 'price-distribution':
        return renderPriceDistributionChart(expanded);
      default:
        return null;
    }
  };

  const getChartMetrics = (chartId: string) => {
    switch (chartId) {
      case 'source-breakdown':
        if (!sourceBreakdown) return null;
        const closedSource = sourceBreakdown.database.Closed > 0 ? 'Database (fallback)' : 'Repliers API';
        return {
          'Active Listings': sourceBreakdown.repliers.Active.toLocaleString(),
          'Active Under Contract': sourceBreakdown.repliers['Active Under Contract'].toLocaleString(),
          'Closed Listings': (sourceBreakdown.repliers.Closed + sourceBreakdown.database.Closed).toLocaleString(),
          'Closed Source': closedSource,
        };
      case 'listings-trend':
        if (!listingsByMonth?.length) return null;
        const latest = listingsByMonth[listingsByMonth.length - 1];
        return {
          'Latest Active': latest?.active?.toLocaleString() || '0',
          'Latest Closed': latest?.closed?.toLocaleString() || '0',
          'Months Tracked': listingsByMonth.length.toString(),
        };
      case 'price-distribution':
        if (!priceDistribution?.length) return null;
        const total = priceDistribution.reduce((sum, p) => sum + p.count, 0);
        return {
          'Total Properties': total.toLocaleString(),
          'Price Ranges': priceDistribution.length.toString(),
        };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Marketing Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Marketing Insights
            </CardTitle>
            {lastUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {new Date(lastUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="text-xs">
            {CHART_SLIDES.length} Charts
          </Badge>
        </CardHeader>
        <CardContent>
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent>
              {CHART_SLIDES.map((slide) => (
                <CarouselItem key={slide.id} className="md:basis-1/2 lg:basis-1/2">
                  <div className="p-1">
                    <Card 
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => setZoomedChart(slide.id)}
                      data-testid={`chart-${slide.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <slide.icon className="w-4 h-4 text-primary" />
                            <CardTitle className="text-sm">{slide.title}</CardTitle>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedChart(slide.id);
                            }}
                            data-testid={`button-zoom-${slide.id}`}
                          >
                            <Maximize2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{slide.description}</p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="h-[200px]">
                          {renderChartContent(slide.id)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" data-testid="button-carousel-prev" />
            <CarouselNext className="right-2" data-testid="button-carousel-next" />
          </Carousel>
        </CardContent>
      </Card>

      <Dialog open={!!zoomedChart} onOpenChange={() => setZoomedChart(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {zoomedChart && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {CHART_SLIDES.find(s => s.id === zoomedChart)?.icon && (
                    <span className="text-primary">
                      {(() => {
                        const Icon = CHART_SLIDES.find(s => s.id === zoomedChart)?.icon;
                        return Icon ? <Icon className="w-5 h-5" /> : null;
                      })()}
                    </span>
                  )}
                  {CHART_SLIDES.find(s => s.id === zoomedChart)?.title}
                </DialogTitle>
                <DialogDescription>
                  {CHART_SLIDES.find(s => s.id === zoomedChart)?.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="h-[400px]">
                  {renderChartContent(zoomedChart, true)}
                </div>
                
                {getChartMetrics(zoomedChart) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    {Object.entries(getChartMetrics(zoomedChart) || {}).map(([label, value]) => (
                      <div key={label} className="text-center">
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {lastUpdatedAt && (
                  <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                    Data refreshed: {new Date(lastUpdatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
