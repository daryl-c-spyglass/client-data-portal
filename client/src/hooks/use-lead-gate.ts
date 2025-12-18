import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface LeadGateStatus {
  gateEnabled: boolean;
  allowed: boolean;
  viewsRemaining?: number;
  currentViews?: number;
  maxViews?: number;
}

interface TrackViewResponse {
  allowed: boolean;
  viewsRemaining: number | null;
  gateEnabled: boolean;
  currentViews?: number;
  maxViews?: number;
}

interface User {
  id: string;
  email: string;
}

export function useLeadGate() {
  const queryClient = useQueryClient();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  const { data: currentUser } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: status, isLoading } = useQuery<LeadGateStatus>({
    queryKey: ["/api/lead-gate/status"],
    staleTime: 60000,
    enabled: !currentUser,
  });

  const trackViewMutation = useMutation({
    mutationFn: async (): Promise<TrackViewResponse> => {
      const response = await apiRequest("/api/lead-gate/track-view", "POST", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/lead-gate/status"], {
        gateEnabled: data.gateEnabled,
        allowed: data.allowed,
        viewsRemaining: data.viewsRemaining,
        currentViews: data.currentViews,
        maxViews: data.maxViews,
      });

      if (!data.allowed) {
        setShowRegistrationModal(true);
      }
    },
  });

  const trackPropertyView = useCallback(async (): Promise<boolean> => {
    if (currentUser) {
      return true;
    }
    
    if (!status?.gateEnabled) {
      return true;
    }

    try {
      const result = await trackViewMutation.mutateAsync();
      return result.allowed;
    } catch (error) {
      console.error("Error tracking property view:", error);
      return true;
    }
  }, [currentUser, status?.gateEnabled, trackViewMutation]);

  const closeRegistrationModal = useCallback(() => {
    setShowRegistrationModal(false);
  }, []);

  const onRegistrationSuccess = useCallback(() => {
    setShowRegistrationModal(false);
    queryClient.invalidateQueries({ queryKey: ["/api/lead-gate/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [queryClient]);

  const isAuthenticated = !!currentUser;

  return {
    isLoading,
    isAuthenticated,
    gateEnabled: isAuthenticated ? false : (status?.gateEnabled ?? false),
    canView: isAuthenticated ? true : (status?.allowed ?? true),
    viewsRemaining: isAuthenticated ? 0 : (status?.viewsRemaining ?? 0),
    currentViews: isAuthenticated ? 0 : (status?.currentViews ?? 0),
    maxViews: status?.maxViews ?? 3,
    trackPropertyView,
    showRegistrationModal,
    closeRegistrationModal,
    onRegistrationSuccess,
  };
}
