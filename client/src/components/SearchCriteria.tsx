import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import type { SearchCriteria } from "@shared/schema";

interface AutocompleteOption {
  value: string;
  count: number;
}

interface AutocompleteInputProps {
  id: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  apiEndpoint: string;
  testId: string;
}

function AutocompleteInput({ id, placeholder, values, onChange, apiEndpoint, testId }: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.length < 1) {
        setSuggestions([]);
        return;
      }
      
      setIsLoading(true);
      try {
        const response = await fetch(`${apiEndpoint}?search=${encodeURIComponent(inputValue)}`);
        if (response.ok) {
          const data = await response.json();
          // Handle both formats: { suggestions: [...] } and direct array
          let results: AutocompleteOption[] = [];
          if (Array.isArray(data)) {
            // Direct array format with {value, count} objects
            results = data;
          } else if (data.suggestions && Array.isArray(data.suggestions)) {
            // { suggestions: [...] } format - convert strings to AutocompleteOption
            results = data.suggestions.map((s: string | AutocompleteOption) => 
              typeof s === 'string' ? { value: s, count: 0 } : s
            );
          } else if (data.results && Array.isArray(data.results)) {
            // { results: [...] } format
            results = data.results.map((s: string | AutocompleteOption) => 
              typeof s === 'string' ? { value: s, count: 0 } : s
            );
          }
          setSuggestions(results.filter((item: AutocompleteOption) => 
            !values.includes(item.value)
          ));
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(debounce);
  }, [inputValue, apiEndpoint, values]);

  const addValue = (value: string) => {
    if (!values.includes(value)) {
      onChange([...values, value]);
    }
    setInputValue('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const removeValue = (valueToRemove: string) => {
    onChange(values.filter(v => v !== valueToRemove));
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1 min-h-9 p-1 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {values.map((value, index) => (
          <span 
            key={index} 
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded"
            data-testid={`tag-${testId}-${index}`}
          >
            {value}
            <button 
              type="button" 
              onClick={() => removeValue(value)}
              className="hover:bg-primary/20 rounded-full p-0.5"
              data-testid={`button-remove-${testId}-${index}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm px-1"
          placeholder={values.length === 0 ? placeholder : "Add more..."}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (inputValue.length > 0) setShowSuggestions(true);
          }}
          data-testid={testId}
        />
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">Loading...</div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex justify-between items-center"
                onClick={() => addValue(suggestion.value)}
                data-testid={`suggestion-${testId}-${index}`}
              >
                <span>{suggestion.value}</span>
                <span className="text-xs text-muted-foreground">({suggestion.count.toLocaleString()})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface SearchCriteriaProps {
  onSearch: (criteria: SearchCriteria) => void;
  initialCriteria?: Partial<SearchCriteria>;
}

export function SearchCriteriaForm({ onSearch, initialCriteria = {} }: SearchCriteriaProps) {
  const [criteria, setCriteria] = useState<Partial<SearchCriteria>>(initialCriteria);
  
  const updateCriteria = (key: string, value: any) => {
    setCriteria(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(criteria as SearchCriteria);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-6" data-testid="form-search-criteria">
      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Status</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch 
                id="status-active"
                checked={criteria.status?.includes('Active')}
                onCheckedChange={(checked) => {
                  const current = criteria.status || [];
                  updateCriteria('status', checked 
                    ? [...current, 'Active']
                    : current.filter(s => s !== 'Active')
                  );
                }}
                data-testid="switch-status-active"
              />
              <Label htmlFor="status-active" className="cursor-pointer">Active</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="status-under-contract"
                checked={criteria.status?.includes('Active Under Contract')}
                onCheckedChange={(checked) => {
                  const current = criteria.status || [];
                  updateCriteria('status', checked 
                    ? [...current, 'Active Under Contract']
                    : current.filter(s => s !== 'Active Under Contract')
                  );
                }}
                data-testid="switch-status-under-contract"
              />
              <Label htmlFor="status-under-contract" className="cursor-pointer">Active Under Contract</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="status-closed"
                checked={criteria.status?.includes('Closed')}
                onCheckedChange={(checked) => {
                  const current = criteria.status || [];
                  updateCriteria('status', checked 
                    ? [...current, 'Closed']
                    : current.filter(s => s !== 'Closed')
                  );
                }}
                data-testid="switch-status-closed"
              />
              <Label htmlFor="status-closed" className="cursor-pointer">Closed</Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-10 text-sm" data-testid="button-date-from">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {criteria.dateRange?.from ? format(new Date(criteria.dateRange.from), "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={criteria.dateRange?.from ? new Date(criteria.dateRange.from) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        updateCriteria('dateRange', { ...criteria.dateRange, from: date.toISOString() });
                      }
                    }}
                    initialFocus
                    disabled={(date) => date > new Date()}
                    data-testid="calendar-date-from"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-10 text-sm" data-testid="button-date-to">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {criteria.dateRange?.to ? format(new Date(criteria.dateRange.to), "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={criteria.dateRange?.to ? new Date(criteria.dateRange.to) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        updateCriteria('dateRange', { ...criteria.dateRange, to: date.toISOString() });
                      }
                    }}
                    initialFocus
                    disabled={(date) => date > new Date()}
                    data-testid="calendar-date-to"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Close Date Quick Filters */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Quick Filters (Close Date)</Label>
              {(criteria.dateRange?.from || criteria.dateRange?.to) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => updateCriteria('dateRange', undefined)}
                  className="h-5 px-1 text-xs text-muted-foreground"
                  data-testid="button-clear-date-filter"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[30, 60, 90, 120, 150, 180].map((days) => {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                const fromDate = new Date(today);
                fromDate.setDate(today.getDate() - days);
                fromDate.setHours(0, 0, 0, 0);
                
                const isActive = criteria.dateRange?.from && criteria.dateRange?.to &&
                  new Date(criteria.dateRange.from).toDateString() === fromDate.toDateString();
                
                return (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => {
                      if (isActive) {
                        updateCriteria('dateRange', undefined);
                      } else {
                        updateCriteria('dateRange', { 
                          from: fromDate.toISOString(), 
                          to: today.toISOString() 
                        });
                      }
                    }}
                    data-testid={`button-quick-${days}-days`}
                    className="h-7 px-2 text-xs"
                  >
                    0-{days}d
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="property-subtype">Property Subtype</Label>
          <Select 
            value={criteria.propertySubType} 
            onValueChange={(value) => updateCriteria('propertySubType', value)}
          >
            <SelectTrigger id="property-subtype" data-testid="select-property-subtype">
              <SelectValue placeholder="None Selected" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single-family">Single Family Residential</SelectItem>
              <SelectItem value="condo">Condominium</SelectItem>
              <SelectItem value="townhouse">Townhouse</SelectItem>
              <SelectItem value="multi-family">Multi-Family</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price & MLS Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>List Price</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="Min"
              value={criteria.listPriceMin || ''}
              onChange={(e) => updateCriteria('listPriceMin', e.target.value ? Number(e.target.value) : undefined)}
              data-testid="input-price-min"
            />
            <Input 
              type="number" 
              placeholder="Max"
              value={criteria.listPriceMax || ''}
              onChange={(e) => updateCriteria('listPriceMax', e.target.value ? Number(e.target.value) : undefined)}
              data-testid="input-price-max"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mls-areas">MLS Areas</Label>
          <Input 
            id="mls-areas"
            placeholder="Start Typing"
            data-testid="input-mls-areas"
          />
        </div>
      </div>

      {/* Location with Autocomplete */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subdivisions">Subdivisions</Label>
          <AutocompleteInput
            id="subdivisions"
            placeholder="Type to search..."
            values={criteria.subdivisions || []}
            onChange={(values) => updateCriteria('subdivisions', values.length > 0 ? values : undefined)}
            apiEndpoint="/api/autocomplete/subdivisions"
            testId="input-subdivisions"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cities">Cities</Label>
          <AutocompleteInput
            id="cities"
            placeholder="Type to search..."
            values={criteria.cities || []}
            onChange={(values) => updateCriteria('cities', values.length > 0 ? values : undefined)}
            apiEndpoint="/api/autocomplete/cities"
            testId="input-cities"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="zip-codes">Zip Codes</Label>
          <AutocompleteInput
            id="zip-codes"
            placeholder="Type to search..."
            values={criteria.zipCodes || []}
            onChange={(values) => updateCriteria('zipCodes', values.length > 0 ? values : undefined)}
            apiEndpoint="/api/autocomplete/postalCodes"
            testId="input-zip-codes"
          />
        </div>
      </div>

      {/* Street */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="street-number">Street Number</Label>
          <Input 
            id="street-number"
            type="number"
            placeholder="e.g. 3616"
            value={criteria.streetNumber || ''}
            onChange={(e) => updateCriteria('streetNumber', e.target.value ? Number(e.target.value) : undefined)}
            data-testid="input-street-number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="street-name">Street Name</Label>
          <Input 
            id="street-name"
            placeholder="Street Name"
            value={criteria.streetName || ''}
            onChange={(e) => updateCriteria('streetName', e.target.value || undefined)}
            data-testid="input-street-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit-number">Unit Number</Label>
          <Input 
            id="unit-number"
            placeholder="Unit Number"
            value={criteria.unitNumber || ''}
            onChange={(e) => updateCriteria('unitNumber', e.target.value || undefined)}
            data-testid="input-unit-number"
          />
        </div>
      </div>

      {/* Property Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Living Area (Sq Ft)</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="Min"
              value={criteria.livingArea?.min || ''}
              onChange={(e) => updateCriteria('livingArea', { 
                ...criteria.livingArea, 
                min: e.target.value ? Number(e.target.value) : undefined 
              })}
              data-testid="input-living-area-min"
            />
            <Input 
              type="number" 
              placeholder="Max"
              value={criteria.livingArea?.max || ''}
              onChange={(e) => updateCriteria('livingArea', { 
                ...criteria.livingArea, 
                max: e.target.value ? Number(e.target.value) : undefined 
              })}
              data-testid="input-living-area-max"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Year Built Range</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="Min"
              value={criteria.yearBuilt?.min || ''}
              onChange={(e) => updateCriteria('yearBuilt', { 
                ...criteria.yearBuilt, 
                min: e.target.value ? Number(e.target.value) : undefined 
              })}
              data-testid="input-year-built-min"
            />
            <Input 
              type="number" 
              placeholder="Max"
              value={criteria.yearBuilt?.max || ''}
              onChange={(e) => updateCriteria('yearBuilt', { 
                ...criteria.yearBuilt, 
                max: e.target.value ? Number(e.target.value) : undefined 
              })}
              data-testid="input-year-built-max"
            />
          </div>
        </div>
      </div>

      {/* Bedrooms & Bathrooms */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label># Bedrooms</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="Min"
              value={criteria.bedroomsMin || ''}
              onChange={(e) => updateCriteria('bedroomsMin', e.target.value ? Number(e.target.value) : undefined)}
              data-testid="input-bedrooms-min"
            />
            <Input 
              type="number" 
              placeholder="Max"
              value={criteria.bedroomsMax || ''}
              onChange={(e) => updateCriteria('bedroomsMax', e.target.value ? Number(e.target.value) : undefined)}
              data-testid="input-bedrooms-max"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label># Full Baths</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="Min"
              data-testid="input-full-baths-min"
            />
            <Input 
              type="number" 
              placeholder="Max"
              data-testid="input-full-baths-max"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label># Half Baths</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="Min"
              data-testid="input-half-baths-min"
            />
            <Input 
              type="number" 
              placeholder="Max"
              data-testid="input-half-baths-max"
            />
          </div>
        </div>
      </div>

      {/* Submit Button Row */}
      <div className="flex justify-end items-center gap-3 flex-wrap">
        <Button type="button" variant="outline" onClick={() => setCriteria({})} data-testid="button-reset">
          Reset
        </Button>
        <Button 
          type="submit" 
          variant="outline"
          className="border-orange-500 text-orange-500 bg-white hover:bg-orange-50 dark:bg-background dark:hover:bg-orange-950/20"
          data-testid="button-search"
        >
          <Search className="w-4 h-4 mr-2" />
          Search Properties
        </Button>
      </div>
    </form>
  );
}
