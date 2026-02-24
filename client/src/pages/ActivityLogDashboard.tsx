import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Activity, Users, AlertTriangle, TrendingUp, Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

interface ActivityLogEntry {
  id: number;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface ActivityStats {
  summary: {
    totalLogs: number;
    uniqueUsers: number;
    errorCount: number;
    errorRate: string;
  };
  actionCounts: Array<{ action: string; count: string }>;
  dailyActivity: Array<{ date: string; count: string }>;
  recentUsers: Array<{ user_email: string; action: string; created_at: string }>;
}

interface Filters {
  action: string;
  status: string;
  startDate: string;
  endDate: string;
}

const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: 'User Login',
  USER_LOGOUT: 'User Logout',
  CMA_CREATED: 'CMA Created',
  CMA_UPDATED: 'CMA Updated',
  CMA_DELETED: 'CMA Deleted',
  CMA_VIEWED: 'CMA Viewed',
  CMA_EXPORTED_PDF: 'CMA PDF Export',
  CMA_SHARED: 'CMA Shared',
  PROPERTY_SEARCH: 'Property Search',
  PROPERTY_VIEWED: 'Property Viewed',
  SELLER_UPDATE_CREATED: 'Seller Update Created',
  SELLER_UPDATE_SENT: 'Seller Update Sent',
  FEATURE_VISIBILITY_CHANGED: 'Feature Visibility Changed',
  FEATURE_VISIBILITY_BULK_UPDATE: 'Feature Bulk Update',
  USER_ROLE_CHANGED: 'Role Changed',
  API_ERROR: 'API Error',
};

function formatAction(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

function getStatusBadgeVariant(status: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (status) {
    case 'error': return 'destructive';
    case 'warning': return 'secondary';
    default: return 'outline';
  }
}

function StatCard({ title, value, icon: Icon, description }: { title: string; value: any; icon: any; description?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value ?? '-'}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ActivityLogDashboard() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ action: '', status: '', startDate: '', endDate: '' });
  const limit = 25;

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));
  if (filters.action) queryParams.set('action', filters.action);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.startDate) queryParams.set('startDate', filters.startDate);
  if (filters.endDate) queryParams.set('endDate', filters.endDate);

  const logsUrl = `/api/activity-logs?${queryParams.toString()}`;
  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: ActivityLogEntry[]; pagination: any }>({
    queryKey: [logsUrl],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ActivityStats>({
    queryKey: ['/api/activity-logs/stats?days=30'],
    staleTime: 1000 * 60 * 5,
  });

  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination;
  const isLoading = logsLoading || statsLoading;

  const chartData = (stats?.dailyActivity || []).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: Number(d.count),
  }));

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ action: '', status: '', startDate: '', endDate: '' });
    setPage(1);
  };

  const uniqueActions = [...new Set(logs.map(l => l.action)), ...(stats?.actionCounts || []).map(a => a.action)];
  const actionOptions = [...new Set(uniqueActions)].sort();

  return (
    <div className="p-6 space-y-6" data-testid="activity-log-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Activity Log Dashboard</h1>
          <p className="text-muted-foreground">Monitor user activities and system events</p>
        </div>
        <Badge variant="outline" className="gap-1.5 no-default-hover-elevate no-default-active-elevate">
          <Shield className="w-3.5 h-3.5" />
          Developer Only
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Events" value={stats?.summary.totalLogs} icon={Activity} description="Last 30 days" />
        <StatCard title="Unique Users" value={stats?.summary.uniqueUsers} icon={Users} />
        <StatCard title="Error Rate" value={stats?.summary.errorRate ? `${stats.summary.errorRate}%` : '0%'} icon={AlertTriangle} />
        <StatCard title="Top Action" value={stats?.actionCounts?.[0] ? formatAction(stats.actionCounts[0].action) : '-'} icon={TrendingUp} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Activity (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>Activity Logs</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              Clear Filters
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            <Select value={filters.action || "all"} onValueChange={(v) => handleFilterChange('action', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-action">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionOptions.map(action => (
                  <SelectItem key={action} value={action}>{formatAction(action)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status || "all"} onValueChange={(v) => handleFilterChange('status', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-[160px]"
              data-testid="input-filter-start-date"
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-[160px]"
              data-testid="input-filter-end-date"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No activity logs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.userEmail || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                            {formatAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.resource ? `${log.resource}${log.resourceId ? ':' + log.resourceId : ''}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(log.status)} className="no-default-hover-elevate no-default-active-elevate">
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.details ? JSON.stringify(log.details).slice(0, 100) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && (
                <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {(stats?.actionCounts?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Actions (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats!.actionCounts.map((item, i) => (
                <div key={item.action} className="flex items-center justify-between" data-testid={`action-count-${i}`}>
                  <span className="text-sm">{formatAction(item.action)}</span>
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
