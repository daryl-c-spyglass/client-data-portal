import { useRoute, useLocation } from "wouter";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!viewTracked && gateEnabled && selectedProperty) {
      trackPropertyView().then(() => {
        setViewTracked(true);
      });
    }
  }, [viewTracked, gateEnabled, trackPropertyView, selectedProperty]);

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

  if (!selectedProperty) {
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
          <p>Property data not available.</p>
          <p className="text-sm mt-2">Please search for properties and click on a property card to view details.</p>
        </div>
      </div>
    );
  }

  const { property, media } = selectedProperty;

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
