import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, TrendingUp, Search, Loader2, AlertCircle, Home, MousePointerClick } from "lucide-react";
import type { Property } from "@shared/schema";

interface HomeReviewResponse {
  properties: Property[];
  total: number;
  hasMore: boolean;
  source: string;
}

interface CMABuilderProps {
  onCreateCMA: (data: {
    name: string;
    subjectPropertyId?: string;
    comparablePropertyIds: string[];
  }) => void;
}

export function CMABuilder({ onCreateCMA }: CMABuilderProps) {
  const [cmaName, setCmaName] = useState("");
  const [subjectProperty, setSubjectProperty] = useState<Property | null>(null);
  const [comparables, setComparables] = useState<Property[]>([]);
  const searchSectionRef = useRef<HTMLDivElement>(null);
  
  const [searchCity, setSearchCity] = useState("");
  const [searchSubdivision, setSearchSubdivision] = useState("");
  const [searchMinBeds, setSearchMinBeds] = useState("");
  const [searchMaxPrice, setSearchMaxPrice] = useState("");
  const [searchStatus, setSearchStatus] = useState("Closed");
  const [searchEnabled, setSearchEnabled] = useState(false);

  const buildSearchQuery = () => {
    const params = new URLSearchParams();
    if (searchStatus) params.append('statuses', searchStatus);
    if (searchCity) params.append('cities', searchCity.trim());
    if (searchSubdivision) params.append('subdivisions', searchSubdivision.trim());
    if (searchMinBeds) params.set('minBeds', searchMinBeds);
    if (searchMaxPrice) params.set('maxPrice', searchMaxPrice);
    params.set('limit', '20');
    return params.toString();
  };

  const { data: searchResponse, isLoading, isError, error, refetch } = useQuery<HomeReviewResponse>({
    queryKey: ['/api/homereview/properties', buildSearchQuery()],
    queryFn: async () => {
      const res = await fetch(`/api/homereview/properties?${buildSearchQuery()}`);
      if (!res.ok) throw new Error('Failed to search properties');
      return res.json();
    },
    enabled: searchEnabled,
    retry: 1,
  });

  const searchResults = searchResponse?.properties || [];
  const totalResults = searchResponse?.total || 0;

  const handleSearch = () => {
    setSearchEnabled(true);
    refetch();
  };

  const handleAddComparable = (property: Property) => {
    if (comparables.length < 6 && !comparables.find(p => p.id === property.id)) {
      setComparables([...comparables, property]);
    }
  };

  const handleRemoveComparable = (propertyId: string) => {
    setComparables(comparables.filter(p => p.id !== propertyId));
  };

  const handleSetSubject = (property: Property) => {
    setSubjectProperty(property);
  };

  const handleCreate = () => {
    if (comparables.length > 0) {
      onCreateCMA({
        name: cmaName || "Untitled CMA",
        subjectPropertyId: subjectProperty?.id,
        comparablePropertyIds: comparables.map(p => p.id),
      });
    }
  };

  const formatPrice = (price: string | number | null | undefined) => {
    if (!price) return 'N/A';
    return `$${Number(price).toLocaleString()}`;
  };

  const getPriceDisplay = (property: Property) => {
    if (property.standardStatus === 'Closed' && property.closePrice) {
      return formatPrice(property.closePrice);
    }
    return formatPrice(property.listPrice);
  };

  const getPriceLabel = (property: Property) => {
    if (property.standardStatus === 'Closed' && property.closePrice) {
      return 'Sold';
    }
    return 'List';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CMA Information</CardTitle>
          <CardDescription>Name your Comparative Market Analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cma-name">CMA Name</Label>
            <Input
              id="cma-name"
              placeholder="e.g., Market Analysis for 123 Main St"
              value={cmaName}
              onChange={(e) => setCmaName(e.target.value)}
              data-testid="input-cma-name"
            />
          </div>
        </CardContent>
      </Card>

      <Card ref={searchSectionRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Properties
          </CardTitle>
          <CardDescription>
            Find comparable properties from the HomeReview database (83,335+ properties)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                placeholder="e.g., Austin"
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                data-testid="input-search-city"
              />
            </div>
            <div className="space-y-2">
              <Label>Subdivision</Label>
              <Input
                placeholder="e.g., Barton Hills"
                value={searchSubdivision}
                onChange={(e) => setSearchSubdivision(e.target.value)}
                data-testid="input-search-subdivision"
              />
            </div>
            <div className="space-y-2">
              <Label>Min Beds</Label>
              <Select value={searchMinBeds} onValueChange={setSearchMinBeds}>
                <SelectTrigger data-testid="select-min-beds">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="5">5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Price</Label>
              <Select value={searchMaxPrice} onValueChange={setSearchMaxPrice}>
                <SelectTrigger data-testid="select-max-price">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="300000">$300K</SelectItem>
                  <SelectItem value="500000">$500K</SelectItem>
                  <SelectItem value="750000">$750K</SelectItem>
                  <SelectItem value="1000000">$1M</SelectItem>
                  <SelectItem value="2000000">$2M</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={searchStatus} onValueChange={setSearchStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Closed">Sold</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Under Contract">Under Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSearch} disabled={isLoading} data-testid="button-search-properties">
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Search Properties
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Subject Property</span>
              <Badge variant="outline">Optional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectProperty ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-md">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{subjectProperty.unparsedAddress}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant="secondary">{getPriceLabel(subjectProperty)}</Badge>
                        <span className="font-medium">{getPriceDisplay(subjectProperty)}</span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSubjectProperty(null)}
                      data-testid="button-remove-subject"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{subjectProperty.bedroomsTotal} beds</span>
                    <span>•</span>
                    <span>{subjectProperty.bathroomsTotalInteger} baths</span>
                    <span>•</span>
                    <span>{subjectProperty.livingArea && `${Number(subjectProperty.livingArea).toLocaleString()} sqft`}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This property will be the focus of your CMA analysis
                </p>
              </div>
            ) : (
              <div 
                className="text-center py-8 text-muted-foreground cursor-pointer hover-elevate rounded-lg border border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50"
                onClick={() => searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                data-testid="button-select-subject"
              >
                <Home className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm mb-2">No subject property selected</p>
                <p className="text-xs flex items-center justify-center gap-1">
                  <MousePointerClick className="w-3 h-3" />
                  Click here to search for a property
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Comparable Properties</span>
              <Badge>{comparables.length} / 6</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comparables.length > 0 ? (
              <div className="space-y-3">
                {comparables.map((property, index) => (
                  <div key={property.id} className="p-4 border rounded-md">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                          <p className="font-semibold text-sm line-clamp-1">{property.unparsedAddress}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{getPriceLabel(property)}</Badge>
                          <span className="font-medium">{getPriceDisplay(property)}</span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveComparable(property.id)}
                        data-testid={`button-remove-comparable-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{property.bedroomsTotal} beds</span>
                      <span>•</span>
                      <span>{property.bathroomsTotalInteger} baths</span>
                      <span>•</span>
                      <span>{property.livingArea && `${Number(property.livingArea).toLocaleString()} sqft`}</span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Add up to {6 - comparables.length} more properties
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm mb-2">No comparables selected</p>
                <p className="text-xs">Search and select properties to compare</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comparables.length > 0 ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Price</span>
                    <span className="font-semibold">
                      {formatPrice(
                        comparables.reduce((sum, p) => {
                          const price = p.standardStatus === 'Closed' && p.closePrice 
                            ? Number(p.closePrice) 
                            : Number(p.listPrice || 0);
                          return sum + price;
                        }, 0) / comparables.length
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Sqft</span>
                    <span className="font-semibold">
                      {Math.round(
                        comparables.reduce((sum, p) => sum + Number(p.livingArea || 0), 0) / comparables.length
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg $/Sqft</span>
                    <span className="font-semibold">
                      ${(
                        comparables.reduce((sum, p) => {
                          const price = p.standardStatus === 'Closed' && p.closePrice 
                            ? Number(p.closePrice) 
                            : Number(p.listPrice || 0);
                          const sqft = Number(p.livingArea || 1);
                          return sum + (price / sqft);
                        }, 0) / comparables.length
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price Range</span>
                    <span className="font-semibold text-xs">
                      {formatPrice(Math.min(...comparables.map(p => {
                        return p.standardStatus === 'Closed' && p.closePrice 
                          ? Number(p.closePrice) 
                          : Number(p.listPrice || 0);
                      })))} - {formatPrice(Math.max(...comparables.map(p => {
                        return p.standardStatus === 'Closed' && p.closePrice 
                          ? Number(p.closePrice) 
                          : Number(p.listPrice || 0);
                      })))}
                    </span>
                  </div>
                </div>

                <Separator />

                <Button 
                  className="w-full" 
                  onClick={handleCreate}
                  disabled={comparables.length === 0}
                  data-testid="button-generate-report"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Add properties to see analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Search Results {totalResults > 0 && `(${totalResults.toLocaleString()} found)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Searching properties...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" />
              <p className="text-sm text-destructive mb-2">Unable to search properties</p>
              <p className="text-xs text-muted-foreground">
                The HomeReview API may be temporarily unavailable. Please try again later.
              </p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((property) => (
                <div key={property.id} className="p-4 border rounded-md space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm line-clamp-2">{property.unparsedAddress}</p>
                    <Badge variant={property.standardStatus === 'Closed' ? 'secondary' : 'default'}>
                      {property.standardStatus === 'Closed' ? 'Sold' : property.standardStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{getPriceDisplay(property)}</span>
                    {property.closeDate && (
                      <span>• Sold {new Date(property.closeDate).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{property.bedroomsTotal} beds</span>
                    <span>•</span>
                    <span>{property.bathroomsTotalInteger} baths</span>
                    <span>•</span>
                    <span>{property.livingArea && `${Number(property.livingArea).toLocaleString()} sqft`}</span>
                  </div>
                  {property.livingArea && (
                    <div className="text-xs text-muted-foreground">
                      ${(
                        (property.standardStatus === 'Closed' && property.closePrice 
                          ? Number(property.closePrice) 
                          : Number(property.listPrice || 0)) / Number(property.livingArea)
                      ).toFixed(0)}/sqft
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSetSubject(property)}
                      disabled={subjectProperty?.id === property.id}
                      data-testid={`button-set-subject-${property.id}`}
                    >
                      Set as Subject
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAddComparable(property)}
                      disabled={comparables.some(p => p.id === property.id) || comparables.length >= 6}
                      data-testid={`button-add-comparable-${property.id}`}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : searchEnabled ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">No properties found matching your criteria</p>
              <p className="text-xs">Try adjusting your search filters</p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">Search for properties to add to your CMA</p>
              <p className="text-xs">Use the filters above and click "Search Properties"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
