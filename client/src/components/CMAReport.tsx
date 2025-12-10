import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from "recharts";
import { Save, Link as LinkIcon, Edit, FileText, Printer } from "lucide-react";
import type { Property, PropertyStatistics, TimelineDataPoint } from "@shared/schema";

interface CMAReportProps {
  properties: Property[];
  statistics: PropertyStatistics;
  timelineData: TimelineDataPoint[];
  isPreview?: boolean;
  expiresAt?: Date;
  onSave?: () => void;
  onPublicLink?: () => void;
  onModifySearch?: () => void;
  onModifyStats?: () => void;
  onAddNotes?: () => void;
  onPrint?: () => void;
}

export function CMAReport({ 
  properties, 
  statistics, 
  timelineData, 
  isPreview,
  expiresAt,
  onSave,
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
    <div className="space-y-6">
      {/* Preview Banner */}
      {isPreview && expiresAt && (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-md p-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm">
            You are seeing a preview of the report. This link will expire in 30 minutes.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={onSave} data-testid="button-save-send">
              <Save className="w-4 h-4 mr-2" />
              Save + Send
            </Button>
            <Button size="sm" variant="outline" onClick={onPublicLink} data-testid="button-public-link">
              <LinkIcon className="w-4 h-4 mr-2" />
              Public Link
            </Button>
            <Button size="sm" variant="outline" onClick={onModifySearch} data-testid="button-modify-search">
              <Edit className="w-4 h-4 mr-2" />
              Modify Search
            </Button>
            <Button size="sm" variant="outline" onClick={onModifyStats} data-testid="button-modify-stats">
              <FileText className="w-4 h-4 mr-2" />
              Modify Stats
            </Button>
            <Button size="sm" variant="outline" onClick={onAddNotes} data-testid="button-notes">
              Notes
            </Button>
            <Button size="sm" variant="outline" onClick={onPrint} data-testid="button-print">
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="home-averages" data-testid="tab-home-averages">Home Averages</TabsTrigger>
          <TabsTrigger value="listings" data-testid="tab-listings">Listings</TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
          <TabsTrigger value="market-stats" data-testid="tab-market-stats">Market Stats</TabsTrigger>
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
                  <TableRow>
                    <TableCell className="font-medium">Days on Market</TableCell>
                    <TableCell>
                      {statistics.daysOnMarket.range.min} - {statistics.daysOnMarket.range.max}
                    </TableCell>
                    <TableCell>{Math.round(statistics.daysOnMarket.average)}</TableCell>
                    <TableCell>{Math.round(statistics.daysOnMarket.median)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Liv SqFt</TableCell>
                    <TableCell>
                      {statistics.livingArea.range.min.toLocaleString()} SqFt - {statistics.livingArea.range.max.toLocaleString()} SqFt
                    </TableCell>
                    <TableCell>{Math.round(statistics.livingArea.average).toLocaleString()} SqFt</TableCell>
                    <TableCell>{Math.round(statistics.livingArea.median).toLocaleString()} SqFt</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Lot SqFt</TableCell>
                    <TableCell>
                      {statistics.lotSize.range.min.toLocaleString()} SqFt - {statistics.lotSize.range.max.toLocaleString()} SqFt
                    </TableCell>
                    <TableCell>{Math.round(statistics.lotSize.average).toLocaleString()} SqFt</TableCell>
                    <TableCell>{Math.round(statistics.lotSize.median).toLocaleString()} SqFt</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Acres</TableCell>
                    <TableCell>
                      {statistics.acres.range.min.toFixed(2)} Acres - {statistics.acres.range.max.toFixed(2)} Acres
                    </TableCell>
                    <TableCell>{statistics.acres.average.toFixed(2)} Acres</TableCell>
                    <TableCell>{statistics.acres.median.toFixed(2)} Acres</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Beds</TableCell>
                    <TableCell>
                      {statistics.bedrooms.range.min} - {statistics.bedrooms.range.max}
                    </TableCell>
                    <TableCell>{statistics.bedrooms.average.toFixed(1)}</TableCell>
                    <TableCell>{statistics.bedrooms.median}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Baths</TableCell>
                    <TableCell>
                      {statistics.bathrooms.range.min} - {statistics.bathrooms.range.max}
                    </TableCell>
                    <TableCell>{statistics.bathrooms.average.toFixed(1)}</TableCell>
                    <TableCell>{statistics.bathrooms.median}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Year Built</TableCell>
                    <TableCell>
                      {statistics.yearBuilt.range.min} - {statistics.yearBuilt.range.max}
                    </TableCell>
                    <TableCell>{Math.round(statistics.yearBuilt.average)}</TableCell>
                    <TableCell>{statistics.yearBuilt.median}</TableCell>
                  </TableRow>
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
                        <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
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
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis 
                        dataKey="price"
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'price') return `$${Number(value).toLocaleString()}`;
                          return value;
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Math.round(statistics.price.average).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Across all listings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg DOM</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(statistics.daysOnMarket.average)}</div>
                <p className="text-xs text-muted-foreground">Days on market</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Price/SqFt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${statistics.pricePerSqFt.average.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Per square foot</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeProperties.length}</div>
                <p className="text-xs text-muted-foreground">Currently on market</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
