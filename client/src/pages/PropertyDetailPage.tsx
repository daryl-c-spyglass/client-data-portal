import { useRoute, useLocation, useSearch } from "wouter";
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
  const searchString = useSearch();
  const { trackPropertyView, gateEnabled } = useLeadGateContext();
  const { selectedProperty } = useSelectedProperty();
  const [viewTracked, setViewTracked] = useState(false);
  const listingId = params?.id;
  
  // Parse 'from' query parameter to determine where to navigate back
  const fromPath = new URLSearchParams(searchString).get('from') || '/properties';

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
        // CRITICAL: Repliers "neighborhood" field = subdivision (tract label), NOT geographic neighborhood
        // True neighborhood comes from boundary resolution only
        subdivision: data.subdivision || data.subdivisionName || null,
        subdivisionName: data.subdivisionName || data.subdivision || null,
        neighborhood: null,  // Must be resolved from boundary API, never from listing data
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

      // Preserve debug data from API response
      return { 
        property, 
        media, 
        _debug: data._debug || null 
      };
    },
    enabled: !selectedProperty && !!listingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // DEV mode: Always fetch debug data from API, even if we have context data
  // This ensures the debug panel shows raw Repliers field data
  const { data: debugApiData } = useQuery<{ _debug: any }>({
    queryKey: ['/api/properties/debug', listingId],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${listingId}?source=repliers`);
      if (!response.ok) return { _debug: null };
      const data = await response.json();
      return { _debug: data._debug || null };
    },
    enabled: import.meta.env.DEV && !!listingId,
    staleTime: 5 * 60 * 1000,
  });

  // Use context data if available, otherwise use fetched data
  // CRITICAL: Always normalize subdivision/neighborhood regardless of source
  // Context data may have incorrect mapping where Repliers "neighborhood" wasn't remapped to subdivision
  const rawPropertyData = selectedProperty || fetchedProperty;
  
  // Normalize the property to ensure correct subdivision/neighborhood mapping
  const propertyData = rawPropertyData ? {
    ...rawPropertyData,
    property: {
      ...rawPropertyData.property,
      // CRITICAL: If property.neighborhood has a value but property.subdivision is empty,
      // the neighborhood value is likely the incorrectly-mapped Repliers subdivision
      // Correct this by using neighborhood value as subdivision and setting neighborhood to null
      subdivision: rawPropertyData.property.subdivision || rawPropertyData.property.subdivisionName || 
                   (rawPropertyData.property.neighborhood && !rawPropertyData.property.subdivision ? 
                     rawPropertyData.property.neighborhood : null),
      subdivisionName: rawPropertyData.property.subdivisionName || rawPropertyData.property.subdivision || 
                       (rawPropertyData.property.neighborhood && !rawPropertyData.property.subdivision ? 
                         rawPropertyData.property.neighborhood : null),
      // Neighborhood MUST come from boundary resolution, never from listing data
      neighborhood: null,
    },
    media: rawPropertyData.media,
    // Preserve debug data for the debug panel
    // Use API-fetched debug data if available (from DEV mode query), otherwise use inline data
    _debug: debugApiData?._debug || (rawPropertyData as any)._debug || null,
  } : null;

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

  // Determine back button label based on origin
  const getBackLabel = () => {
    if (fromPath === '/') return 'Back to Dashboard';
    if (fromPath.startsWith('/cma')) return 'Back to CMA';
    if (fromPath.startsWith('/buyer-search')) return 'Back to Buyer Search';
    return 'Back to Search';
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
            onClick={() => setLocation(fromPath)}
            data-testid="button-back-to-search"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {getBackLabel()}
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
            onClick={() => setLocation(fromPath)}
            data-testid="button-back-to-search"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {getBackLabel()}
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <p>{error ? 'Failed to load property.' : 'Property data not available.'}</p>
          <p className="text-sm mt-2">Please search for properties and click on a property card to view details.</p>
        </div>
      </div>
    );
  }

  const { property, media, _debug } = propertyData as { property: Property; media: Media[]; _debug: any };

  return (
    <div className="space-y-6">
      <div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-4" 
          onClick={() => setLocation(fromPath)}
          data-testid="button-back-to-search"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {getBackLabel()}
        </Button>
      </div>

      <PropertyDetail
        property={property as Property}
        media={media}
        onAddToCMA={handleAddToCMA}
        onSave={handleSave}
        onShare={handleShare}
        onScheduleViewing={handleScheduleViewing}
        debugData={_debug}
      />
    </div>
  );
}
