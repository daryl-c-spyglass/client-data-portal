import { Home, Search, FileText, Users, Settings, BarChart3, Mail, Filter, Calendar, TrendingUp, UserCircle } from "lucide-react";
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
} from "@/components/ui/sidebar";
import spyglassLogo from "@assets/Large_Logo_1765233192587.jpeg";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    testId: "link-dashboard",
  },
  {
    title: "Properties",
    url: "/properties",
    icon: Search,
    testId: "link-properties",
  },
  {
    title: "CMAs",
    url: "/cmas",
    icon: FileText,
    testId: "link-cmas",
  },
  {
    title: "Seller Updates",
    url: "/seller-updates",
    icon: Mail,
    testId: "link-seller-updates",
  },
  {
    title: "Buyer Search",
    url: "/buyer-search",
    icon: Filter,
    testId: "link-buyer-search",
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    testId: "link-clients",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    testId: "link-analytics",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "link-settings",
  },
];

const reportsItems = [
  {
    title: "Mission Control",
    url: "/reports/mission-control",
    icon: TrendingUp,
    testId: "link-mission-control",
  },
];

const calendarItems = [
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    testId: "link-calendar",
  },
  {
    title: "Leads",
    url: "/leads",
    icon: UserCircle,
    testId: "link-leads",
  },
];


export function AppSidebar() {
  const [location] = useLocation();

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
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    className={location === item.url ? "bg-sidebar-accent" : ""}
                  >
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Reports</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    className={location === item.url ? "bg-sidebar-accent" : ""}
                  >
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Follow Up Boss</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {calendarItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    className={location === item.url ? "bg-sidebar-accent" : ""}
                  >
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
