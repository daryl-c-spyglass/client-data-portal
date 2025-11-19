import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { CMAReport } from "@/components/CMAReport";
import type { Cma, Property, Media, PropertyStatistics, TimelineDataPoint } from "@shared/schema";

export default function CMADetailPage() {
  const [, params] = useRoute("/cmas/:id");
  const id = params?.id;

  const { data: cma, isLoading: cmaLoading } = useQuery<Cma>({
    queryKey: [`/api/cmas/${id}`],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}`);
      if (!response.ok) throw new Error('Failed to fetch CMA');
      return response.json();
    },
  });

  const { data: statistics, isLoading: statsLoading } = useQuery<PropertyStatistics>({
    queryKey: [`/api/cmas/${id}/statistics`],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/statistics`);
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    },
  });

  const { data: timelineData = [], isLoading: timelineLoading } = useQuery<TimelineDataPoint[]>({
    queryKey: [`/api/cmas/${id}/timeline`],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/timeline`);
      if (!response.ok) throw new Error('Failed to fetch timeline');
      return response.json();
    },
  });

  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    queryFn: async () => {
      const response = await fetch('/api/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
  });

  const properties = cma
    ? allProperties.filter((p) =>
        [cma.subjectPropertyId, ...(cma.comparablePropertyIds || [])].includes(p.id)
      )
    : [];

  const mediaMap = new Map<string, Media[]>();
  const isLoading = cmaLoading || statsLoading || timelineLoading;

  // Use mock statistics as fallback if data isn't loaded yet
  const mockStatistics: PropertyStatistics = {
    price: {
      range: { min: 371000, max: 710000 },
      average: 508577,
      median: 519500,
    },
    pricePerSqFt: {
      range: { min: 268.23, max: 503.06 },
      average: 406.53,
      median: 406.7,
    },
    daysOnMarket: {
      range: { min: 2, max: 139 },
      average: 37,
      median: 25,
    },
    livingArea: {
      range: { min: 1045, max: 1474 },
      average: 1263,
      median: 1296,
    },
    lotSize: {
      range: { min: 3816, max: 11609 },
      average: 8923,
      median: 8494,
    },
    acres: {
      range: { min: 0.09, max: 0.27 },
      average: 0.2,
      median: 0.2,
    },
    bedrooms: {
      range: { min: 3, max: 4 },
      average: 3,
      median: 3,
    },
    bathrooms: {
      range: { min: 1, max: 2 },
      average: 2,
      median: 2,
    },
    yearBuilt: {
      range: { min: 1953, max: 2018 },
      average: 1964,
      median: 1959,
    },
  };

  const mockTimelineData: TimelineDataPoint[] = [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!cma) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">CMA not found</h2>
        <Link href="/cmas">
          <Button variant="outline">Back to CMAs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/cmas">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cmas">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to CMAs
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-cma-title">{cma.name}</h1>
        </div>
      </div>

      <CMAReport
        properties={properties}
        mediaMap={mediaMap}
        statistics={statistics || mockStatistics}
        timelineData={timelineData}
        isPreview={true}
        expiresAt={new Date(Date.now() + 30 * 60 * 1000)}
        onSave={() => console.log("Save")}
        onPublicLink={() => console.log("Public link")}
        onModifySearch={() => console.log("Modify search")}
        onModifyStats={() => console.log("Modify stats")}
        onAddNotes={() => console.log("Add notes")}
      />
    </div>
  );
}
