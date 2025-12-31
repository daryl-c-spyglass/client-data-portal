import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertSellerUpdateSchema } from "@shared/schema";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, X, Bed, Bath, Maximize, MapPin, Home, Calendar, DollarSign, Ruler } from "lucide-react";
import { Link, useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  endpoint: string;
  testId?: string;
  className?: string;
}

function AutocompleteInput({ placeholder, value, onChange, endpoint, testId, className }: AutocompleteInputProps) {
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
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const data = await res.json();
      
      // Helper to extract string from various formats
      const toStringValue = (item: any): string => {
        if (typeof item === 'string') return item;
        if (item == null) return '';
        // Try common property names for suggestion objects
        if (typeof item.value === 'string') return item.value;
        if (typeof item.name === 'string') return item.name;
        if (typeof item.display === 'string') return item.display;
        if (typeof item.label === 'string') return item.label;
        if (typeof item.text === 'string') return item.text;
        return '';
      };
      
      if (Array.isArray(data)) {
        setSuggestions(data.map(toStringValue).filter(Boolean));
      } else if (data && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions.map(toStringValue).filter(Boolean));
      } else {
        setSuggestions([]);
      }
    } catch {
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

const PROPERTY_TYPES = [
  { value: 'Single Family Residence', label: 'Single Family Residence' },
  { value: 'Condominium', label: 'Condominium' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Ranch', label: 'Ranch' },
  { value: 'Manufactured Home', label: 'Manufactured Home' },
  { value: 'Unimproved Land', label: 'Unimproved Land' },
];

const formSchema = insertSellerUpdateSchema.extend({
  userId: z.string().default("demo-user-id"), // TODO: Replace with actual user ID from auth
});

interface PreSelectedProperty {
  id: string;
  listingId?: string;
  unparsedAddress?: string;
  city?: string;
  stateOrProvince?: string;
  listPrice?: string | number | null;
  bedroomsTotal?: number | null;
  bathroomsTotalInteger?: number | null;
  livingArea?: string | number | null;
  standardStatus?: string;
  photos?: string[];
}

export default function SellerUpdateNew() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  // Check if coming from Properties page with pre-selected properties
  const params = new URLSearchParams(search);
  const fromProperties = params.get('fromProperties') === 'true';
  
  // State for pre-selected properties
  const [preSelectedProperties, setPreSelectedProperties] = useState<PreSelectedProperty[]>([]);
  
  useEffect(() => {
    if (fromProperties) {
      const stored = sessionStorage.getItem('propertiesForSellerUpdate');
      if (stored) {
        try {
          const properties = JSON.parse(stored);
          setPreSelectedProperties(properties);
          // Clear sessionStorage after reading
          sessionStorage.removeItem('propertiesForSellerUpdate');
        } catch (e) {
          console.error('Failed to parse pre-selected properties:', e);
        }
      }
    }
  }, [fromProperties]);
  
  const removeProperty = (id: string) => {
    setPreSelectedProperties(prev => prev.filter(p => p.id !== id));
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "demo-user-id",
      name: "",
      email: "",
      // Location criteria
      postalCode: "",
      city: "",
      subdivision: "",
      // School criteria
      elementarySchool: "",
      middleSchool: "",
      highSchool: "",
      // Property criteria
      propertySubType: "",
      minBeds: "",
      maxBeds: "",
      minBaths: "",
      maxBaths: "",
      minSqft: "",
      maxSqft: "",
      minPrice: "",
      maxPrice: "",
      minYearBuilt: "",
      maxYearBuilt: "",
      // Search settings
      soldDays: "90",
      emailFrequency: "weekly",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Convert "all" back to empty string for database storage
      const cleanedValues = {
        ...values,
        propertySubType: values.propertySubType === 'all' ? '' : values.propertySubType,
      };
      return await apiRequest('/api/seller-updates', 'POST', cleanedValues);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seller-updates'] });
      toast({
        title: "Success!",
        description: "Seller update created successfully. Emails will be sent based on the frequency you selected.",
      });
      setLocation('/seller-updates');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create seller update",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(values);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        {fromProperties && (
          <Link href="/properties">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-properties">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Properties
            </Button>
          </Link>
        )}
        <h1 className="text-3xl font-semibold">
          {fromProperties && preSelectedProperties.length > 0 
            ? 'Share Properties with Client' 
            : 'Create Seller Update'
          }
        </h1>
        <p className="text-muted-foreground mt-1">
          {fromProperties && preSelectedProperties.length > 0 
            ? `Send ${preSelectedProperties.length} selected properties to a client`
            : 'Set up automated market update emails for sellers in a specific area'
          }
        </p>
      </div>

      {/* Pre-selected Properties Preview */}
      {preSelectedProperties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Selected Properties ({preSelectedProperties.length})</span>
              <Badge variant="secondary">From Search</Badge>
            </CardTitle>
            <CardDescription>
              These properties will be included in the update email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {preSelectedProperties.map((prop) => (
                <div 
                  key={prop.id} 
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border"
                >
                  {/* Property Image */}
                  <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
                    {prop.photos && prop.photos.length > 0 ? (
                      <img src={prop.photos[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Home className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Property Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {prop.unparsedAddress || 'Unknown Address'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {prop.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {prop.city}, {prop.stateOrProvince}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {prop.listPrice && (
                        <span className="text-primary font-medium">
                          ${Number(prop.listPrice).toLocaleString()}
                        </span>
                      )}
                      {prop.bedroomsTotal !== null && prop.bedroomsTotal !== undefined && (
                        <span className="flex items-center gap-1">
                          <Bed className="w-3 h-3" /> {prop.bedroomsTotal}
                        </span>
                      )}
                      {prop.bathroomsTotalInteger !== null && prop.bathroomsTotalInteger !== undefined && (
                        <span className="flex items-center gap-1">
                          <Bath className="w-3 h-3" /> {prop.bathroomsTotalInteger}
                        </span>
                      )}
                      {prop.livingArea && (
                        <span className="flex items-center gap-1">
                          <Maximize className="w-3 h-3" /> {Number(prop.livingArea).toLocaleString()} sqft
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Status Badge & Remove */}
                  <div className="flex items-center gap-2">
                    {prop.standardStatus && (
                      <Badge variant={prop.standardStatus === 'Active' ? 'default' : 'secondary'}>
                        {prop.standardStatus}
                      </Badge>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeProperty(prop.id)}
                      data-testid={`button-remove-property-${prop.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Update Details</CardTitle>
          <CardDescription>
            Enter the criteria for properties to include in this automated update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Name Field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Update Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Downtown Austin Updates for Smith Family"
                        data-testid="input-name"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name to identify this update
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seller@example.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Where to send the automated updates
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location Criteria
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Provide at least one location filter (city, zip code, or subdivision)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* City Field */}
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <AutocompleteInput
                            placeholder="Austin"
                            value={field.value || ""}
                            onChange={field.onChange}
                            endpoint="/api/autocomplete/cities"
                            testId="input-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Zip Code Field */}
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="78745"
                            data-testid="input-postalcode"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Subdivision Field */}
                  <FormField
                    control={form.control}
                    name="subdivision"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Subdivision</FormLabel>
                        <FormControl>
                          <AutocompleteInput
                            placeholder="Circle C Ranch"
                            value={field.value || ""}
                            onChange={field.onChange}
                            endpoint="/api/autocomplete/subdivisions"
                            testId="input-subdivision"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  School Criteria
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Elementary School Field */}
                  <FormField
                    control={form.control}
                    name="elementarySchool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Elementary School</FormLabel>
                        <FormControl>
                          <AutocompleteInput
                            placeholder="Search schools..."
                            value={field.value || ""}
                            onChange={field.onChange}
                            endpoint="/api/autocomplete/elementarySchools"
                            testId="input-elementaryschool"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Middle School Field */}
                  <FormField
                    control={form.control}
                    name="middleSchool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Middle School</FormLabel>
                        <FormControl>
                          <AutocompleteInput
                            placeholder="Search schools..."
                            value={field.value || ""}
                            onChange={field.onChange}
                            endpoint="/api/autocomplete/middleSchools"
                            testId="input-middleschool"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* High School Field */}
                  <FormField
                    control={form.control}
                    name="highSchool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>High School</FormLabel>
                        <FormControl>
                          <AutocompleteInput
                            placeholder="Search schools..."
                            value={field.value || ""}
                            onChange={field.onChange}
                            endpoint="/api/autocomplete/highSchools"
                            testId="input-highschool"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Property Criteria
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Property Type Field */}
                  <FormField
                    control={form.control}
                    name="propertySubType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-propertysubtype">
                              <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {PROPERTY_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Bedrooms */}
                  <FormField
                    control={form.control}
                    name="minBeds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Bed className="w-3 h-3" /> Min Beds
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-minbeds"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxBeds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Bed className="w-3 h-3" /> Max Beds
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-maxbeds"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Bathrooms */}
                  <FormField
                    control={form.control}
                    name="minBaths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Bath className="w-3 h-3" /> Min Baths
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-minbaths"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxBaths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Bath className="w-3 h-3" /> Max Baths
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-maxbaths"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Square Footage */}
                  <FormField
                    control={form.control}
                    name="minSqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Maximize className="w-3 h-3" /> Min Sq Ft
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-minsqft"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxSqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Maximize className="w-3 h-3" /> Max Sq Ft
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-maxsqft"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Price Range */}
                  <FormField
                    control={form.control}
                    name="minPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Min Price
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-minprice"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Max Price
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-maxprice"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Year Built */}
                  <FormField
                    control={form.control}
                    name="minYearBuilt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Min Year Built
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-minyearbuilt"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxYearBuilt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Max Year Built
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Any"
                            data-testid="input-maxyearbuilt"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Sold Days */}
                  <FormField
                    control={form.control}
                    name="soldDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sold Within (Days)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || "90"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-solddays">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                            <SelectItem value="60">Last 60 Days</SelectItem>
                            <SelectItem value="90">Last 90 Days</SelectItem>
                            <SelectItem value="180">Last 6 Months</SelectItem>
                            <SelectItem value="365">Last Year</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How far back to search for closed sales
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Email Settings</h3>
                {/* Email Frequency Field */}
                <FormField
                  control={form.control}
                  name="emailFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Frequency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-emailfrequency">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="bimonthly">Twice Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How often to send market updates
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Creating..." : "Create Seller Update"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/seller-updates')}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
