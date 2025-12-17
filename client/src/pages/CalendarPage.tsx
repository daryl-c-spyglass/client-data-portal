import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Clock, User, CheckCircle2, Circle, AlertCircle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Bug, List, Grid3X3, ArrowDownUp, CalendarDays, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, addWeeks, addDays, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";

type SortOption = "newest" | "oldest" | "az" | "za";
type ViewMode = "list" | "month" | "week" | "day";

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

// LocalStorage keys
const STORAGE_KEYS = {
  sortOption: "calendar-sort-option",
  viewMode: "calendar-view-mode",
};

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

function CalendarGridItem({ item, showAgentName = false }: { item: CalendarItem; showAgentName?: boolean }) {
  const isTask = item.type === "task";
  const isCompleted = item.completed;
  
  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{item.title}</div>
      {item.start && (
        <div className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          {item.allDay ? "All day" : format(parseISO(item.start), "h:mm a")}
          {item.end && !item.allDay && ` - ${format(parseISO(item.end), "h:mm a")}`}
        </div>
      )}
      <div className="text-xs">
        <Badge variant="outline" className="text-xs">
          {isTask ? "Task" : "Event"}
        </Badge>
      </div>
      {showAgentName && item.assignedTo && (
        <div className="flex items-center gap-1 text-xs">
          <User className="h-3 w-3" />
          {item.assignedTo}
        </div>
      )}
    </div>
  );
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={`text-xs p-1 rounded truncate cursor-pointer hover-elevate ${
            isTask 
              ? isCompleted 
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 line-through opacity-60" 
                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "bg-primary/10 text-primary"
          }`}
          data-testid={`grid-item-${item.id}`}
        >
          {!item.allDay && item.start && (
            <span className="font-medium mr-1">{format(parseISO(item.start), "h:mm")}</span>
          )}
          {item.title}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

