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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, TrendingUp, Search, Loader2, AlertCircle, Home, MousePointerClick, RotateCcw, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
      // Handle both array response and { suggestions: [] } format
      if (Array.isArray(data)) {
        // API returns array of { value, count } objects
        setSuggestions(data.map((item: any) => typeof item === 'string' ? item : item.value));
      } else if (data.suggestions) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions([]);
      }
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

// Property type options for the dropdown
const PROPERTY_TYPES = [
  { value: 'any', label: 'Any' },
  { value: 'Single Family Residential', label: 'Single Family Residential' },
  { value: 'Condominium', label: 'Condominium' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Land', label: 'Land' },
];

interface InitialCMAData {
  name?: string;
  searchCriteria?: {
    city?: string;
    subdivision?: string;
    minBeds?: string;
    maxPrice?: string;
    statuses?: string[];
    minSqft?: string;
    maxSqft?: string;
    minLotAcres?: string;
    maxLotAcres?: string;
    minYearBuilt?: string;
    maxYearBuilt?: string;
    stories?: string;
    garage?: string;
    propertyType?: string;
    soldDays?: string;
  };
  comparables?: Property[];
  subjectProperty?: Property | null;
}

interface CMABuilderProps {
  onCreateCMA: (data: {
    name: string;
    subjectPropertyId?: string;
    comparablePropertyIds: string[];
    propertiesData: any[];
    searchCriteria?: any;
  }) => void;
  initialData?: InitialCMAData;
}

export function CMABuilder({ onCreateCMA, initialData }: CMABuilderProps) {
  const sc = initialData?.searchCriteria || {};
  
  const [cmaName, setCmaName] = useState(initialData?.name || "");
  const [hasUserEditedName, setHasUserEditedName] = useState(!!initialData?.name);
  const [subjectProperty, setSubjectProperty] = useState<Property | null>(initialData?.subjectProperty || null);
  const [comparables, setComparables] = useState<Property[]>(initialData?.comparables || []);
  const searchSectionRef = useRef<HTMLDivElement>(null);
  
  const [searchCity, setSearchCity] = useState(sc.city || "");
  const [searchSubdivision, setSearchSubdivision] = useState(sc.subdivision || "");
  const [searchMinBeds, setSearchMinBeds] = useState(sc.minBeds || "");
  const [searchMaxPrice, setSearchMaxPrice] = useState(sc.maxPrice || "");
  const [searchStatuses, setSearchStatuses] = useState<string[]>(sc.statuses || ["active"]);
  const [searchEnabled, setSearchEnabled] = useState(!!initialData?.searchCriteria);

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
  const [searchMinSqft, setSearchMinSqft] = useState(sc.minSqft || "");
  const [searchMaxSqft, setSearchMaxSqft] = useState(sc.maxSqft || "");
  const [searchMinLotAcres, setSearchMinLotAcres] = useState(sc.minLotAcres || "");
  const [searchMaxLotAcres, setSearchMaxLotAcres] = useState(sc.maxLotAcres || "");
  const [searchStories, setSearchStories] = useState(sc.stories || "");
  const [searchMinYearBuilt, setSearchMinYearBuilt] = useState(sc.minYearBuilt || "");
  const [searchMaxYearBuilt, setSearchMaxYearBuilt] = useState(sc.maxYearBuilt || "");
  const [searchSoldDays, setSearchSoldDays] = useState(sc.soldDays || "");
  const [searchPropertyType, setSearchPropertyType] = useState(sc.propertyType || "");
  
  // Property detail dialog state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Autoplay carousel effect - advance every 3 seconds when dialog is open
  useEffect(() => {
    if (!selectedProperty) return;
    const photos = ((selectedProperty as any).photos as string[] | undefined) || [];
    if (photos.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentPhotoIndex(prev => (prev + 1) % photos.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [selectedProperty]);

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
    setSearchPropertyType("");
  };
  
  const clearFilters = () => {
    setSearchCity("");
    setSearchSubdivision("");
    setSearchMinBeds("");
    setSearchMaxPrice("");
    setSearchStatuses(["active"]);
    setSearchMinSqft("");
    setSearchMaxSqft("");
    setSearchMinLotAcres("");
    setSearchMaxLotAcres("");
    setSearchStories("");
    setSearchMinYearBuilt("");
    setSearchMaxYearBuilt("");
    setSearchSoldDays("");
    setSearchPropertyType("");
    setSearchEnabled(false);
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
    if (searchPropertyType && searchPropertyType !== 'any') params.set('propertySubType', searchPropertyType);
    // Sort by listing date for active/under contract
    if (searchStatuses.includes('active') || searchStatuses.includes('under_contract')) {
      params.set('sortBy', 'listingContractDate');
      params.set('sortOrder', 'desc');
    }
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
    if (comparables.length >= 5) {
      // Max 5 comparables allowed
      return;
    }
    if (!comparables.find(p => p.id === property.id)) {
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
      
      // Build search criteria to save with CMA for "Modify Search" feature
      const searchCriteria = {
        city: searchCity,
        subdivision: searchSubdivision,
        minBeds: searchMinBeds,
        maxPrice: searchMaxPrice,
        statuses: searchStatuses,
        minSqft: searchMinSqft,
        maxSqft: searchMaxSqft,
        minLotAcres: searchMinLotAcres,
        maxLotAcres: searchMaxLotAcres,
        minYearBuilt: searchMinYearBuilt,
        maxYearBuilt: searchMaxYearBuilt,
        stories: searchStories,
        soldDays: searchSoldDays,
        propertyType: searchPropertyType,
      };
      
      onCreateCMA({
        name: finalName,
        subjectPropertyId: subjectProperty?.id,
        comparablePropertyIds: comparables.map(p => p.id),
        propertiesData: allProperties,
        searchCriteria,
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Properties
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          </div>
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
              <Label>Property Type</Label>
              <Select value={searchPropertyType} onValueChange={setSearchPropertyType}>
                <SelectTrigger data-testid="select-property-type">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <Label className="text-sm font-medium">Status:</Label>
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
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                Subject Property
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs z-[100]">
                    <p>The property you are creating this CMA for. This is typically your client's home that they want to sell or a property they're considering buying.</p>
                  </TooltipContent>
                </Tooltip>
              </span>
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
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                Comparable Properties
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs z-[100]">
                    <p>Similar properties in the area that help establish market value. Select up to 5 properties with similar features, location, and condition to the subject property.</p>
                  </TooltipContent>
                </Tooltip>
              </span>
              <Badge>{comparables.length} / 5</Badge>
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
                {comparables.length < 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Add up to {5 - comparables.length} more properties
                  </p>
                )}
                {comparables.length >= 5 && (
                  <p className="text-xs text-amber-600 text-center pt-2">
                    Maximum 5 comparables reached
                  </p>
                )}
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
            <CardTitle className="flex items-center gap-2">
              Analysis
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs z-[100]">
                  <p>Summary statistics calculated from your selected comparable properties including average price, square footage, and price per sqft to help determine fair market value.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
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
                // Photos are returned directly from Repliers API in property.photos
                const photos = (property as any).photos as string[] | undefined;
                const primaryPhoto = photos?.[0];
                const pricePerSqft = property.livingArea 
                  ? (property.standardStatus === 'Closed' && property.closePrice 
                      ? Number(property.closePrice) 
                      : Number(property.listPrice || 0)) / Number(property.livingArea)
                  : null;
                
                // Format listing date
                const listingDate = property.listingContractDate 
                  ? new Date(property.listingContractDate).toLocaleDateString()
                  : null;
                
                // Get status badge styling
                const getStatusBadge = () => {
                  if (property.standardStatus === 'Closed') {
                    return <Badge variant="secondary" className="flex-shrink-0">Sold</Badge>;
                  } else if (property.standardStatus === 'Active') {
                    return <Badge variant="default" className="flex-shrink-0 bg-green-600 hover:bg-green-600">Active</Badge>;
                  } else if (property.standardStatus === 'Active Under Contract' || property.standardStatus === 'Under Contract') {
                    return <Badge variant="default" className="flex-shrink-0 bg-amber-500 hover:bg-amber-500">Under Contract</Badge>;
                  }
                  return <Badge variant="secondary" className="flex-shrink-0">{property.standardStatus}</Badge>;
                };
                
                return (
                  <Card 
                    key={property.id} 
                    className="overflow-hidden cursor-pointer hover-elevate"
                    onClick={() => {
                      setSelectedProperty(property);
                      setCurrentPhotoIndex(0);
                    }}
                    data-testid={`card-property-${property.id}`}
                  >
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
                          {getStatusBadge()}
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
                        </div>
                        
                        {/* Date display based on status */}
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {listingDate && <span>Listed: {listingDate}</span>}
                          {property.standardStatus === 'Closed' && property.closeDate && (
                            <span>• Sold: {new Date(property.closeDate).toLocaleDateString()}</span>
                          )}
                        </div>
                        
                        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
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
                            disabled={comparables.some(p => p.id === property.id) || comparables.length >= 5}
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
      
      {/* Property Detail Dialog */}
      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProperty && (() => {
            // Photos are returned directly from Repliers API
            const photos = ((selectedProperty as any).photos as string[] | undefined) || [];
            const pricePerSqft = selectedProperty.livingArea 
              ? (selectedProperty.standardStatus === 'Closed' && selectedProperty.closePrice 
                  ? Number(selectedProperty.closePrice) 
                  : Number(selectedProperty.listPrice || 0)) / Number(selectedProperty.livingArea)
              : null;
            const listingDate = selectedProperty.listingContractDate 
              ? new Date(selectedProperty.listingContractDate).toLocaleDateString()
              : null;
              
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg">{selectedProperty.unparsedAddress}</DialogTitle>
                </DialogHeader>
                
                {/* Photo Carousel */}
                {photos.length > 0 ? (
                  <div className="relative group">
                    <div className="aspect-video bg-muted rounded-md overflow-hidden">
                      <img 
                        src={photos[currentPhotoIndex]} 
                        alt={`Property photo ${currentPhotoIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {photos.length > 1 && (
                      <>
                        <Button 
                          size="icon" 
                          variant="secondary"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-full w-12 rounded-none rounded-l-md bg-black/30 hover:bg-black/50 text-white border-0"
                          onClick={() => setCurrentPhotoIndex(prev => (prev - 1 + photos.length) % photos.length)}
                          data-testid="button-prev-photo"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="secondary"
                          className="absolute right-0 top-1/2 -translate-y-1/2 h-full w-12 rounded-none rounded-r-md bg-black/30 hover:bg-black/50 text-white border-0"
                          onClick={() => setCurrentPhotoIndex(prev => (prev + 1) % photos.length)}
                          data-testid="button-next-photo"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </Button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                          {currentPhotoIndex + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                    <Home className="w-16 h-16 text-muted-foreground/50" />
                  </div>
                )}
                
                <ScrollArea className="max-h-[40vh]">
                  <div className="space-y-4 p-1">
                    {/* Price and Status */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-2xl font-bold text-primary">{getPriceDisplay(selectedProperty)}</p>
                        {pricePerSqft && (
                          <p className="text-sm text-muted-foreground">${pricePerSqft.toFixed(0)}/sqft</p>
                        )}
                      </div>
                      {selectedProperty.standardStatus === 'Closed' ? (
                        <Badge variant="secondary" className="text-base px-3 py-1">Sold</Badge>
                      ) : selectedProperty.standardStatus === 'Active' ? (
                        <Badge className="bg-green-600 hover:bg-green-600 text-base px-3 py-1">Active</Badge>
                      ) : (
                        <Badge className="bg-amber-500 hover:bg-amber-500 text-base px-3 py-1">Under Contract</Badge>
                      )}
                    </div>
                    
                    {/* Property Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.bedroomsTotal || 0}</p>
                        <p className="text-xs text-muted-foreground">Beds</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.bathroomsTotalInteger || 0}</p>
                        <p className="text-xs text-muted-foreground">Baths</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.livingArea ? Number(selectedProperty.livingArea).toLocaleString() : 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">Sq Ft</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.yearBuilt || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">Year Built</p>
                      </div>
                    </div>
                    
                    {/* Dates */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {listingDate && (
                        <div>
                          <span className="text-muted-foreground">Listed: </span>
                          <span className="font-medium">{listingDate}</span>
                        </div>
                      )}
                      {selectedProperty.standardStatus === 'Closed' && selectedProperty.closeDate && (
                        <div>
                          <span className="text-muted-foreground">Sold: </span>
                          <span className="font-medium">{new Date(selectedProperty.closeDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {selectedProperty.subdivision && (
                        <div>
                          <span className="text-muted-foreground">Subdivision: </span>
                          <span className="font-medium">{selectedProperty.subdivision}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          handleSetSubject(selectedProperty);
                          setSelectedProperty(null);
                        }}
                        disabled={subjectProperty?.id === selectedProperty.id}
                        data-testid="button-dialog-set-subject"
                      >
                        <Home className="w-4 h-4 mr-2" />
                        Set as Subject
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => {
                          handleAddComparable(selectedProperty);
                          setSelectedProperty(null);
                        }}
                        disabled={comparables.some(p => p.id === selectedProperty.id) || comparables.length >= 5}
                        data-testid="button-dialog-add-comparable"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add as Comparable
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
