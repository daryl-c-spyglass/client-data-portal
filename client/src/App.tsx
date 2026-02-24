import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatAssistant } from "@/components/ChatAssistant";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { LeadGateProvider } from "@/contexts/LeadGateContext";
import { SelectedPropertyProvider } from "@/contexts/SelectedPropertyContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import CMAs from "@/pages/CMAs";
import CMANew from "@/pages/CMANew";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import CMADetailPage from "@/pages/CMADetailPage";
import CMAPresentationBuilder from "@/pages/CMAPresentationBuilder";
import SellerUpdates from "@/pages/SellerUpdates";
import SellerUpdateNew from "@/pages/SellerUpdateNew";
import SellerUpdatePreview from "@/pages/SellerUpdatePreview";
import SellerUpdateEmbed from "@/pages/SellerUpdateEmbed";
import EmbedCodeGenerator from "@/pages/EmbedCodeGenerator";
import BuyerSearch from "@/pages/BuyerSearch";
import Settings from "@/pages/Settings";
import Clients from "@/pages/Clients";
import Analytics from "@/pages/Analytics";
import SharedCMAView from "@/pages/SharedCMAView";
import CalendarPage from "@/pages/CalendarPage";
import LeadsPage from "@/pages/LeadsPage";
import InventoryAudit from "@/pages/InventoryAudit";
import AdminPage from "@/pages/AdminPage";
import UserManagement from "@/pages/UserManagement";
import ActivityLogs from "@/pages/ActivityLogs";
import FeatureVisibilitySettings from "@/pages/FeatureVisibilitySettings";
import ActivityLogDashboard from "@/pages/ActivityLogDashboard";
import Login from "@/pages/Login";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useEffect } from "react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  
  const { data: user, isLoading, error, isError } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const is401Error = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    return err.message.startsWith("401:");
  };

  useEffect(() => {
    if (!isLoading && isError && is401Error(error)) {
      const currentPath = location;
      if (currentPath !== "/login") {
        setLocation(`/login?next=${encodeURIComponent(currentPath)}`);
      }
    }
  }, [isLoading, isError, error, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    if (is401Error(error)) {
      return null;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Unable to verify authentication</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/properties" component={Properties} />
      <Route path="/properties/:id" component={PropertyDetailPage} />
      <Route path="/cmas" component={CMAs} />
      <Route path="/cmas/new" component={CMANew} />
      <Route path="/cmas/:id" component={CMADetailPage} />
      <Route path="/cmas/:id/presentation" component={CMAPresentationBuilder} />
      <Route path="/seller-updates" component={SellerUpdates} />
      <Route path="/seller-updates/new" component={SellerUpdateNew} />
      <Route path="/seller-updates/:id/preview" component={SellerUpdatePreview} />
      <Route path="/buyer-search" component={BuyerSearch} />
      <Route path="/embed-code" component={EmbedCodeGenerator} />
      <Route path="/clients">
        {() => (
          <ProtectedRoute minimumRole="super_admin" fallbackPath="/">
            <Clients />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/analytics">
        {() => (
          <ProtectedRoute minimumRole="super_admin" fallbackPath="/">
            <Analytics />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/settings" component={Settings} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/inventory-audit" component={InventoryAudit} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/admin/activity-logs" component={ActivityLogs} />
      <Route path="/admin/feature-visibility">
        {() => (
          <ProtectedRoute minimumRole="developer" fallbackPath="/">
            <FeatureVisibilitySettings />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/activity-log-dashboard">
        {() => (
          <ProtectedRoute minimumRole="developer" fallbackPath="/">
            <ActivityLogDashboard />
          </ProtectedRoute>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ChatProvider>
            <LeadGateProvider>
              <SelectedPropertyProvider>
                <Switch>
                  {/* Public routes without auth */}
                  <Route path="/login" component={Login} />
                  <Route path="/embed/seller-update" component={SellerUpdateEmbed} />
                  <Route path="/share/cma/:token" component={SharedCMAView} />
                  
                  {/* Protected routes with sidebar */}
                  <Route>
                    <AuthGuard>
                      <SidebarProvider style={style as React.CSSProperties}>
                        <div className="flex h-screen w-full">
                          <AppSidebar />
                          <div className="flex flex-col flex-1 overflow-hidden">
                            <header className="flex items-center justify-between p-4 border-b bg-background gap-4">
                              <SidebarTrigger data-testid="button-sidebar-toggle" />
                              <div className="flex items-center gap-4">
                                <div className="text-sm text-muted-foreground hidden sm:block">
                                  Mission Control | Client Data Portal
                                </div>
                                <UserRoleBadge className="hidden md:flex" />
                                <ThemeToggle />
                                <UserMenu />
                              </div>
                            </header>
                            <main className="flex-1 overflow-auto p-6">
                              <div className="max-w-7xl mx-auto">
                                <Router />
                              </div>
                            </main>
                          </div>
                        </div>
                      </SidebarProvider>
                    </AuthGuard>
                  </Route>
                </Switch>
              </SelectedPropertyProvider>
            </LeadGateProvider>
            <ChatAssistant />
            <Toaster />
          </ChatProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
