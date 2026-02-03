import { PropertyCard } from "@/components/PropertyCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Property, Media } from "@shared/schema";

interface FeaturedListingsWidgetProps {
  properties: Property[];
  mediaMap: Map<string, Media[]>;
}

export function FeaturedListingsWidget({ properties, mediaMap }: FeaturedListingsWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 3;
  const maxIndex = Math.max(0, Math.ceil(properties.length / itemsPerPage) - 1);

  const next = () => {
    setCurrentIndex(prev => Math.min(prev + 1, maxIndex));
  };

  const prev = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };

  const visibleProperties = properties.slice(
    currentIndex * itemsPerPage,
    (currentIndex + 1) * itemsPerPage
  );

  return (
    <div className="p-6 bg-background border rounded-md">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Featured Listings</h3>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={prev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={next}
            disabled={currentIndex === maxIndex}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleProperties.map(property => (
          <PropertyCard
            key={property.id}
            property={property}
            media={mediaMap.get(property.listingId)}
            onClick={() => {}}
          />
        ))}
      </div>

      {properties.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No featured listings available</p>
        </div>
      )}
    </div>
  );
}
