import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Shield, UserCheck, UserX, RefreshCw, Clock, UserPlus } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";

interface UserInfo {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface ActivityLog {
  id: number;
  adminUserId: string;
  action: string;
  targetUserId: string | null;
  previousValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  createdAt: string;
  adminUser: UserInfo | null;
  targetUser: UserInfo | null;
}

type ActionType = "USER_ROLE_CHANGED" | "USER_ENABLED" | "USER_DISABLED" | "USER_CREATED" | "USER_INVITED" | "SETTINGS_UPDATED";

function getActionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  switch (action) {
    case "USER_DISABLED":
      return "destructive";
    case "USER_ROLE_CHANGED":
      return "default";
    case "USER_ENABLED":
    case "USER_CREATED":
    case "USER_INVITED":
      return "secondary";
    default:
      return "outline";
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case "USER_ROLE_CHANGED":
      return <Shield className="w-3 h-3" />;
    case "USER_ENABLED":
      return <UserCheck className="w-3 h-3" />;
    case "USER_DISABLED":
      return <UserX className="w-3 h-3" />;
    case "USER_INVITED":
      return <UserPlus className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
}

function formatAction(action: string): string {
  switch (action) {
    case "USER_ROLE_CHANGED":
      return "Role Changed";
    case "USER_ENABLED":
      return "User Enabled";
    case "USER_DISABLED":
      return "User Disabled";
    case "USER_CREATED":
      return "User Created";
    case "USER_INVITED":
      return "User Invited";
    case "SETTINGS_UPDATED":
      return "Settings Updated";
    default:
      return action;
  }
}

function formatValueChange(action: string, previousValue: string | null, newValue: string | null): string {
  if (action === "USER_ROLE_CHANGED" && previousValue && newValue) {
    const formatRole = (r: string) => {
      switch (r) {
        case "super_admin": return "Super Admin";
        case "admin": return "Admin";
        case "agent": return "Agent";
        default: return r;
      }
    };
    return `${formatRole(previousValue)} → ${formatRole(newValue)}`;
  }
  if (action === "USER_ENABLED") {
    return "Disabled → Active";
  }
  if (action === "USER_DISABLED") {
    return "Active → Disabled";
  }
  if (action === "USER_INVITED" && newValue) {
    const formatRole = (r: string) => {
      switch (r) {
        case "super_admin": return "Super Admin";
        case "admin": return "Admin";
        case "agent": return "Agent";
        default: return r;
      }
    };
    return `Invited as ${formatRole(newValue)}`;
  }
  if (previousValue && newValue) {
    return `${previousValue} → ${newValue}`;
  }
  return "-";
}

function ActivityLogsContent() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<ActivityLog[]>({
    queryKey: ["/api/admin/activity-logs", { action: actionFilter !== "all" ? actionFilter : undefined, limit: pageSize, offset: page * pageSize }],
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/activity-logs"] });
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-logs">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Activity Logs</h1>
          <p className="text-muted-foreground">Audit trail of administrative actions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Admin Actions</CardTitle>
              <CardDescription>
                Track role changes, user status updates, and other administrative actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-action-filter">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="USER_ROLE_CHANGED">Role Changes</SelectItem>
                  <SelectItem value="USER_ENABLED">User Enabled</SelectItem>
                  <SelectItem value="USER_DISABLED">User Disabled</SelectItem>
                  <SelectItem value="USER_INVITED">User Invited</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleRefresh}
                disabled={isFetching}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target User</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{log.adminUser?.email || log.adminUserId}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)} className="gap-1">
                        {getActionIcon(log.action)}
                        {formatAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.targetUser?.email || log.targetUserId || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatValueChange(log.action, log.previousValue, log.newValue)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.ipAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {logs.length >= pageSize && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={logs.length < pageSize}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ActivityLogs() {
  return (
    <ProtectedRoute minimumRole="super_admin" fallbackPath="/admin">
      <ActivityLogsContent />
    </ProtectedRoute>
  );
}
