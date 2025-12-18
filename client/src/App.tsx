import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatAssistant } from "@/components/ChatAssistant";
import { LeadGateProvider } from "@/contexts/LeadGateContext";
import { SelectedPropertyProvider } from "@/contexts/SelectedPropertyContext";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import CMAs from "@/pages/CMAs";
import CMANew from "@/pages/CMANew";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import CMADetailPage from "@/pages/CMADetailPage";
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
import MissionControl from "@/pages/MissionControl";
import CalendarPage from "@/pages/CalendarPage";
import LeadsPage from "@/pages/LeadsPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/properties" component={Properties} />
      <Route path="/properties/:id" component={PropertyDetailPage} />
      <Route path="/cmas" component={CMAs} />
      <Route path="/cmas/new" component={CMANew} />
      <Route path="/cmas/:id" component={CMADetailPage} />
      <Route path="/seller-updates" component={SellerUpdates} />
      <Route path="/seller-updates/new" component={SellerUpdateNew} />
      <Route path="/seller-updates/:id/preview" component={SellerUpdatePreview} />
      <Route path="/buyer-search" component={BuyerSearch} />
      <Route path="/embed-code" component={EmbedCodeGenerator} />
      <Route path="/clients" component={Clients} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/reports/mission-control" component={MissionControl} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/leads" component={LeadsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  // Custom sidebar width for better content display
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LeadGateProvider>
          <SelectedPropertyProvider>
            <Switch>
            {/* Embed route without sidebar */}
            <Route path="/embed/seller-update" component={SellerUpdateEmbed} />
            
            {/* Public shared CMA view without sidebar */}
            <Route path="/share/cma/:token" component={SharedCMAView} />
            
            {/* All other routes with sidebar */}
            <Route>
              <SidebarProvider style={style as React.CSSProperties}>
                <div className="flex h-screen w-full">
                  <AppSidebar />
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <header className="flex items-center justify-between p-4 border-b bg-background">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                      <div className="text-sm text-muted-foreground">
                        MLS Grid IDX Platform
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
            </Route>
          </Switch>
          </SelectedPropertyProvider>
        </LeadGateProvider>
        <ChatAssistant />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
