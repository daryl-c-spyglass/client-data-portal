import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, TrendingUp, Search, Loader2, AlertCircle, Home, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Property } from "@shared/schema";

interface AutocompleteInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  endpoint: string;
  testId?: string;
  className?: string;
  name?: string;
}

function AutocompleteInput({ placeholder, value, onChange, endpoint, testId, className, name }: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchSuggestions(inputValue);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [inputValue, fetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(true);
    onChange(newValue);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    onChange(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        data-testid={testId}
        name={name}
        autoComplete="off"
        className={cn("h-10", className)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-3 py-2 cursor-pointer hover-elevate text-sm"
              onClick={() => handleSuggestionClick(suggestion)}
              data-testid={`suggestion-${testId}-${index}`}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
      {isLoading && inputValue.length >= 2 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

interface UnifiedSearchResponse {
  properties: Property[];
  count: number;
  status: string;
}

interface CMABuilderProps {
  onCreateCMA: (data: {
    name: string;
    subjectPropertyId?: string;
    comparablePropertyIds: string[];
    propertiesData: any[];
  }) => void;
}

export function CMABuilder({ onCreateCMA }: CMABuilderProps) {
  const [cmaName, setCmaName] = useState("");
  const [hasUserEditedName, setHasUserEditedName] = useState(false);
  const [subjectProperty, setSubjectProperty] = useState<Property | null>(null);
  const [comparables, setComparables] = useState<Property[]>([]);
  const searchSectionRef = useRef<HTMLDivElement>(null);
  
  const [searchCity, setSearchCity] = useState("");
  const [searchSubdivision, setSearchSubdivision] = useState("");
  const [searchMinBeds, setSearchMinBeds] = useState("");
  const [searchMaxPrice, setSearchMaxPrice] = useState("");
  const [searchStatuses, setSearchStatuses] = useState<string[]>(["active"]);
  const [searchEnabled, setSearchEnabled] = useState(false);

  // Generate default CMA name based on subdivision, status, and date/time
  const generateDefaultName = useCallback(() => {
    const parts: string[] = [];
    
    // Use subdivision if available, otherwise city
    if (searchSubdivision.trim()) {
      parts.push(searchSubdivision.trim());
    } else if (searchCity.trim()) {
      parts.push(searchCity.trim());
    }
    
    // Format status(es)
    if (searchStatuses.length > 0) {
      const statusMap: Record<string, string> = {
        'active': 'Active',
        'under_contract': 'Under Contract',
        'closed': 'Sold/Closed'
      };
      const formattedStatuses = searchStatuses.map(s => statusMap[s] || s).join('/');
      parts.push(formattedStatuses);
    }
    
    // Add current date/time
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    parts.push(`${dateStr} ${timeStr}`);
    
    return parts.join(' - ');
  }, [searchSubdivision, searchCity, searchStatuses]);

  // Auto-update CMA name when search criteria changes (unless user has manually edited)
  // Always generate a default name - even on initial load with just the default "active" status
  useEffect(() => {
    if (!hasUserEditedName) {
      setCmaName(generateDefaultName());
    }
  }, [searchSubdivision, searchCity, searchStatuses, hasUserEditedName, generateDefaultName]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCmaName(e.target.value);
    setHasUserEditedName(true);
  };
  const [searchMinSqft, setSearchMinSqft] = useState("");
  const [searchMaxSqft, setSearchMaxSqft] = useState("");
  const [searchMinLotAcres, setSearchMinLotAcres] = useState("");
  const [searchMaxLotAcres, setSearchMaxLotAcres] = useState("");
  const [searchStories, setSearchStories] = useState("");
  const [searchMinYearBuilt, setSearchMinYearBuilt] = useState("");
  const [searchMaxYearBuilt, setSearchMaxYearBuilt] = useState("");
  const [searchSoldDays, setSearchSoldDays] = useState("");

  const resetForm = () => {
    setCmaName("");
    setHasUserEditedName(false);
    setSubjectProperty(null);
    setComparables([]);
    setSearchCity("");
    setSearchSubdivision("");
    setSearchMinBeds("");
    setSearchMaxPrice("");
    setSearchStatuses(["active"]);
    setSearchEnabled(false);
    setSearchMinSqft("");
    setSearchMaxSqft("");
    setSearchMinLotAcres("");
    setSearchMaxLotAcres("");
    setSearchStories("");
    setSearchMinYearBuilt("");
    setSearchMaxYearBuilt("");
    setSearchSoldDays("");
  };

  const buildSearchQuery = () => {
    const params = new URLSearchParams();
    // Support multiple statuses as comma-separated values
    if (searchStatuses.length > 0) {
      params.set('statuses', searchStatuses.join(','));
    }
    if (searchCity) params.set('city', searchCity.trim());
    if (searchSubdivision) params.set('subdivision', searchSubdivision.trim());
    if (searchMinBeds && searchMinBeds !== 'any') params.set('bedsMin', searchMinBeds);
    if (searchMaxPrice && searchMaxPrice !== 'any') params.set('maxPrice', searchMaxPrice);
    if (searchMinSqft) params.set('minSqft', searchMinSqft);
    if (searchMaxSqft) params.set('maxSqft', searchMaxSqft);
    if (searchMinLotAcres) params.set('minLotAcres', searchMinLotAcres);
    if (searchMaxLotAcres) params.set('maxLotAcres', searchMaxLotAcres);
    if (searchStories && searchStories !== 'any') params.set('stories', searchStories);
    if (searchMinYearBuilt) params.set('minYearBuilt', searchMinYearBuilt);
    if (searchMaxYearBuilt) params.set('maxYearBuilt', searchMaxYearBuilt);
    if (searchSoldDays && searchSoldDays !== 'any') params.set('soldDays', searchSoldDays);
    params.set('limit', '20');
    return params.toString();
  };
  
  const toggleStatus = (status: string) => {
    setSearchStatuses(prev => {
      if (prev.includes(status)) {
        // Don't allow deselecting all statuses
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const { data: searchResponse, isLoading, isError, error, refetch } = useQuery<UnifiedSearchResponse>({
    queryKey: ['/api/search', buildSearchQuery()],
    queryFn: async () => {
      const res = await fetch(`/api/search?${buildSearchQuery()}`);
      if (!res.ok) throw new Error('Failed to search properties');
      return res.json();
    },
    enabled: searchEnabled,
    retry: 1,
  });

  const searchResults = searchResponse?.properties || [];
  const totalResults = searchResponse?.count || 0;

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

  const generateDefaultCMAName = () => {
    // Get status description
    const statusLabels = searchStatuses.map(s => {
      if (s === 'active') return 'Active';
      if (s === 'under_contract') return 'Under Contract';
      if (s === 'closed') return 'Sold/Closed';
      return s;
    }).join(' & ');
    
    // Get location from search criteria or first property
    const location = searchSubdivision 
      || searchCity 
      || comparables[0]?.subdivision 
      || comparables[0]?.city 
      || 'Properties';
    
    // Format current date/time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${location} - ${statusLabels} - ${dateStr} ${timeStr}`;
  };

  const handleCreate = () => {
    if (comparables.length > 0) {
      const allProperties = subjectProperty 
        ? [subjectProperty, ...comparables] 
        : comparables;
      
      // Use user-provided name or generate a descriptive default
      const finalName = cmaName.trim() || generateDefaultCMAName();
      
      onCreateCMA({
        name: finalName,
        subjectPropertyId: subjectProperty?.id,
        comparablePropertyIds: comparables.map(p => p.id),
        propertiesData: allProperties,
      });
      resetForm();
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
              name="cma-name"
              placeholder="Auto-generated: Subdivision - Status - Date/Time"
              value={cmaName}
              onChange={handleNameChange}
              data-testid="input-cma-name"
              autoComplete="on"
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
            Find comparable properties from the Repliers database (30,000+ active listings)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <AutocompleteInput
                placeholder="e.g., Austin"
                value={searchCity}
                onChange={setSearchCity}
                endpoint="/api/autocomplete/cities"
                testId="input-search-city"
                name="city"
              />
            </div>
            <div className="space-y-2">
              <Label>Subdivision</Label>
              <AutocompleteInput
                placeholder="e.g., Barton Hills"
                value={searchSubdivision}
                onChange={setSearchSubdivision}
                endpoint="/api/autocomplete/subdivisions"
                testId="input-search-subdivision"
                name="subdivision"
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
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="status-active"
                    checked={searchStatuses.includes("active")}
                    onCheckedChange={() => toggleStatus("active")}
                    data-testid="checkbox-status-active"
                  />
                  <label htmlFor="status-active" className="text-sm cursor-pointer">Active</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="status-under-contract"
                    checked={searchStatuses.includes("under_contract")}
                    onCheckedChange={() => toggleStatus("under_contract")}
                    data-testid="checkbox-status-under-contract"
                  />
                  <label htmlFor="status-under-contract" className="text-sm cursor-pointer">Under Contract</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="status-closed"
                    checked={searchStatuses.includes("closed")}
                    onCheckedChange={() => toggleStatus("closed")}
                    data-testid="checkbox-status-closed"
                  />
                  <label htmlFor="status-closed" className="text-sm cursor-pointer">Sold/Closed</label>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="space-y-2">
              <Label>Sold Date</Label>
              <Select value={searchSoldDays} onValueChange={setSearchSoldDays}>
                <SelectTrigger data-testid="select-sold-days">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="30">0-30 days</SelectItem>
                  <SelectItem value="60">0-60 days</SelectItem>
                  <SelectItem value="90">0-90 days</SelectItem>
                  <SelectItem value="120">0-120 days</SelectItem>
                  <SelectItem value="150">0-150 days</SelectItem>
                  <SelectItem value="180">0-180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Min Sq Ft</Label>
              <Input
                type="number"
                placeholder="e.g., 1500"
                value={searchMinSqft}
                onChange={(e) => setSearchMinSqft(e.target.value)}
                data-testid="input-min-sqft"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Sq Ft</Label>
              <Input
                type="number"
                placeholder="e.g., 3000"
                value={searchMaxSqft}
                onChange={(e) => setSearchMaxSqft(e.target.value)}
                data-testid="input-max-sqft"
              />
            </div>
            <div className="space-y-2">
              <Label>Min Lot (Acres)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g., 0.25"
                value={searchMinLotAcres}
                onChange={(e) => setSearchMinLotAcres(e.target.value)}
                data-testid="input-min-lot-acres"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Lot (Acres)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g., 1.0"
                value={searchMaxLotAcres}
                onChange={(e) => setSearchMaxLotAcres(e.target.value)}
                data-testid="input-max-lot-acres"
              />
            </div>
            <div className="space-y-2">
              <Label>Stories</Label>
              <Select value={searchStories} onValueChange={setSearchStories}>
                <SelectTrigger data-testid="select-stories">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Min Year Built</Label>
              <Input
                type="number"
                placeholder="e.g., 1990"
                value={searchMinYearBuilt}
                onChange={(e) => setSearchMinYearBuilt(e.target.value)}
                data-testid="input-min-year-built"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Year Built</Label>
              <Input
                type="number"
                placeholder="e.g., 2024"
                value={searchMaxYearBuilt}
                onChange={(e) => setSearchMaxYearBuilt(e.target.value)}
                data-testid="input-max-year-built"
              />
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
                The property search service may be temporarily unavailable. Please try again later.
              </p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((property) => {
                // Photos may be included in additionalData or media from Repliers API
                const additionalData = property.additionalData as { photos?: string[] } | null;
                const primaryPhoto = additionalData?.photos?.[0];
                const pricePerSqft = property.livingArea 
                  ? (property.standardStatus === 'Closed' && property.closePrice 
                      ? Number(property.closePrice) 
                      : Number(property.listPrice || 0)) / Number(property.livingArea)
                  : null;
                
                return (
                  <Card key={property.id} className="overflow-hidden">
                    <div className="flex">
                      {primaryPhoto ? (
                        <div className="w-32 h-32 flex-shrink-0">
                          <img 
                            src={primaryPhoto} 
                            alt={property.unparsedAddress || 'Property'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-32 h-32 flex-shrink-0 bg-muted flex items-center justify-center">
                          <Home className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <CardContent className="flex-1 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm line-clamp-1" data-testid={`text-address-${property.id}`}>
                              {property.unparsedAddress}
                            </p>
                            {property.subdivision && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {property.subdivision}
                              </p>
                            )}
                          </div>
                          <Badge variant={property.standardStatus === 'Closed' ? 'secondary' : 'default'} className="flex-shrink-0">
                            {property.standardStatus === 'Closed' ? 'Sold' : property.standardStatus}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-primary">{getPriceDisplay(property)}</span>
                          {pricePerSqft && (
                            <span className="text-xs text-muted-foreground">${pricePerSqft.toFixed(0)}/sqft</span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{property.bedroomsTotal || 0} beds</span>
                          <span>{property.bathroomsTotalInteger || 0} baths</span>
                          {property.livingArea && (
                            <span>{Number(property.livingArea).toLocaleString()} sqft</span>
                          )}
                          {property.closeDate && (
                            <span>Sold {new Date(property.closeDate).toLocaleDateString()}</span>
                          )}
                        </div>
                        
                        <div className="flex gap-2 pt-1">
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
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
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
