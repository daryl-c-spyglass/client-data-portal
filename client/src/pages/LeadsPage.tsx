import { useState, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserCircle, Mail, Phone, Tag, Clock, AlertCircle, RefreshCw, Search, ArrowDownUp, Loader2, Cake, Home, Activity, MessageSquare, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, formatDistanceToNow } from "date-fns";

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  stage?: string;
  assignedTo?: string;
  createdAt?: string;
  lastActivity?: string;
  tags: string[];
}

interface LeadsData {
  leads: Lead[];
  count: number;
  totalCount: number;
  hasMore: boolean;
  offset: number;
  limit: number;
  dataSource: string;
  agentId: string;
  fetchedAt: string;
}

interface FubUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  active: boolean;
}

interface UsersData {
  users: FubUser[];
  count: number;
}

interface AgentProfile {
  agentId: string;
  agentName: string;
  email: string;
  phone?: string;
  birthday?: string | null;
  homeAnniversary?: string | null;
  role?: string;
  createdAt?: string;
  note?: string | null;
}

interface AgentActivity {
  id: string;
  type: string;
  occurredAt: string;
  summary: string;
  leadId?: string;
  leadName?: string;
}

interface AgentActivityData {
  agentId: string;
  recentActivity: AgentActivity[];
  count: number;
  sinceDate: string;
}

