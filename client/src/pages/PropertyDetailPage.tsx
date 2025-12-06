import { useRoute, Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PropertyDetail } from "@/components/PropertyDetail";
import { useLeadGateContext } from "@/contexts/LeadGateContext";
import type { Property, Media } from "@shared/schema";

export default function PropertyDetailPage() {
  const [, params] = useRoute("/properties/:id");
  const [, setLocation] = useLocation();
  const { trackPropertyView, gateEnabled } = useLeadGateContext();
  const [viewTracked, setViewTracked] = useState(false);
  const listingId = params?.id;

  const { data: property, isLoading, error } = useQuery<any>({
    queryKey: ['/api/homereview/properties', listingId],
    enabled: !!listingId,
  });

  useEffect(() => {
    if (!viewTracked && gateEnabled && property) {
      trackPropertyView().then(() => {
        setViewTracked(true);
      });
    }
  }, [viewTracked, gateEnabled, trackPropertyView, property]);

  const convertPhotosToMedia = (photos: string[]): Media[] => {
    return photos.map((url, index) => ({
      id: `photo-${index}`,
      mediaKey: `photo-${index}`,
      resourceRecordKey: listingId || '',
      mediaURL: url,
      mediaCategory: 'Photo',
      mediaType: 'image',
      order: index,
      caption: null,
      modificationTimestamp: new Date(),
      localPath: null,
    }));
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !property) {
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
        <div className="text-center py-12 text-muted-foreground">
          <p>Property not found or failed to load.</p>
          <p className="text-sm mt-2">Please try again or search for another property.</p>
        </div>
      </div>
    );
  }

  const media = property.photos?.length ? convertPhotosToMedia(property.photos) : [];

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
