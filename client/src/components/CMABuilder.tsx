import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Plus, TrendingUp } from "lucide-react";
import { PropertyCard } from "./PropertyCard";
import type { Property, Media } from "@shared/schema";

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
  
  // Fetch available properties from backend
  const { data: searchResults = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    queryFn: async () => {
      const response = await fetch('/api/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
  });

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

  return (
    <div className="space-y-6">
      {/* CMA Name */}
      <Card>
        <CardHeader>
          <CardTitle>CMA Information</CardTitle>
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

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Property */}
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
                      <p className="text-xs text-muted-foreground">
                        {subjectProperty.listPrice && `$${Number(subjectProperty.listPrice).toLocaleString()}`}
                      </p>
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
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm mb-2">No subject property selected</p>
                <p className="text-xs">Click "+ Set as Subject" on a property from search results</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparable Properties */}
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
                          <p className="font-semibold text-sm">{property.unparsedAddress}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {property.listPrice && `$${Number(property.listPrice).toLocaleString()}`}
                        </p>
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
                <p className="text-sm mb-2">No comparables selected</p>
                <p className="text-xs">Search and select properties to compare</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Tools */}
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
                      ${Math.round(
                        comparables.reduce((sum, p) => sum + Number(p.listPrice || 0), 0) / comparables.length
                      ).toLocaleString()}
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
                          const price = Number(p.listPrice || 0);
                          const sqft = Number(p.livingArea || 1);
                          return sum + (price / sqft);
                        }, 0) / comparables.length
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg DOM</span>
                    <span className="font-semibold">
                      {Math.round(
                        comparables.reduce((sum, p) => sum + Number(p.daysOnMarket || 0), 0) / comparables.length
                      )} days
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

      {/* Available Properties */}
      <Card>
        <CardHeader>
          <CardTitle>Available Properties ({searchResults.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.slice(0, 6).map((property) => (
                <div key={property.id} className="p-4 border rounded-md space-y-2">
                  <p className="font-semibold text-sm line-clamp-2">{property.unparsedAddress}</p>
                  <p className="text-xs text-muted-foreground">
                    {property.listPrice && `$${Number(property.listPrice).toLocaleString()}`}
                  </p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{property.bedroomsTotal} beds</span>
                    <span>•</span>
                    <span>{property.bathroomsTotalInteger} baths</span>
                    <span>•</span>
                    <span>{property.livingArea && `${Number(property.livingArea).toLocaleString()} sqft`}</span>
                  </div>
                  <div className="flex gap-2">
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">No properties available</p>
              <p className="text-xs">Properties from MLS Grid will appear here once synced</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
