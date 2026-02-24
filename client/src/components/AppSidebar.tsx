import { Home, Search, FileText, Users, Settings, BarChart3, Mail, Filter, Calendar, UserCircle, MessageCircle, UsersRound, ClipboardList, Eye, EyeOff, Activity } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChat } from "@/contexts/ChatContext";
import { usePermissions } from "@/hooks/use-permissions";
import { useFeatureVisibility } from "@/hooks/use-feature-visibility";
import spyglassLogo from "@assets/Large_Logo_1765233192587.jpeg";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  testId: string;
  featureKey: string;
}

const menuItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: Home, testId: "link-dashboard", featureKey: "dashboard" },
  { title: "Properties", url: "/properties", icon: Search, testId: "link-properties", featureKey: "properties" },
  { title: "CMAs", url: "/cmas", icon: FileText, testId: "link-cmas", featureKey: "cmas" },
  { title: "Seller Updates", url: "/seller-updates", icon: Mail, testId: "link-seller-updates", featureKey: "seller_updates" },
  { title: "Buyer Search", url: "/buyer-search", icon: Filter, testId: "link-buyer-search", featureKey: "buyer_search" },
  { title: "Clients", url: "/clients", icon: Users, testId: "link-clients", featureKey: "clients" },
  { title: "Analytics", url: "/analytics", icon: BarChart3, testId: "link-analytics", featureKey: "analytics" },
  { title: "Settings", url: "/settings", icon: Settings, testId: "link-settings", featureKey: "settings" },
];

const adminItems: NavItem[] = [
  { title: "User Management", url: "/admin/users", icon: UsersRound, testId: "link-user-management", featureKey: "user_management" },
  { title: "Activity Logs", url: "/admin/activity-logs", icon: ClipboardList, testId: "link-activity-logs", featureKey: "activity_logs" },
  { title: "Feature Visibility", url: "/admin/feature-visibility", icon: Eye, testId: "link-feature-visibility", featureKey: "feature_visibility" },
  { title: "Activity Dashboard", url: "/admin/activity-log-dashboard", icon: Activity, testId: "link-activity-dashboard", featureKey: "activity_dashboard" },
];

const calendarItems: NavItem[] = [
  { title: "Calendar", url: "/calendar", icon: Calendar, testId: "link-calendar", featureKey: "calendar" },
  { title: "Leads", url: "/leads", icon: UserCircle, testId: "link-leads", featureKey: "leads" },
];

function NavItemRenderer({ item, location, isDeveloper, isVisible, isHidden }: { item: NavItem; location: string; isDeveloper: boolean; isVisible: boolean; isHidden: boolean }) {
  if (!isDeveloper && !isVisible) return null;

  const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={`${isActive ? "bg-sidebar-accent" : ""} ${isHidden ? "opacity-50 border border-dashed border-muted-foreground" : ""}`}
      >
        <Link href={item.url} data-testid={item.testId}>
          <item.icon className="w-4 h-4" />
          <span className="flex-1">{item.title}</span>
          {isDeveloper && isHidden && (
            <span className="flex items-center gap-1 ml-auto">
              <EyeOff className="w-3 h-3 text-amber-500" />
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-600 text-white border-amber-600 no-default-hover-elevate no-default-active-elevate">
                DEV
              </Badge>
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { openChat } = useChat();
  const { canAccessAdmin, isDeveloper } = usePermissions();
  const { isFeatureVisible, isFeatureHidden } = useFeatureVisibility();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="block">
          <img
            src={spyglassLogo}
            alt="Spyglass Realty"
            className="h-12 w-auto object-contain"
            data-testid="img-logo"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <NavItemRenderer
                  key={item.featureKey}
                  item={item}
                  location={location}
                  isDeveloper={isDeveloper}
                  isVisible={isFeatureVisible(item.featureKey)}
                  isHidden={isFeatureHidden(item.featureKey)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canAccessAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.filter(item => {
                  if (item.featureKey === 'feature_visibility' || item.featureKey === 'activity_dashboard') return isDeveloper;
                  return true;
                }).map((item) => (
                  <NavItemRenderer
                    key={item.featureKey}
                    item={item}
                    location={location}
                    isDeveloper={isDeveloper}
                    isVisible={isFeatureVisible(item.featureKey)}
                    isHidden={isFeatureHidden(item.featureKey)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Follow Up Boss</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {calendarItems.map((item) => (
                <NavItemRenderer
                  key={item.featureKey}
                  item={item}
                  location={location}
                  isDeveloper={isDeveloper}
                  isVisible={isFeatureVisible(item.featureKey)}
                  isHidden={isFeatureHidden(item.featureKey)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Button
          onClick={openChat}
          className="w-full gap-2"
          data-testid="button-ai-assistant"
        >
          <MessageCircle className="w-4 h-4" />
          AI Assistant
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
