import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserCircle, Mail, Phone, Tag, Clock, AlertCircle, RefreshCw, Search } from "lucide-react";
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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
              <span className="text-xs text-muted-foreground">+{lead.tags.length - 5}</span>
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

export default function LeadsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: statusData, isLoading: statusLoading } = useQuery<{ configured: boolean; status: string; message: string }>({
    queryKey: ["/api/fub/status"],
  });
  
  const { data: usersData } = useQuery<UsersData>({
    queryKey: ["/api/fub/users"],
    enabled: statusData?.configured === true,
  });
  
  const { data: leadsData, isLoading, error, refetch } = useQuery<LeadsData>({
    queryKey: ["/api/fub/leads", selectedUserId === "all" ? "" : selectedUserId],
    enabled: statusData?.configured === true,
  });
  
  const isConfigured = statusData?.configured === true;
  const isStatusChecking = statusLoading || statusData === undefined;
  
  const filteredLeads = leadsData?.leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.includes(query) ||
      lead.source?.toLowerCase().includes(query)
    );
  }) || [];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Leads</h1>
          <p className="text-muted-foreground">People and contacts from Follow Up Boss</p>
        </div>
        {leadsData && (
          <Badge variant="outline" className="text-xs">
            Data from: {leadsData.dataSource}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      
      {process.env.NODE_ENV === "development" && leadsData && (
        <Card className="bg-muted/50">
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-xs font-mono">
            <p>Agent ID: {leadsData.agentId || "all"}</p>
            <p>Leads Returned: {leadsData.count}</p>
            <p>Fetched At: {leadsData.fetchedAt}</p>
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
              Showing {filteredLeads.length} of {leadsData.count} leads
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
