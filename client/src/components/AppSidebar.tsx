import { Home, Search, FileText, Users, Settings, BarChart3, Mail, Filter, Calendar, UserCircle, MessageCircle, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { useChat } from "@/contexts/ChatContext";
import spyglassLogo from "@assets/Large_Logo_1765233192587.jpeg";

interface UserData {
  id: string;
  email: string;
  role?: string;
}

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

const adminItem = {
  title: "Admin",
  url: "/admin",
  icon: Shield,
  testId: "link-admin",
};

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
  const { openChat } = useChat();

  const { data: user } = useQuery<UserData>({
    queryKey: ["/api/auth/me"],
  });

  const isAdmin = user?.role === "admin";

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
              {isAdmin && (
                <SidebarMenuItem key={adminItem.title}>
                  <SidebarMenuButton 
                    asChild
                    className={location === adminItem.url ? "bg-sidebar-accent" : ""}
                  >
                    <Link href={adminItem.url} data-testid={adminItem.testId}>
                      <adminItem.icon className="w-4 h-4" />
                      <span>{adminItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