type SortOption = "az" | "za";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AgentDetailsCard({ 
  profile, 
  activity,
  isLoadingProfile,
  isLoadingActivity,
  profileError,
  activityError,
  onRetry,
}: { 
  profile?: AgentProfile;
  activity?: AgentActivityData;
  isLoadingProfile: boolean;
  isLoadingActivity: boolean;
  profileError?: Error | null;
  activityError?: Error | null;
  onRetry?: () => void;
}) {
  if (isLoadingProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Agent Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (profileError) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Agent Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Unable to load agent insights.</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry-insights">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return null;
  }

  const formatDateSafe = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <Card data-testid="card-agent-insights">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          Agent Insights
        </CardTitle>
        <CardDescription>{profile.agentName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Cake className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Birthday</p>
              <p className="text-sm font-medium">
                {formatDateSafe(profile.birthday) || "Not on file"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Home Anniversary</p>
              <p className="text-sm font-medium">
                {formatDateSafe(profile.homeAnniversary) || "Not on file"}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Recent Activity</p>
          </div>
          
          {isLoadingActivity ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activityError ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">Unable to load activity feed.</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry-activity">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>
          ) : activity && activity.recentActivity.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activity.recentActivity.slice(0, 10).map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm"
                  data-testid={`activity-item-${item.id}`}
                >
                  <MessageSquare className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(parseISO(item.occurredAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs mt-1 truncate">{item.summary}</p>
                    {item.leadName && (
                      <p className="text-xs text-muted-foreground">Lead: {item.leadName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity in the last 30 days
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div 
      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover-elevate"
      data-testid={`card-lead-${lead.id}`}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback className="bg-primary/10 text-primary">
          {getInitials(lead.name || "?")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium">{lead.name}</h3>
          {lead.source && (
            <Badge variant="outline" className="text-xs">
              {lead.source}
            </Badge>
          )}
          {lead.stage && (
            <Badge variant="secondary" className="text-xs">
              {lead.stage}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
          {lead.email && (
            <a 
              href={`mailto:${lead.email}`} 
              className="flex items-center gap-1 hover:text-primary"
            >
              <Mail className="h-3 w-3" />
              <span>{lead.email}</span>
            </a>
          )}
          {lead.phone && (
            <a 
              href={`tel:${lead.phone}`} 
              className="flex items-center gap-1 hover:text-primary"
            >
              <Phone className="h-3 w-3" />
              <span>{lead.phone}</span>
            </a>
          )}
        </div>
        {lead.tags && lead.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {lead.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {lead.tags.length > 5 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    data-testid={`button-more-tags-${lead.id}`}
                  >
                    +{lead.tags.length - 5} more
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="flex items-center justify-between p-3 border-b">
                    <h4 className="font-medium text-sm">All Tags ({lead.tags.length})</h4>
                  </div>
                  <ScrollArea className="max-h-48">
                    <div className="p-3 flex flex-wrap gap-1">
                      {lead.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="outline" 
                          className="text-xs"
                          data-testid={`tag-${tag}`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>
      <div className="text-right text-sm text-muted-foreground shrink-0">
        {lead.lastActivity && (
          <div className="flex items-center gap-1 justify-end">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(parseISO(lead.lastActivity), { addSuffix: true })}</span>
          </div>
        )}
        {lead.createdAt && (
          <p className="text-xs mt-1">
            Created {format(parseISO(lead.createdAt), "MMM d, yyyy")}
          </p>
        )}
      </div>
    </div>
  );
}

const LEADS_PER_PAGE = 50;

export default function LeadsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("az");
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const { data: statusData, isLoading: statusLoading } = useQuery<{ configured: boolean; status: string; message: string }>({
    queryKey: ["/api/fub/status"],
  });
  
  const { data: usersData } = useQuery<UsersData>({
    queryKey: ["/api/fub/users"],
    enabled: statusData?.configured === true,
  });
  
  // Use infinite query for pagination
  const {
    data: leadsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery<LeadsData>({
    queryKey: ["/api/fub/leads", selectedUserId === "all" ? "" : selectedUserId],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (selectedUserId && selectedUserId !== "all") {
        params.append("agentId", selectedUserId);
      }
      params.append("limit", String(LEADS_PER_PAGE));
      params.append("offset", String(pageParam));
      
      const res = await fetch(`/api/fub/leads?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch leads");
      }
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      // Check if there are more leads based on multiple possible indicators
      if (lastPage.hasMore) {
        return lastPage.offset + lastPage.limit;
      }
      // Fallback: if we got a full page, there might be more
      if (lastPage.count === lastPage.limit) {
        return lastPage.offset + lastPage.limit;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: statusData?.configured === true,
  });
  
  // Fetch agent profile when a specific agent is selected
  const { data: agentProfile, isLoading: isLoadingProfile, error: profileError, refetch: refetchProfile } = useQuery<AgentProfile>({
    queryKey: ["/api/fub/agent", selectedUserId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/fub/agent/${selectedUserId}/profile`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch agent profile");
      }
      return res.json();
    },
    enabled: statusData?.configured === true && selectedUserId !== "all",
    retry: 1,
  });
  
  // Fetch agent activity when a specific agent is selected
  const { data: agentActivity, isLoading: isLoadingActivity, error: activityError, refetch: refetchActivity } = useQuery<AgentActivityData>({
    queryKey: ["/api/fub/agent", selectedUserId, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/fub/agent/${selectedUserId}/activity?limit=20`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch agent activity");
      }
      return res.json();
    },
    enabled: statusData?.configured === true && selectedUserId !== "all",
    retry: 1,
  });
  
  // Combine all pages of leads and sort client-side
  const allLeads = leadsData?.pages.flatMap((page) => page.leads) || [];
  const totalCount = leadsData?.pages[0]?.totalCount || allLeads.length;
  
  // Sort leads client-side based on sort option
  const sortedLeads = [...allLeads].sort((a, b) => {
    const nameA = (a.name || "").toLowerCase();
    const nameB = (b.name || "").toLowerCase();
    if (sortOption === "az") {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });
  
  const isConfigured = statusData?.configured === true;
  const isStatusChecking = statusLoading || statusData === undefined;
  
  // Filter leads by search query (client-side filtering on already loaded and sorted data)
  const filteredLeads = sortedLeads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.includes(query) ||
      lead.source?.toLowerCase().includes(query)
    );
  });
  
  // Infinite scroll observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  
  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "100px",
      threshold: 0,
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [handleObserver]);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Leads</h1>
          <p className="text-muted-foreground">People and contacts from Follow Up Boss</p>
        </div>
        {leadsData?.pages[0] && (
          <Badge variant="outline" className="text-xs">
            Data from: {leadsData.pages[0].dataSource}
          </Badge>
        )}
      </div>
      
      {isStatusChecking && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {!isStatusChecking && !isConfigured && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Follow Up Boss API Not Configured</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {statusData?.message || "Please configure FUB_API_KEY to enable leads features."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Assigned Agent</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-agent">
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {usersData?.users?.filter(u => u.active).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort by Name</Label>
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger data-testid="select-sort">
                  <ArrowDownUp className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="az">A → Z</SelectItem>
                  <SelectItem value="za">Z → A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => refetch()} 
                disabled={!isConfigured}
                className="w-full"
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Agent Insights Card - shown when a specific agent is selected */}
      {selectedUserId === "all" ? (
        <Card className="border-dashed" data-testid="card-select-agent-prompt">
          <CardContent className="py-6 text-center">
            <UserCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Agent Insights</p>
            <p className="text-sm text-muted-foreground mt-1">
              Select an agent from the filter above to view their birthday, home anniversary, and recent activity.
            </p>
          </CardContent>
        </Card>
      ) : (
        <AgentDetailsCard
          profile={agentProfile}
          activity={agentActivity}
          isLoadingProfile={isLoadingProfile}
          isLoadingActivity={isLoadingActivity}
          profileError={profileError as Error | null}
          activityError={activityError as Error | null}
          onRetry={() => {
            refetchProfile();
            refetchActivity();
          }}
        />
      )}
      
      {process.env.NODE_ENV === "development" && leadsData?.pages[0] && (
        <Card className="bg-muted/50">
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-xs font-mono">
            <p>Agent ID: {leadsData.pages[0].agentId || "all"}</p>
            <p>Total Leads: {totalCount}</p>
            <p>Loaded: {allLeads.length}</p>
            <p>Pages: {leadsData.pages.length}</p>
            <p>Has More: {hasNextPage ? "Yes" : "No"}</p>
            <p>Sort: {sortOption}</p>
            <p>Fetched At: {leadsData.pages[0].fetchedAt}</p>
          </CardContent>
        </Card>
      )}
      
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load leads data. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {leadsData && !isLoading && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredLeads.length} of {totalCount} leads
              {hasNextPage && !searchQuery && " (scroll for more)"}
            </p>
          </div>
          
          {filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  {searchQuery 
                    ? "No leads match your search criteria" 
                    : "No leads found for this agent"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
              
              {/* Infinite scroll trigger */}
              <div ref={loadMoreRef} className="h-4" />
              
              {/* Loading indicator at bottom */}
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more leads...</span>
                </div>
              )}
              
              {/* End of list indicator */}
              {!hasNextPage && allLeads.length > 0 && !searchQuery && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  All {totalCount} leads loaded
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
