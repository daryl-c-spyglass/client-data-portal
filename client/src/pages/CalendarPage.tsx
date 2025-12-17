import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Clock, User, CheckCircle2, Circle, AlertCircle, RefreshCw, ChevronDown, ChevronRight, Bug } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, parseISO } from "date-fns";

interface CalendarItem {
  id: string;
  type: "event" | "task";
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay: boolean;
  assignedTo?: string;
  contact?: string;
  contactId?: string;
  completed?: boolean;
}

interface CalendarData {
  items: CalendarItem[];
  count: number;
  dataSource: string;
  agentId: string;
  dateRange: { start?: string; end?: string };
  fetchedAt: string;
  debug?: {
    appointmentsCount: number;
    tasksCount: number;
    appointmentsError: string | null;
    tasksError: string | null;
    note: string;
  };
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

function CalendarItemCard({ item }: { item: CalendarItem }) {
  const isTask = item.type === "task";
  const isCompleted = item.completed;
  
  return (
    <div 
      className={`flex items-start gap-3 p-4 rounded-lg border ${
        isCompleted ? "opacity-60 bg-muted/50" : "bg-card"
      }`}
      data-testid={`card-calendar-item-${item.id}`}
    >
      <div className="mt-1">
        {isTask ? (
          isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )
        ) : (
          <Calendar className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className={`font-medium ${isCompleted ? "line-through" : ""}`}>
            {item.title}
          </h3>
          <Badge variant="outline" className="text-xs">
            {isTask ? "Task" : "Event"}
          </Badge>
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          {item.start && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                {item.allDay ? (
                  format(parseISO(item.start), "MMM d, yyyy")
                ) : (
                  format(parseISO(item.start), "MMM d, yyyy h:mm a")
                )}
              </span>
            </div>
          )}
          {item.contact && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{item.contact}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DebugPanel({ calendarData, startDate, endDate }: { calendarData: CalendarData; startDate: string; endDate: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const isDev = import.meta.env.DEV;
  
  if (!isDev) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-muted/50 border-dashed">
        <CollapsibleTrigger asChild>
          <button 
            className="flex items-center justify-between w-full px-4 py-2 text-left hover-elevate rounded-md"
            data-testid="button-debug-toggle"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Bug className="h-4 w-4" />
              Debug Details
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 text-xs font-mono space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p><span className="text-muted-foreground">Agent ID:</span> {calendarData.agentId || "all"}</p>
              <p><span className="text-muted-foreground">Data Source:</span> {calendarData.dataSource}</p>
              <p><span className="text-muted-foreground">Date Range:</span> {startDate} to {endDate}</p>
              <p><span className="text-muted-foreground">Total Items:</span> {calendarData.count}</p>
              {calendarData.debug && (
                <>
                  <p><span className="text-muted-foreground">Appointments:</span> {calendarData.debug.appointmentsCount}</p>
                  <p><span className="text-muted-foreground">Tasks:</span> {calendarData.debug.tasksCount}</p>
                </>
              )}
              <p className="col-span-2"><span className="text-muted-foreground">Fetched:</span> {calendarData.fetchedAt}</p>
            </div>
            {calendarData.debug?.appointmentsError && (
              <p className="text-amber-600 dark:text-amber-400">
                Appointments error: {calendarData.debug.appointmentsError}
              </p>
            )}
            {calendarData.debug?.tasksError && (
              <p className="text-amber-600 dark:text-amber-400">
                Tasks error: {calendarData.debug.tasksError}
              </p>
            )}
            {calendarData.debug?.note && (
              <p className="text-muted-foreground italic pt-2">{calendarData.debug.note}</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function CalendarPage() {
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [monthOffset, setMonthOffset] = useState(0);
  
  const currentMonth = addMonths(new Date(), monthOffset);
  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  
  const { data: statusData, isLoading: statusLoading } = useQuery<{ configured: boolean; status: string; message: string }>({
    queryKey: ["/api/fub/status"],
  });
  
  const { data: usersData, isLoading: usersLoading } = useQuery<UsersData>({
    queryKey: ["/api/fub/users"],
    enabled: statusData?.configured === true,
  });
  
  // Build proper query params URL for calendar API
  const calendarUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedUserId && selectedUserId !== "all") {
      params.append("agentId", selectedUserId);
    }
    params.append("start", startDate);
    params.append("end", endDate);
    return `/api/fub/calendar?${params.toString()}`;
  }, [selectedUserId, startDate, endDate]);

  const { data: calendarData, isLoading, error, refetch } = useQuery<CalendarData>({
    queryKey: ["/api/fub/calendar", selectedUserId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(calendarUrl, { credentials: "include" });
      
      // Check content-type before parsing
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.error("[Calendar] Non-JSON response:", contentType, text.slice(0, 200));
        throw new Error(`Server returned HTML instead of JSON (content-type: ${contentType}). This may indicate a routing or authentication issue.`);
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      
      return res.json();
    },
    enabled: statusData?.configured === true,
  });
  
  const isConfigured = statusData?.configured === true;
  const isStatusChecking = statusLoading || statusData === undefined;
  
  const groupedItems = useMemo(() => {
    if (!calendarData?.items) return {};
    
    const groups: Record<string, CalendarItem[]> = {};
    
    for (const item of calendarData.items) {
      if (!item.start) continue;
      const dateKey = format(parseISO(item.start), "yyyy-MM-dd");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    }
    
    return groups;
  }, [calendarData?.items]);
  
  const sortedDates = Object.keys(groupedItems).sort();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Calendar</h1>
          <p className="text-muted-foreground">Events and tasks from Follow Up Boss</p>
        </div>
        {calendarData && (
          <Badge variant="outline" className="text-xs">
            Data from: {calendarData.dataSource}
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
                {statusData?.message || "Please configure FUB_API_KEY to enable calendar features."}
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
              <Label>Agent</Label>
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
              <Label>Month</Label>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setMonthOffset(m => m - 1)}
                  data-testid="button-prev-month"
                >
                  ←
                </Button>
                <span className="flex-1 text-center font-medium">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setMonthOffset(m => m + 1)}
                  data-testid="button-next-month"
                >
                  →
                </Button>
              </div>
            </div>
            <div className="flex items-end col-span-2 gap-2">
              <Button 
                variant="outline"
                onClick={() => setMonthOffset(0)}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button 
                onClick={() => refetch()} 
                disabled={!isConfigured}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {calendarData && (
        <DebugPanel calendarData={calendarData} startDate={startDate} endDate={endDate} />
      )}
      
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load calendar data</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(error as Error).message || 'Please try again.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => refetch()} data-testid="button-retry">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: If the API key only has visibility for its own user, calendar events for other agents may not be accessible.
            </p>
          </CardContent>
        </Card>
      )}
      
      {calendarData && !isLoading && (
        <>
          {calendarData.items.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No events or tasks found for {format(currentMonth, "MMMM yyyy")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((dateKey) => (
                <div key={dateKey}>
                  <h2 className="text-lg font-semibold mb-3 sticky top-0 bg-background py-2">
                    {format(parseISO(dateKey), "EEEE, MMMM d, yyyy")}
                  </h2>
                  <div className="space-y-2">
                    {groupedItems[dateKey].map((item) => (
                      <CalendarItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
