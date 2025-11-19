import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { SearchCriteria } from "@shared/schema";

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
                checked={criteria.status?.includes('Under Contract')}
                onCheckedChange={(checked) => {
                  const current = criteria.status || [];
                  updateCriteria('status', checked 
                    ? [...current, 'Under Contract']
                    : current.filter(s => s !== 'Under Contract')
                  );
                }}
                data-testid="switch-status-under-contract"
              />
              <Label htmlFor="status-under-contract" className="cursor-pointer">Under Contract</Label>
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start" data-testid="button-date-range">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {criteria.dateRange?.from ? format(new Date(criteria.dateRange.from), "PPP") : "Select Date Range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={criteria.dateRange?.from ? new Date(criteria.dateRange.from) : undefined}
                onSelect={(date) => updateCriteria('dateRange', { ...criteria.dateRange, from: date?.toISOString() })}
              />
            </PopoverContent>
          </Popover>
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

      {/* Location */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Neighborhood</Label>
          <Input 
            id="neighborhood"
            placeholder="Select Neighborhood"
            data-testid="input-neighborhood"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subdivisions">Subdivisions</Label>
          <Input 
            id="subdivisions"
            placeholder="Subdivisions"
            data-testid="input-subdivisions"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cities">Cities</Label>
          <Input 
            id="cities"
            placeholder="Start Typing"
            data-testid="input-cities"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="zip-codes">Zip Codes</Label>
          <Input 
            id="zip-codes"
            placeholder="Start Typing"
            data-testid="input-zip-codes"
          />
        </div>
      </div>

      {/* Street */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Street Number</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              placeholder="Min"
              data-testid="input-street-number-min"
            />
            <Input 
              type="number" 
              placeholder="Max"
              data-testid="input-street-number-max"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="street-name">Street Name</Label>
          <Input 
            id="street-name"
            placeholder="Street Name"
            data-testid="input-street-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit-number">Unit Number</Label>
          <Input 
            id="unit-number"
            placeholder="Unit Number"
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

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => setCriteria({})} data-testid="button-reset">
          Reset
        </Button>
        <Button type="submit" data-testid="button-search">
          <Search className="w-4 h-4 mr-2" />
          Search Properties
        </Button>
      </div>
    </form>
  );
}
