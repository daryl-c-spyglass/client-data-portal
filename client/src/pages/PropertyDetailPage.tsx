import { useRoute, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PropertyDetail } from "@/components/PropertyDetail";
import { useLeadGateContext } from "@/contexts/LeadGateContext";
import { useSelectedProperty } from "@/contexts/SelectedPropertyContext";
import type { Property, Media } from "@shared/schema";

export default function PropertyDetailPage() {
  const [, params] = useRoute("/properties/:id");
  const [, setLocation] = useLocation();
  const { trackPropertyView, gateEnabled } = useLeadGateContext();
  const { selectedProperty } = useSelectedProperty();
  const [viewTracked, setViewTracked] = useState(false);
  const listingId = params?.id;

  // Fetch property from API if not in context (direct URL access)
  const { data: fetchedProperty, isLoading, error } = useQuery({
    queryKey: ['/api/properties', listingId],
    queryFn: async () => {
      // Try Repliers first (for active listings), then fallback to DB
      const response = await fetch(`/api/properties/${listingId}?source=repliers`);
      if (!response.ok) {
        throw new Error('Property not found');
      }
      const data = await response.json();
      
      // Normalize the property data to match expected format for display
      // Using Partial<Property> since API response may not have all fields
      const property = {
        id: data.id || data.listingId,
        listingId: data.listingId || data.id,
        listingKey: data.listingKey || data.id,
        standardStatus: data.standardStatus || data.status || 'Unknown',
        listPrice: data.listPrice,
        closePrice: data.closePrice,
        originalListPrice: data.originalListPrice,
        propertyType: data.propertyType || 'Residential',
        propertySubType: data.propertySubType,
        city: data.city,
        stateOrProvince: data.stateOrProvince || data.state || 'TX',
        postalCode: data.postalCode,
        subdivisionName: data.subdivisionName || data.subdivision,
        unparsedAddress: data.unparsedAddress || data.address || 'Unknown Address',
        latitude: data.latitude,
        longitude: data.longitude,
        bedroomsTotal: data.bedroomsTotal ?? data.beds,
        bathroomsTotalInteger: data.bathroomsTotalInteger ?? data.baths,
        livingArea: data.livingArea ?? data.sqft,
        lotSizeSquareFeet: data.lotSizeSquareFeet,
        lotSizeAcres: data.lotSizeAcres,
        yearBuilt: data.yearBuilt,
        garageSpaces: data.garageSpaces,
        photosCount: data.photosCount || data.photos?.length || 0,
        publicRemarks: data.publicRemarks || data.description,
        daysOnMarket: data.daysOnMarket,
        cumulativeDaysOnMarket: data.cumulativeDaysOnMarket,
        listAgentFullName: data.listAgentFullName,
        listAgentEmail: data.listAgentEmail,
        listAgentDirectPhone: data.listAgentDirectPhone,
        listOfficeName: data.listOfficeName,
        listDate: data.listDate,
        closeDate: data.closeDate || data.soldDate,
        modificationTimestamp: data.modificationTimestamp,
        originatingSystemName: data.originatingSystemName,
      } as Partial<Property> as Property;

      // Convert photos array to media format
      const media: Media[] = (data.photos || []).map((url: string, index: number) => ({
        id: `${data.id}-${index}`,
        listingId: data.id,
        mediaKey: `${data.id}-${index}`,
        mediaURL: url,
        order: index,
        mediaCategory: 'Photo',
        shortDescription: null,
        modificationTimestamp: new Date().toISOString(),
      }));

      return { property, media };
    },
    enabled: !selectedProperty && !!listingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use context data if available, otherwise use fetched data
  const propertyData = selectedProperty || fetchedProperty;

  useEffect(() => {
    if (!viewTracked && gateEnabled && propertyData) {
      trackPropertyView().then(() => {
        setViewTracked(true);
      });
    }
  }, [viewTracked, gateEnabled, trackPropertyView, propertyData]);

  const handleAddToCMA = () => {
    console.log("Add to CMA");
  };

  const handleSave = () => {
    console.log("Save property");
  };

  const handleShare = () => {
    console.log("Share property");
  };

  const handleScheduleViewing = () => {
    console.log("Schedule viewing");
  };

  // Show loading state when fetching
  if (isLoading && !selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-4" 
            onClick={() => setLocation('/properties')}
            data-testid="button-back-to-search"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading property details...</span>
        </div>
      </div>
    );
  }

  // Show error or no data state
  if (!propertyData) {
    return (
      <div className="space-y-6">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-4" 
            onClick={() => setLocation('/properties')}
            data-testid="button-back-to-search"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <p>{error ? 'Failed to load property.' : 'Property data not available.'}</p>
          <p className="text-sm mt-2">Please search for properties and click on a property card to view details.</p>
        </div>
      </div>
    );
  }

  const { property, media } = propertyData;

  return (
    <div className="space-y-6">
      <div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-4" 
          onClick={() => setLocation('/buyer-search')}
          data-testid="button-back-to-search"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>
      </div>

      <PropertyDetail
        property={property as Property}
        media={media}
        onAddToCMA={handleAddToCMA}
        onSave={handleSave}
        onShare={handleShare}
        onScheduleViewing={handleScheduleViewing}
      />
    </div>
  );
}
