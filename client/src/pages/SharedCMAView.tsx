import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Home, TrendingUp, Calendar, FileText, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Property, PropertyStatistics, TimelineDataPoint } from "@shared/schema";

interface SharedCMAData {
  cma: {
    id: string;
    name: string;
    notes: string | null;
    createdAt: string;
    expiresAt: string | null;
  };
  properties: Property[];
  statistics: PropertyStatistics;
  timelineData: TimelineDataPoint[];
}

export default function SharedCMAView() {
  const { token } = useParams<{ token: string }>();
  
  // Photo modal state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Get photos from property
  const getPropertyPhotos = (property: Property): string[] => {
    const photos = (property as any).photos as string[] | undefined;
    if (photos && photos.length > 0) return photos;
    return [];
  };
  
  // Handle photo click
  const handlePhotoClick = (property: Property) => {
    const photos = getPropertyPhotos(property);
    if (photos.length > 0) {
      setSelectedProperty(property);
      setPhotoIndex(0);
      setPhotoModalOpen(true);
    }
  };
  
  // Auto-advance carousel
  useEffect(() => {
    if (autoAdvanceRef.current) {
      clearInterval(autoAdvanceRef.current);
    }
    
    if (selectedProperty && photoModalOpen) {
      const photos = getPropertyPhotos(selectedProperty);
      if (photos.length > 1) {
        autoAdvanceRef.current = setInterval(() => {
          setPhotoIndex((prev) => (prev + 1) % photos.length);
        }, 3000);
      }
    }
    
    return () => {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
      }
    };
  }, [selectedProperty, photoModalOpen]);

  const { data, isLoading, isError, error } = useQuery<SharedCMAData>({
    queryKey: ['/api/share/cma', token],
    queryFn: async () => {
      const res = await fetch(`/api/share/cma/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load CMA');
      }
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading CMA...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unable to Load CMA</h2>
              <p className="text-muted-foreground">
                {(error as Error).message || 'This CMA link may have expired or is invalid.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { cma, properties, statistics, timelineData } = data;
  const soldProperties = properties.filter(p => p.standardStatus === 'Closed');
  const activeProperties = properties.filter(p => p.standardStatus === 'Active');
  const underContractProperties = properties.filter(p => p.standardStatus === 'Under Contract');

  const formatPrice = (price: number | string | null | undefined) => {
    if (!price) return 'N/A';
    return `$${Number(price).toLocaleString()}`;
  };

  const getPriceDisplay = (property: Property) => {
    if (property.standardStatus === 'Closed' && property.closePrice) {
      return formatPrice(property.closePrice);
    }
    return formatPrice(property.listPrice);
  };

  const priceChartData = properties.map(p => ({
    address: p.unparsedAddress?.split(',')[0] || 'Unknown',
    price: p.standardStatus === 'Closed' && p.closePrice 
      ? Number(p.closePrice) 
      : Number(p.listPrice || 0),
    status: p.standardStatus,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl">{cma.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Calendar className="w-4 h-4" />
                  Created {new Date(cma.createdAt).toLocaleDateString()}
                  {cma.expiresAt && (
                    <span className="text-amber-600 dark:text-amber-400">
                       Link expires {new Date(cma.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {properties.length} Properties
              </Badge>
            </div>
          </CardHeader>
          {cma.notes && (
            <CardContent>
              <p className="text-muted-foreground">{cma.notes}</p>
            </CardContent>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Average Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {formatPrice(statistics.price.average)}
              </p>
              <p className="text-sm text-muted-foreground">
                Range: {formatPrice(statistics.price.range.min)} - {formatPrice(statistics.price.range.max)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Price Per Sqft</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                ${statistics.pricePerSqFt.average.toFixed(0)}<span className="text-lg">/sqft</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Range: ${statistics.pricePerSqFt.range.min.toFixed(0)} - ${statistics.pricePerSqFt.range.max.toFixed(0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Avg Living Area</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {Math.round(statistics.livingArea.average).toLocaleString()}<span className="text-lg"> sqft</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {statistics.bedrooms.average.toFixed(1)} beds / {statistics.bathrooms.average.toFixed(1)} baths avg
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Statistics Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Metric</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>Median</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Price</TableCell>
                  <TableCell>{formatPrice(statistics.price.range.min)} - {formatPrice(statistics.price.range.max)}</TableCell>
                  <TableCell>{formatPrice(statistics.price.average)}</TableCell>
                  <TableCell>{formatPrice(statistics.price.median)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Price/SqFt</TableCell>
                  <TableCell>${statistics.pricePerSqFt.range.min.toFixed(0)} - ${statistics.pricePerSqFt.range.max.toFixed(0)}</TableCell>
                  <TableCell>${statistics.pricePerSqFt.average.toFixed(0)}</TableCell>
                  <TableCell>${statistics.pricePerSqFt.median.toFixed(0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Living Area</TableCell>
                  <TableCell>{statistics.livingArea.range.min.toLocaleString()} - {statistics.livingArea.range.max.toLocaleString()} sqft</TableCell>
                  <TableCell>{Math.round(statistics.livingArea.average).toLocaleString()} sqft</TableCell>
                  <TableCell>{Math.round(statistics.livingArea.median).toLocaleString()} sqft</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Year Built</TableCell>
                  <TableCell>{statistics.yearBuilt.range.min} - {statistics.yearBuilt.range.max}</TableCell>
                  <TableCell>{Math.round(statistics.yearBuilt.average)}</TableCell>
                  <TableCell>{statistics.yearBuilt.median}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {priceChartData.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Price Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priceChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="address" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']}
                    />
                    <Bar dataKey="price" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CMA Market Review Summary */}
        <Card className="mb-6 border-primary/30 bg-primary/5">
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
                  Based on {properties.length} comparable properties, the average price is{' '}
                  <span className="font-semibold text-foreground">${Math.round(statistics.price.average).toLocaleString()}</span>{' '}
                  with a median of{' '}
                  <span className="font-semibold text-foreground">${Math.round(statistics.price.median).toLocaleString()}</span>.
                  {' '}Prices range from ${statistics.price.range.min.toLocaleString()} to ${statistics.price.range.max.toLocaleString()}.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Price Per Square Foot</h4>
                <p className="text-sm text-muted-foreground">
                  Average price per square foot is{' '}
                  <span className="font-semibold text-foreground">${statistics.pricePerSqFt.average.toFixed(2)}</span>{' '}
                  across comparable properties. This ranges from ${statistics.pricePerSqFt.range.min.toFixed(2)} to ${statistics.pricePerSqFt.range.max.toFixed(2)}/sqft.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Days on Market</h4>
                <p className="text-sm text-muted-foreground">
                  Average: <span className="font-semibold text-foreground">{Math.round(statistics.daysOnMarket.average)} days</span>
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Property Size</h4>
                <p className="text-sm text-muted-foreground">
                  Avg: <span className="font-semibold text-foreground">{Math.round(statistics.livingArea.average).toLocaleString()} sqft</span>
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Bed/Bath</h4>
                <p className="text-sm text-muted-foreground">
                  Avg: <span className="font-semibold text-foreground">{statistics.bedrooms.average.toFixed(1)} beds / {statistics.bathrooms.average.toFixed(1)} baths</span>
                </p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic">
                This analysis is based on {activeProperties.length} active, {underContractProperties.length} under contract, and {soldProperties.length} sold/closed properties in your selection.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Property Listings
            </CardTitle>
            <CardDescription>
              {soldProperties.length > 0 && (
                <Badge variant="secondary" className="mr-2">{soldProperties.length} Sold</Badge>
              )}
              {activeProperties.length > 0 && (
                <Badge variant="default">{activeProperties.length} Active</Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {properties.map((property) => {
                const photos = getPropertyPhotos(property);
                const hasPhotos = photos.length > 0;
                return (
                  <Card key={property.id} className="overflow-hidden">
                    {hasPhotos && (
                      <div 
                        className="relative h-48 cursor-pointer group"
                        onClick={() => handlePhotoClick(property)}
                        data-testid={`property-photo-${property.id}`}
                      >
                        <img 
                          src={photos[0]} 
                          alt={property.unparsedAddress || 'Property'} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        {photos.length > 1 && (
                          <Badge 
                            variant="secondary" 
                            className="absolute bottom-2 right-2 bg-black/60 text-white border-0"
                          >
                            +{photos.length - 1} photos
                          </Badge>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm line-clamp-1">{property.unparsedAddress}</p>
                          <p className="text-xs text-muted-foreground">
                            {property.city}, {property.stateOrProvince} {property.postalCode}
                          </p>
                        </div>
                        <Badge variant={property.standardStatus === 'Closed' ? 'secondary' : 'default'}>
                          {property.standardStatus === 'Closed' ? 'Sold' : property.standardStatus}
                        </Badge>
                      </div>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Price:</span>
                          <span className="ml-2 font-medium">{getPriceDisplay(property)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">$/SqFt:</span>
                          <span className="ml-2 font-medium">
                            ${property.livingArea 
                              ? ((property.standardStatus === 'Closed' && property.closePrice 
                                  ? Number(property.closePrice) 
                                  : Number(property.listPrice || 0)) / Number(property.livingArea)).toFixed(0)
                              : 'N/A'
                            }
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Beds/Baths:</span>
                          <span className="ml-2 font-medium">{property.bedroomsTotal} / {property.bathroomsTotalInteger}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SqFt:</span>
                          <span className="ml-2 font-medium">{Number(property.livingArea || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Year:</span>
                          <span className="ml-2 font-medium">{property.yearBuilt || 'N/A'}</span>
                        </div>
                        {property.closeDate && (
                          <div>
                            <span className="text-muted-foreground">Sold:</span>
                            <span className="ml-2 font-medium">{new Date(property.closeDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Comparative Market Analysis provided by MLS Grid IDX Platform</p>
        </div>
      </div>
      
      {/* Photo Modal */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedProperty && (
            <div className="relative">
              <div className="relative aspect-video bg-black">
                <img
                  src={getPropertyPhotos(selectedProperty)[photoIndex]}
                  alt={`Photo ${photoIndex + 1}`}
                  className="w-full h-full object-contain"
                />
                {getPropertyPhotos(selectedProperty).length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setPhotoIndex((prev) => 
                        (prev - 1 + getPropertyPhotos(selectedProperty).length) % getPropertyPhotos(selectedProperty).length
                      )}
                      data-testid="button-photo-prev"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setPhotoIndex((prev) => 
                        (prev + 1) % getPropertyPhotos(selectedProperty).length
                      )}
                      data-testid="button-photo-next"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </>
                )}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                  {photoIndex + 1} / {getPropertyPhotos(selectedProperty).length}
                </div>
              </div>
              <div className="p-4 bg-background">
                <h3 className="font-semibold">{selectedProperty.unparsedAddress}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedProperty.city}, {selectedProperty.stateOrProvince} {selectedProperty.postalCode}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="font-semibold">{getPriceDisplay(selectedProperty)}</span>
                  <span>{selectedProperty.bedroomsTotal} bed / {selectedProperty.bathroomsTotalInteger} bath</span>
                  <span>{Number(selectedProperty.livingArea || 0).toLocaleString()} sqft</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
