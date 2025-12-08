import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { CMABuilder } from "@/components/CMABuilder";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function CMANew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCmaMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      subjectPropertyId?: string;
      comparablePropertyIds: string[];
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
  }) => {
    createCmaMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cmas">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cmas">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CMAs
          </Button>
        </Link>
        <h1 className="text-3xl font-bold" data-testid="text-new-cma-title">Create New CMA</h1>
        <p className="text-muted-foreground mt-2">
          Build a comprehensive comparative market analysis for your clients
        </p>
      </div>

      <CMABuilder onCreateCMA={handleCreate} />
    </div>
  );
}
