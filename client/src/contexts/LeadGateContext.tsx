import { createContext, useContext, type ReactNode } from "react";
import { useLeadGate } from "@/hooks/use-lead-gate";
import { LeadGateModal } from "@/components/LeadGateModal";

interface LeadGateContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  gateEnabled: boolean;
  canView: boolean;
  viewsRemaining: number;
  currentViews: number;
  maxViews: number;
  trackPropertyView: () => Promise<boolean>;
}

const LeadGateContext = createContext<LeadGateContextValue | null>(null);

export function LeadGateProvider({ children }: { children: ReactNode }) {
  const {
    isLoading,
    isAuthenticated,
    gateEnabled,
    canView,
    viewsRemaining,
    currentViews,
    maxViews,
    trackPropertyView,
    showRegistrationModal,
    closeRegistrationModal,
    onRegistrationSuccess,
  } = useLeadGate();

  return (
    <LeadGateContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        gateEnabled,
        canView,
        viewsRemaining,
        currentViews,
        maxViews,
        trackPropertyView,
      }}
    >
      {children}
      <LeadGateModal
        open={showRegistrationModal}
        onClose={closeRegistrationModal}
        onSuccess={onRegistrationSuccess}
      />
    </LeadGateContext.Provider>
  );
}

export function useLeadGateContext() {
  const context = useContext(LeadGateContext);
  if (!context) {
    throw new Error("useLeadGateContext must be used within a LeadGateProvider");
  }
  return context;
}