function DayPopoverContent({ 
  date, 
  items,
  onClose,
  showAgentName = false,
}: { 
  date: Date; 
  items: CalendarItem[];
  onClose?: () => void;
  showAgentName?: boolean;
}) {
  return (
    <div className="w-80">
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <div>
          <div className="font-semibold">{format(date, "EEEE")}</div>
          <div className="text-sm text-muted-foreground">{format(date, "MMMM d, yyyy")}</div>
        </div>
        {onClose && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={onClose}
            data-testid="button-popover-close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-2 pr-2">
          {items.map((item) => {
            const isTask = item.type === "task";
            const isCompleted = item.completed;
            const colorClass = isTask 
              ? isCompleted 
                ? "bg-green-100 dark:bg-green-900/30" 
                : "bg-blue-100 dark:bg-blue-900/30"
              : "bg-primary/10";
            
            return (
              <div 
                key={item.id}
                className="p-2 rounded border bg-card text-sm flex gap-2"
                data-testid={`popover-item-${item.id}`}
              >
                <div className={`w-2 shrink-0 rounded ${colorClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`font-medium ${isCompleted ? "line-through opacity-60" : ""}`}>
                      {item.title}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {isTask ? "Task" : "Event"}
                    </Badge>
                    {showAgentName && item.assignedTo && (
                      <Badge variant="secondary" className="text-xs">
                        {item.assignedTo}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {item.start && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.allDay ? "All day" : format(parseISO(item.start), "h:mm a")}
                        {item.end && !item.allDay && ` - ${format(parseISO(item.end), "h:mm a")}`}
                      </span>
                    )}
                  </div>
                  {item.contact && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Contact: {item.contact}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function DayCellWithPopover({
  day,
  dayItems,
  isCurrentMonth,
  isDayToday,
  showAgentName = false,
}: {
  day: Date;
  dayItems: CalendarItem[];
  isCurrentMonth: boolean;
  isDayToday: boolean;
  showAgentName?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dateKey = format(day, "yyyy-MM-dd");
  const hasOverflow = dayItems.length > 3;

  return (
    <div 
      className={`min-h-[100px] p-1 border-b border-r ${
        !isCurrentMonth ? "bg-muted/30" : ""
      } ${isDayToday ? "bg-primary/5" : ""}`}
      data-testid={`calendar-cell-${dateKey}`}
    >
      <div className={`text-sm font-medium mb-1 ${
        !isCurrentMonth ? "text-muted-foreground" : ""
      } ${isDayToday ? "text-primary" : ""}`}>
        {format(day, "d")}
      </div>
      <div className="space-y-0.5 overflow-hidden">
        {dayItems.slice(0, 3).map((item) => (
          <CalendarGridItem key={item.id} item={item} showAgentName={showAgentName} />
        ))}
        {hasOverflow && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                className="text-xs text-primary hover:underline cursor-pointer pl-1 font-medium"
                data-testid={`button-day-popover-${dateKey}`}
              >
                View all ({dayItems.length})
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-3" align="start">
              <DayPopoverContent 
                date={day} 
                items={dayItems} 
                onClose={() => setIsOpen(false)}
                showAgentName={showAgentName}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

function MonthCalendarGrid({ 
  items, 
  currentMonth,
  showAgentName = false,
}: { 
  items: CalendarItem[]; 
  currentMonth: Date;
  showAgentName?: boolean;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks: Date[][] = [];
  
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const item of items) {
      if (!item.start) continue;
      const dateKey = format(parseISO(item.start), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
    }
    return map;
  }, [items]);
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted">
        {weekDays.map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium border-b">
            {day}
          </div>
        ))}
      </div>
      
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7">
          {week.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayItems = itemsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isDayToday = isToday(day);
            
            return (
              <DayCellWithPopover
                key={dateKey}
                day={day}
                dayItems={dayItems}
                isCurrentMonth={isCurrentMonth}
                isDayToday={isDayToday}
                showAgentName={showAgentName}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekCalendarGrid({ 
  items, 
  weekDate,
  showAgentName = false,
}: { 
  items: CalendarItem[]; 
  weekDate: Date;
  showAgentName?: boolean;
}) {
  // Show week containing the specified date
  const weekStart = startOfWeek(weekDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const item of items) {
      if (!item.start) continue;
      const dateKey = format(parseISO(item.start), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
    }
    return map;
  }, [items]);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 bg-muted">
        {days.map((day) => {
          const isDayToday = isToday(day);
          return (
            <div 
              key={format(day, "yyyy-MM-dd")} 
              className={`p-2 text-center border-b ${isDayToday ? "bg-primary/10" : ""}`}
            >
              <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
              <div className={`text-lg font-semibold ${isDayToday ? "text-primary" : ""}`}>
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Week content */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDate[dateKey] || [];
          const isDayToday = isToday(day);
          
          return (
            <div 
              key={dateKey}
              className={`min-h-[300px] p-2 border-r ${isDayToday ? "bg-primary/5" : ""}`}
              data-testid={`week-cell-${dateKey}`}
            >
              <div className="space-y-1">
                {dayItems.map((item) => (
                  <CalendarGridItem key={item.id} item={item} showAgentName={showAgentName} />
                ))}
                {dayItems.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center pt-4">
                    No items
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayCalendarView({ 
  items, 
  dayDate,
  showAgentName = false,
}: { 
  items: CalendarItem[]; 
  dayDate: Date;
  showAgentName?: boolean;
}) {
  const dateKey = format(dayDate, "yyyy-MM-dd");
  const isDayToday = isToday(dayDate);
  
  const dayItems = useMemo(() => {
    return items
      .filter(item => {
        if (!item.start) return false;
        return format(parseISO(item.start), "yyyy-MM-dd") === dateKey;
      })
      .sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
  }, [items, dateKey]);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className={`p-4 text-center border-b bg-muted ${isDayToday ? "bg-primary/10" : ""}`}>
        <div className="text-sm text-muted-foreground">{format(dayDate, "EEEE")}</div>
        <div className={`text-2xl font-bold ${isDayToday ? "text-primary" : ""}`}>
          {format(dayDate, "MMMM d, yyyy")}
        </div>
      </div>
      
      <div className="p-4 min-h-[400px]" data-testid={`day-view-${dateKey}`}>
        {dayItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No items scheduled for this day
          </div>
        ) : (
          <div className="space-y-2">
            {dayItems.map((item) => {
              const isTask = item.type === "task";
              const tooltipContent = (
                <div className="space-y-1">
                  <div className="font-medium">{item.title}</div>
                  {item.start && (
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      {item.allDay ? "All day" : format(parseISO(item.start), "h:mm a")}
                      {item.end && !item.allDay && ` - ${format(parseISO(item.end), "h:mm a")}`}
                    </div>
                  )}
                  <div className="text-xs">
                    <Badge variant="outline" className="text-xs">
                      {isTask ? "Task" : "Event"}
                    </Badge>
                  </div>
                  {showAgentName && item.assignedTo && (
                    <div className="flex items-center gap-1 text-xs">
                      <User className="h-3 w-3" />
                      {item.assignedTo}
                    </div>
                  )}
                </div>
              );
              
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <div
                      className="p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                      data-testid={`day-item-${item.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isTask ? (
                          item.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : (
                          <Calendar className="h-4 w-4 text-primary" />
                        )}
                        <span className={`font-medium ${item.completed ? "line-through opacity-60" : ""}`}>
                          {item.title}
                        </span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {isTask ? "Task" : "Event"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground ml-6 flex-wrap">
                        {item.start && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.allDay ? "All day" : format(parseISO(item.start), "h:mm a")}
                            {item.end && !item.allDay && ` - ${format(parseISO(item.end), "h:mm a")}`}
                          </span>
                        )}
                        {item.contact && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {item.contact}
                          </span>
                        )}
                        {showAgentName && item.assignedTo && (
                          <Badge variant="secondary" className="text-xs">
                            {item.assignedTo}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start">
                    {tooltipContent}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarLegend({ horizontal = false }: { horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div className="flex items-center gap-4 p-3 border rounded-lg bg-card">
        <span className="text-xs font-medium text-muted-foreground">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/10" />
          <span className="text-xs text-muted-foreground">Event</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30" />
          <span className="text-xs text-muted-foreground">Task</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30" />
          <span className="text-xs text-muted-foreground">Completed</span>
        </div>
      </div>
    );
  }
  
  return (
    <Card className="w-48 shrink-0">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Legend</CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/10" />
          <span className="text-xs text-muted-foreground">Event</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30" />
          <span className="text-xs text-muted-foreground">Task (pending)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30" />
          <span className="text-xs text-muted-foreground">Task (completed)</span>
        </div>
      </CardContent>
    </Card>
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  
  // Refresh button states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  
  // Initialize from localStorage
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.sortOption);
      if (saved && ["newest", "oldest", "az", "za"].includes(saved)) {
        return saved as SortOption;
      }
    }
    return "newest";
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.viewMode);
      if (saved && ["list", "month", "week", "day"].includes(saved)) {
        return saved as ViewMode;
      }
    }
    return "list";
  });
  
  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sortOption, sortOption);
  }, [sortOption]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
  }, [viewMode]);
  
  const currentMonth = addMonths(new Date(), monthOffset);
  const currentWeek = addWeeks(new Date(), weekOffset);
  const currentDay = addDays(new Date(), dayOffset);
  
  // Compute date range based on view mode for API fetching
  const { startDate, endDate } = useMemo(() => {
    if (viewMode === "day") {
      const dayStr = format(currentDay, "yyyy-MM-dd");
      return { startDate: dayStr, endDate: dayStr };
    }
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
      return {
        startDate: format(weekStart, "yyyy-MM-dd"),
        endDate: format(weekEnd, "yyyy-MM-dd"),
      };
    }
    // For list and month views, fetch the whole month
    return {
      startDate: format(startOfMonth(currentMonth), "yyyy-MM-dd"),
      endDate: format(endOfMonth(currentMonth), "yyyy-MM-dd"),
    };
  }, [viewMode, currentMonth, currentWeek, currentDay]);
  
  // Navigation handlers based on view mode
  const handlePrev = () => {
    if (viewMode === "day") {
      setDayOffset(d => d - 1);
    } else if (viewMode === "week") {
      setWeekOffset(w => w - 1);
    } else {
      setMonthOffset(m => m - 1);
    }
  };
  
  const handleNext = () => {
    if (viewMode === "day") {
      setDayOffset(d => d + 1);
    } else if (viewMode === "week") {
      setWeekOffset(w => w + 1);
    } else {
      setMonthOffset(m => m + 1);
    }
  };
  
  const handleToday = () => {
    setMonthOffset(0);
    setWeekOffset(0);
    setDayOffset(0);
  };
  
  // Handle refresh with animation
  const handleRefresh = async (refetchFn: () => Promise<any>) => {
    setIsRefreshing(true);
    setRefreshSuccess(false);
    try {
      await refetchFn();
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 1000);
    } catch (e) {
      // Error handled by query
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Get navigation label based on view mode
  const getNavigationLabel = () => {
    if (viewMode === "day") {
      return format(currentDay, "EEE, MMM d, yyyy");
    }
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    }
    return format(currentMonth, "MMM yyyy");
  };
  
  // Get period label for filter section
  const getPeriodLabel = () => {
    if (viewMode === "day") return "Day";
    if (viewMode === "week") return "Week";
    return "Month";
  };
  
  const { data: statusData, isLoading: statusLoading } = useQuery<{ configured: boolean; status: string; message: string }>({
    queryKey: ["/api/fub/status"],
  });
  
  const { data: usersData } = useQuery<UsersData>({
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
  
  // Create a map from user ID to user name for agent name resolution
  const userIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    if (usersData?.users) {
      for (const user of usersData.users) {
        map[user.id] = user.name || user.email || `User ${user.id}`;
      }
    }
    return map;
  }, [usersData?.users]);

  // Sort items based on selected sort option and resolve agent names
  const sortedItems = useMemo(() => {
    if (!calendarData?.items) return [];
    
    // First, resolve agent names from IDs
    const items = calendarData.items.map(item => ({
      ...item,
      assignedTo: item.assignedTo 
        ? (userIdToName[item.assignedTo] || item.assignedTo)
        : undefined,
    }));
    
    // Separate items with and without start dates
    const withDate = items.filter(item => item.start);
    const withoutDate = items.filter(item => !item.start);
    
    switch (sortOption) {
      case "newest":
        withDate.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
        break;
      case "oldest":
        withDate.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        break;
      case "az":
        withDate.sort((a, b) => (a.title || "").trim().toLowerCase().localeCompare((b.title || "").trim().toLowerCase()));
        withoutDate.sort((a, b) => (a.title || "").trim().toLowerCase().localeCompare((b.title || "").trim().toLowerCase()));
        break;
      case "za":
        withDate.sort((a, b) => (b.title || "").trim().toLowerCase().localeCompare((a.title || "").trim().toLowerCase()));
        withoutDate.sort((a, b) => (b.title || "").trim().toLowerCase().localeCompare((a.title || "").trim().toLowerCase()));
        break;
    }
    
    return [...withDate, ...withoutDate];
  }, [calendarData?.items, sortOption, userIdToName]);
  
  // Group items by date for list view
  const groupedItems = useMemo(() => {
    const groups: Record<string, CalendarItem[]> = {};
    
    for (const item of sortedItems) {
      if (!item.start) continue;
      const dateKey = format(parseISO(item.start), "yyyy-MM-dd");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    }
    
    return groups;
  }, [sortedItems]);
  
  // Sort dates based on sort option
  const sortedDates = useMemo(() => {
    const dates = Object.keys(groupedItems);
    if (sortOption === "oldest") {
      return dates.sort();
    }
    // For newest, az, za - show newest dates first
    return dates.sort().reverse();
  }, [groupedItems, sortOption]);
  
  const sortLabels: Record<SortOption, string> = {
    newest: "Newest → Oldest",
    oldest: "Oldest → Newest",
    az: "A → Z",
    za: "Z → A",
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Calendar</h1>
          <p className="text-muted-foreground">Events and tasks from Follow Up Boss</p>
        </div>
        <div className="flex items-center gap-2">
          {calendarData && (
            <Badge variant="outline" className="text-xs">
              Data from: {calendarData.dataSource}
            </Badge>
          )}
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Agent Filter */}
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
            
            {/* Period Navigation */}
            <div className="space-y-2 min-w-[200px]">
              <Label>{getPeriodLabel()}</Label>
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handlePrev}
                  data-testid="button-prev"
                  className="shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex-1 text-center font-medium text-sm whitespace-nowrap px-2">
                  {getNavigationLabel()}
                </span>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleNext}
                  data-testid="button-next"
                  className="shrink-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Sort Dropdown */}
            <div className="space-y-2 min-w-[170px]">
              <Label>Sort</Label>
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger data-testid="select-sort" className="w-full">
                  <ArrowDownUp className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest → Oldest</SelectItem>
                  <SelectItem value="oldest">Oldest → Newest</SelectItem>
                  <SelectItem value="az">A → Z</SelectItem>
                  <SelectItem value="za">Z → A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* View Toggle */}
            <div className="space-y-2 lg:col-span-2">
              <Label>View</Label>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  data-testid="button-view-month"
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  data-testid="button-view-week"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Week
                </Button>
                <Button
                  variant={viewMode === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("day")}
                  data-testid="button-view-day"
                >
                  <CalendarDays className="h-4 w-4 mr-1" />
                  Day
                </Button>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <Button 
                variant="outline"
                onClick={handleToday}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button 
                onClick={() => handleRefresh(refetch)} 
                disabled={!isConfigured || isRefreshing}
                data-testid="button-refresh"
                className={refreshSuccess ? "bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white" : ""}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {calendarData && (
        <DebugPanel calendarData={calendarData} startDate={startDate} endDate={endDate} />
      )}
      
      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {viewMode === "list" ? (
            [1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="border rounded-lg p-4">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Error State */}
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
      
      {/* Calendar Content */}
      {calendarData && !isLoading && (
        <>
          {calendarData.items.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No items found for this period</p>
                <p className="text-sm mt-1">{getNavigationLabel()}</p>
              </CardContent>
            </Card>
          ) : viewMode === "list" ? (
            /* List View */
            <div className="space-y-6">
              {sortedDates.map((dateKey) => (
                <div key={dateKey}>
                  <h2 className="text-lg font-semibold mb-3 sticky top-0 bg-background py-2 z-10">
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
          ) : viewMode === "month" ? (
            /* Month Grid View with Legend */
            <div className="space-y-4">
              <div className="lg:hidden">
                <CalendarLegend horizontal />
              </div>
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <MonthCalendarGrid 
                    items={sortedItems} 
                    currentMonth={currentMonth} 
                    showAgentName={selectedUserId === "all"} 
                  />
                </div>
                <div className="hidden lg:block">
                  <CalendarLegend />
                </div>
              </div>
            </div>
          ) : viewMode === "week" ? (
            /* Week Grid View with Legend */
            <div className="space-y-4">
              <div className="lg:hidden">
                <CalendarLegend horizontal />
              </div>
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <WeekCalendarGrid 
                    items={sortedItems} 
                    weekDate={currentWeek} 
                    showAgentName={selectedUserId === "all"} 
                  />
                </div>
                <div className="hidden lg:block">
                  <CalendarLegend />
                </div>
              </div>
            </div>
          ) : (
            /* Day View */
            <DayCalendarView 
              items={sortedItems} 
              dayDate={currentDay} 
              showAgentName={selectedUserId === "all"} 
            />
          )}
        </>
      )}
    </div>
  );
}
