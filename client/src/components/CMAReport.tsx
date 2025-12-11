import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from "recharts";
import { Save, Edit, FileText, Printer, Info, Home, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Property, PropertyStatistics, TimelineDataPoint } from "@shared/schema";

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

  // Group properties by status
  const allProperties = properties;
  const soldProperties = properties.filter(p => p.standardStatus === 'Closed');
  const underContractProperties = properties.filter(p => p.standardStatus === 'Under Contract');
  const activeProperties = properties.filter(p => p.standardStatus === 'Active');

  // Prepare chart data
  const priceRangeData = [
    { 
      name: 'Low', 
      value: statistics.price.range.min,
      fill: 'hsl(var(--chart-1))'
    },
    { 
      name: 'Avg', 
      value: statistics.price.average,
      fill: 'hsl(var(--chart-2))'
    },
    { 
      name: 'Med', 
      value: statistics.price.median,
      fill: 'hsl(var(--chart-3))'
    },
    { 
      name: 'High', 
      value: statistics.price.range.max,
      fill: 'hsl(var(--chart-4))'
    },
  ];

  return (
    <div className="space-y-6 cma-print">
      {/* Preview Banner - hidden in print/PDF */}
      {isPreview && expiresAt && (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-md p-4 flex items-center justify-between gap-4 flex-wrap print:hidden">
          <p className="text-sm">
            You are seeing a preview of the report.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={onSave} data-testid="button-save-cma">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onShareCMA} data-testid="button-share-cma-email">
              <Mail className="w-4 h-4 mr-2" />
              Share CMA
            </Button>
            <Button size="sm" variant="outline" onClick={onPrint} data-testid="button-print">
              <Printer className="w-4 h-4 mr-2" />
              Print
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
              <p className="text-2xl font-bold text-primary">${Math.round(statistics.price.average).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                Range: ${statistics.price.range.min.toLocaleString()} - ${statistics.price.range.max.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Price Per Sqft</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${statistics.pricePerSqFt.average.toFixed(0)}<span className="text-sm">/sqft</span></p>
              <p className="text-xs text-muted-foreground">
                Range: ${statistics.pricePerSqFt.range.min.toFixed(0)} - ${statistics.pricePerSqFt.range.max.toFixed(0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Avg Living Area</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{Math.round(statistics.livingArea.average).toLocaleString()}<span className="text-sm"> sqft</span></p>
              <p className="text-xs text-muted-foreground">
                {statistics.bedrooms.average.toFixed(1)} beds / {statistics.bathrooms.average.toFixed(1)} baths avg
              </p>
            </CardContent>
          </Card>
        </div>
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
            Listings
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="max-w-md z-50">
                <p>Detailed breakdown of comparable properties by status: Active, Under Contract, and Sold listings with price distribution.</p>
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
              <CardTitle>Statistics ({allProperties.length} Properties)</CardTitle>
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
                        ${statistics.price.range.min.toLocaleString()} - ${statistics.price.range.max.toLocaleString()}
                      </TableCell>
                      <TableCell data-testid="text-price-average">
                        ${Math.round(statistics.price.average).toLocaleString()}
                      </TableCell>
                      <TableCell data-testid="text-price-median">
                        ${Math.round(statistics.price.median).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('pricePerSqFt') && (
                    <TableRow>
                      <TableCell className="font-medium">Price/SqFt</TableCell>
                      <TableCell>
                        ${statistics.pricePerSqFt.range.min.toFixed(2)}/SqFt - ${statistics.pricePerSqFt.range.max.toFixed(2)}/SqFt
                      </TableCell>
                      <TableCell>
                        ${statistics.pricePerSqFt.average.toFixed(2)}/SqFt
                      </TableCell>
                      <TableCell>
                        ${statistics.pricePerSqFt.median.toFixed(2)}/SqFt
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('daysOnMarket') && (
                    <TableRow>
                      <TableCell className="font-medium">Days on Market</TableCell>
                      <TableCell>
                        {statistics.daysOnMarket.range.min} - {statistics.daysOnMarket.range.max}
                      </TableCell>
                      <TableCell>{Math.round(statistics.daysOnMarket.average)}</TableCell>
                      <TableCell>{Math.round(statistics.daysOnMarket.median)}</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('livingArea') && (
                    <TableRow>
                      <TableCell className="font-medium">Liv SqFt</TableCell>
                      <TableCell>
                        {statistics.livingArea.range.min.toLocaleString()} SqFt - {statistics.livingArea.range.max.toLocaleString()} SqFt
                      </TableCell>
                      <TableCell>{Math.round(statistics.livingArea.average).toLocaleString()} SqFt</TableCell>
                      <TableCell>{Math.round(statistics.livingArea.median).toLocaleString()} SqFt</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('lotSize') && (
                    <TableRow>
                      <TableCell className="font-medium">Lot SqFt</TableCell>
                      <TableCell>
                        {statistics.lotSize.range.min.toLocaleString()} SqFt - {statistics.lotSize.range.max.toLocaleString()} SqFt
                      </TableCell>
                      <TableCell>{Math.round(statistics.lotSize.average).toLocaleString()} SqFt</TableCell>
                      <TableCell>{Math.round(statistics.lotSize.median).toLocaleString()} SqFt</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('acres') && (
                    <TableRow>
                      <TableCell className="font-medium">Acres</TableCell>
                      <TableCell>
                        {statistics.acres.range.min.toFixed(2)} Acres - {statistics.acres.range.max.toFixed(2)} Acres
                      </TableCell>
                      <TableCell>{statistics.acres.average.toFixed(2)} Acres</TableCell>
                      <TableCell>{statistics.acres.median.toFixed(2)} Acres</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('bedrooms') && (
                    <TableRow>
                      <TableCell className="font-medium">Beds</TableCell>
                      <TableCell>
                        {statistics.bedrooms.range.min} - {statistics.bedrooms.range.max}
                      </TableCell>
                      <TableCell>{statistics.bedrooms.average.toFixed(1)}</TableCell>
                      <TableCell>{statistics.bedrooms.median}</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('bathrooms') && (
                    <TableRow>
                      <TableCell className="font-medium">Baths</TableCell>
                      <TableCell>
                        {statistics.bathrooms.range.min} - {statistics.bathrooms.range.max}
                      </TableCell>
                      <TableCell>{statistics.bathrooms.average.toFixed(1)}</TableCell>
                      <TableCell>{statistics.bathrooms.median}</TableCell>
                    </TableRow>
                  )}
                  {visibleMetrics.includes('yearBuilt') && (
                    <TableRow>
                      <TableCell className="font-medium">Year Built</TableCell>
                      <TableCell>
                        {statistics.yearBuilt.range.min} - {statistics.yearBuilt.range.max}
                      </TableCell>
                      <TableCell>{Math.round(statistics.yearBuilt.average)}</TableCell>
                      <TableCell>{statistics.yearBuilt.median}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Listings Tab */}
        <TabsContent value="listings" className="space-y-6">
          <Tabs value={activeListingTab} onValueChange={setActiveListingTab}>
            <TabsList>
              <TabsTrigger value="all" data-testid="subtab-all">All ({allProperties.length})</TabsTrigger>
              <TabsTrigger value="sold" data-testid="subtab-sold">Sold ({soldProperties.length})</TabsTrigger>
              <TabsTrigger value="under-contract" data-testid="subtab-under-contract">
                Under Contract ({underContractProperties.length})
              </TabsTrigger>
              <TabsTrigger value="active" data-testid="subtab-active">Active ({activeProperties.length})</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Price Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
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
            </div>
          </Tabs>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
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
                    <span className="text-sm">Under Contract</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm">Closed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500"></div>
                    <span className="text-sm">Trend Line</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {timelineData.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                      <XAxis 
                        dataKey="date" 
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        className="text-xs"
                      />
                      <YAxis 
                        dataKey="price"
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        className="text-xs"
                      />
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length > 0) {
                            const data = payload[0].payload;
                            const statusColor = data.status === 'Active' ? 'text-green-600' : 
                                               data.status === 'Under Contract' ? 'text-yellow-600' : 'text-red-600';
                            return (
                              <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                <p className="font-semibold text-foreground mb-1">{data.address || 'Property'}</p>
                                <div className="space-y-1 text-muted-foreground">
                                  <p className="flex justify-between gap-4">
                                    <span>Status:</span>
                                    <span className={`font-medium ${statusColor}`}>{data.status}</span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span>{data.status === 'Closed' ? 'Sold Price:' : 'List Price:'}</span>
                                    <span className="font-medium text-foreground">${Number(data.price).toLocaleString()}</span>
                                  </p>
                                  <p className="flex justify-between gap-4">
                                    <span>{data.status === 'Closed' ? 'Sold Date:' : 'List Date:'}</span>
                                    <span className="font-medium text-foreground">{new Date(data.date).toLocaleDateString()}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter 
                        name="Properties" 
                        data={timelineData.map(d => ({ 
                          ...d, 
                          date: new Date(d.date).getTime(),
                          fill: d.status === 'Active' ? '#22c55e' : d.status === 'Under Contract' ? '#eab308' : '#ef4444'
                        }))} 
                        fill="hsl(var(--primary))"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-2">No timeline data available</p>
                    <p className="text-sm">Timeline data requires properties with listing or closing dates.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market Stats Tab */}
        <TabsContent value="market-stats" className="space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Math.round(statistics.price.average).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Across all {allProperties.length} comparables</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg DOM</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(statistics.daysOnMarket.average)}</div>
                <p className="text-xs text-muted-foreground">Days on market</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Price/SqFt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${statistics.pricePerSqFt.average.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Per square foot</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Price Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">${(statistics.price.range.min / 1000).toFixed(0)}K - ${(statistics.price.range.max / 1000).toFixed(0)}K</div>
                <p className="text-xs text-muted-foreground">Min to max</p>
              </CardContent>
            </Card>
          </div>

          {/* Status Breakdown with Property Details */}
          {/* Active Properties */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="bg-green-50 dark:bg-green-950/30 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <CardTitle className="text-base text-green-700 dark:text-green-400">
                  Active Listings ({activeProperties.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {activeProperties.length > 0 ? (
                <div className="space-y-3">
                  {activeProperties.map((property) => {
                    const photos = (property as any).photos as string[] | undefined;
                    const primaryPhoto = photos?.[0];
                    const price = property.listPrice ? Number(property.listPrice) : 0;
                    const pricePerSqft = property.livingArea ? price / Number(property.livingArea) : null;
                    return (
                      <div key={property.id} className="flex gap-3 p-2 rounded-md border bg-card">
                        {primaryPhoto ? (
                          <img src={primaryPhoto} alt={property.unparsedAddress || ''} className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                        ) : (
                          <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <Home className="w-6 h-6 text-muted-foreground/50" />
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
                            {property.daysOnMarket && <span>{property.daysOnMarket} DOM</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{property.propertySubType || property.propertyType}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No active listings in this CMA</p>
              )}
            </CardContent>
          </Card>

          {/* Under Contract Properties */}
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader className="bg-yellow-50 dark:bg-yellow-950/30 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <CardTitle className="text-base text-yellow-700 dark:text-yellow-400">
                  Under Contract ({underContractProperties.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {underContractProperties.length > 0 ? (
                <div className="space-y-3">
                  {underContractProperties.map((property) => {
                    const photos = (property as any).photos as string[] | undefined;
                    const primaryPhoto = photos?.[0];
                    const price = property.listPrice ? Number(property.listPrice) : 0;
                    const pricePerSqft = property.livingArea ? price / Number(property.livingArea) : null;
                    return (
                      <div key={property.id} className="flex gap-3 p-2 rounded-md border bg-card">
                        {primaryPhoto ? (
                          <img src={primaryPhoto} alt={property.unparsedAddress || ''} className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                        ) : (
                          <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <Home className="w-6 h-6 text-muted-foreground/50" />
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
                            {property.daysOnMarket && <span>{property.daysOnMarket} DOM</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{property.propertySubType || property.propertyType}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No under contract listings in this CMA</p>
              )}
            </CardContent>
          </Card>

          {/* Sold/Closed Properties */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="bg-red-50 dark:bg-red-950/30 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <CardTitle className="text-base text-red-700 dark:text-red-400">
                  Sold/Closed ({soldProperties.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {soldProperties.length > 0 ? (
                <div className="space-y-3">
                  {soldProperties.map((property) => {
                    const photos = (property as any).photos as string[] | undefined;
                    const primaryPhoto = photos?.[0];
                    const price = property.closePrice ? Number(property.closePrice) : (property.listPrice ? Number(property.listPrice) : 0);
                    const pricePerSqft = property.livingArea ? price / Number(property.livingArea) : null;
                    return (
                      <div key={property.id} className="flex gap-3 p-2 rounded-md border bg-card">
                        {primaryPhoto ? (
                          <img src={primaryPhoto} alt={property.unparsedAddress || ''} className="w-20 h-20 object-cover rounded-md flex-shrink-0" />
                        ) : (
                          <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <Home className="w-6 h-6 text-muted-foreground/50" />
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
                            {property.closeDate && <span>Sold: {new Date(property.closeDate).toLocaleDateString()}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{property.propertySubType || property.propertyType}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No sold/closed listings in this CMA</p>
              )}
            </CardContent>
          </Card>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Median Price</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Math.round(statistics.price.median).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">50th percentile</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg SqFt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(statistics.livingArea.average).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Living area</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg Beds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.bedrooms.average.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Bedrooms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                <CardTitle className="text-sm font-medium">Avg Baths</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.bathrooms.average.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Bathrooms</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
