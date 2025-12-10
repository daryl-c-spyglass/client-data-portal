import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { CMABuilder } from "@/components/CMABuilder";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Property } from "@shared/schema";

export default function CMANew() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Parse URL search params for "modify" mode
  const params = new URLSearchParams(search);
  const fromCmaId = params.get('from');
  
  // Fetch original CMA data if modifying
  const { data: originalCma } = useQuery({
    queryKey: ['/api/cmas', fromCmaId],
    enabled: !!fromCmaId,
  });

  const createCmaMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      subjectPropertyId?: string;
      comparablePropertyIds: string[];
      propertiesData: any[];
      searchCriteria?: any;
    }) => {
      const response = await apiRequest('/api/cmas', 'POST', data);
      return response.json();
    },
    onSuccess: (cma: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cmas'] });
      toast({
        title: "CMA created",
        description: "Your comparative market analysis has been created successfully.",
      });
      setLocation(`/cmas/${cma.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create CMA. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: {
    name: string;
    subjectPropertyId?: string;
    comparablePropertyIds: string[];
    propertiesData: any[];
    searchCriteria?: any;
  }) => {
    createCmaMutation.mutate(data);
  };

  // Build initialData from original CMA if modifying
  const buildInitialData = () => {
    if (!originalCma) return undefined;
    
    const cma = originalCma as any;
    const propertiesData = cma.propertiesData || [];
    const savedSearchCriteria = cma.searchCriteria || {};
    
    // Use saved searchCriteria, falling back to extracting from properties
    const searchCriteria = {
      city: savedSearchCriteria.city || '',
      subdivision: savedSearchCriteria.subdivision || '',
      minBeds: savedSearchCriteria.minBeds || '',
      maxPrice: savedSearchCriteria.maxPrice || '',
      statuses: savedSearchCriteria.statuses || ['active'],
      minSqft: savedSearchCriteria.minSqft || '',
      maxSqft: savedSearchCriteria.maxSqft || '',
      minLotAcres: savedSearchCriteria.minLotAcres || '',
      maxLotAcres: savedSearchCriteria.maxLotAcres || '',
      minYearBuilt: savedSearchCriteria.minYearBuilt || '',
      maxYearBuilt: savedSearchCriteria.maxYearBuilt || '',
      stories: savedSearchCriteria.stories || '',
      soldDays: savedSearchCriteria.soldDays || '',
    };
    
    // If no saved criteria, try to infer from properties
    if (!cma.searchCriteria && propertiesData.length > 0) {
      const firstProp = propertiesData[0];
      if (firstProp.city) searchCriteria.city = firstProp.city;
      if (firstProp.subdivisionName) searchCriteria.subdivision = firstProp.subdivisionName;
      
      // Extract statuses from properties
      const statuses = new Set<string>();
      propertiesData.forEach((p: any) => {
        if (p.standardStatus === 'Active') statuses.add('active');
        else if (p.standardStatus === 'Under Contract' || p.standardStatus === 'Pending') statuses.add('under_contract');
        else if (p.standardStatus === 'Closed') statuses.add('closed');
      });
      if (statuses.size > 0) {
        searchCriteria.statuses = Array.from(statuses);
      }
    }
    
    // Separate subject property from comparables
    const subjectId = cma.subjectPropertyId;
    const subjectProperty = subjectId 
      ? propertiesData.find((p: any) => p.id === subjectId) || null
      : null;
    const comparables = subjectId
      ? propertiesData.filter((p: any) => p.id !== subjectId)
      : propertiesData;
    
    // Append "(Modified)" only if not already present
    let modifiedName = cma.name || 'CMA';
    if (!modifiedName.includes('(Modified)')) {
      modifiedName = `${modifiedName} (Modified)`;
    }
    
    return {
      name: modifiedName,
      searchCriteria,
      comparables: comparables as Property[],
      subjectProperty: subjectProperty as Property | null,
    };
  };

  const initialData = buildInitialData();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cmas">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cmas">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CMAs
          </Button>
        </Link>
        <h1 className="text-3xl font-bold" data-testid="text-new-cma-title">
          {fromCmaId ? 'Modify CMA' : 'Create New CMA'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {fromCmaId 
            ? 'Modify your search criteria and comparables to create an updated CMA'
            : 'Build a comprehensive comparative market analysis for your clients'
          }
        </p>
      </div>

      <CMABuilder onCreateCMA={handleCreate} initialData={initialData} />
    </div>
  );
}
