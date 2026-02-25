import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitCommit,
  GitBranch,
  Rocket,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Search,
  ExternalLink,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DeploymentLog } from "@shared/schema";

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  in_progress: { label: "In Progress", icon: Loader2, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  deployed: { label: "Deployed", icon: CheckCircle, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  failed: { label: "Failed", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  rolled_back: { label: "Rolled Back", icon: RefreshCw, className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
} as const;

const CHANGE_TYPE_CONFIG = {
  feature: { label: "Feature", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  bugfix: { label: "Bug Fix", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  hotfix: { label: "Hotfix", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  refactor: { label: "Refactor", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  config: { label: "Config", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  documentation: { label: "Docs", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
} as const;

const TARGET_CONFIG = {
  replit: { label: "Replit", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  vercel: { label: "Vercel", className: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" },
  render: { label: "Render", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  github: { label: "GitHub", className: "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800" },
} as const;

const EMPTY_FORM = {
  commitHash: "",
  commitMessage: "",
  commitUrl: "",
  branch: "main",
  deploymentTarget: "replit",
  deploymentUrl: "",
  environment: "production",
  changeType: "feature",
  changeDescription: "",
  requestedByName: "",
  requestSource: "manual",
  requestReference: "",
  notes: "",
};

interface Filters {
  status: string;
  changeType: string;
  deploymentTarget: string;
  search: string;
  page: number;
}

export default function DeploymentLogsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ status: "", changeType: "", deploymentTarget: "", search: "", page: 1 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusUpdateId, setStatusUpdateId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState("deployed");

  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.changeType) queryParams.set("changeType", filters.changeType);
  if (filters.deploymentTarget) queryParams.set("deploymentTarget", filters.deploymentTarget);
  if (filters.search) queryParams.set("search", filters.search);
  queryParams.set("page", String(filters.page));

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<{ logs: DeploymentLog[]; pagination: { page: number; totalPages: number; total: number } }>({
    queryKey: ["/api/deployment-logs", filters],
    queryFn: () => fetch(`/api/deployment-logs?${queryParams}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/deployment-logs/stats"],
    queryFn: () => fetch("/api/deployment-logs/stats?days=30", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: webhookHealth } = useQuery<{
    health: {
      github: { configured: boolean; webhookUrl: string };
      vercel: { configured: boolean; webhookUrl: string };
      render: { configured: boolean; webhookUrl: string };
    };
    recentActivity: { source: string; count: number; lastActivity: string }[];
  }>({
    queryKey: ["/api/webhooks/health"],
    queryFn: () => fetch("/api/webhooks/health", { credentials: "include" }).then(r => r.json()),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/deployment-logs/${id}/status`, "PUT", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs/stats"] });
      toast({ title: "Status updated" });
      setStatusUpdateId(null);
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/deployment-logs/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs/stats"] });
      toast({ title: "Entry deleted" });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const syncVercelMutation = useMutation({
    mutationFn: () => fetch("/api/deployment-logs/sync/vercel", { method: "POST", credentials: "include" }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sync failed");
      return d;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs/stats"] });
      toast({ title: "Vercel sync complete", description: `${data.synced} new · ${data.updated} updated · ${data.skipped} unchanged` });
    },
    onError: (err: Error) => toast({ title: err.message === "VERCEL_API_TOKEN not configured" ? "VERCEL_API_TOKEN not set" : "Vercel sync failed", description: err.message === "VERCEL_API_TOKEN not configured" ? "Add VERCEL_API_TOKEN to your environment secrets" : undefined, variant: "destructive" }),
  });

  const syncGithubMutation = useMutation({
    mutationFn: () => fetch("/api/deployment-logs/sync/github", { method: "POST", credentials: "include" }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sync failed");
      return d;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs/stats"] });
      toast({ title: "GitHub sync complete", description: `${data.synced} new · ${data.skipped} already tracked` });
    },
    onError: (err: Error) => toast({ title: err.message.includes("not configured") ? "GitHub env vars not set" : "GitHub sync failed", description: err.message.includes("not configured") ? "Add GITHUB_TOKEN and GITHUB_REPO to your environment secrets" : undefined, variant: "destructive" }),
  });

  const setFilter = (key: keyof Filters, value: string) => setFilters(f => ({ ...f, [key]: value, page: 1 }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deployment Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automatically tracks commits and deployments across all environments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" />
            Auto-updates every 30s
            {dataUpdatedAt ? (
              <span className="text-muted-foreground/70">
                · synced {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} data-testid="button-add-deployment" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Log Manually
          </Button>
        </div>
      </div>

      {/* Sync Panel */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <p className="text-sm font-medium">Webhook Status</p>
              <div className="flex flex-wrap items-center gap-4">
                {(["github", "vercel", "render"] as const).map(service => {
                  const cfg = webhookHealth?.health?.[service];
                  const activity = webhookHealth?.recentActivity?.find(a => a.source === service);
                  return (
                    <div key={service} className="flex items-center gap-2" data-testid={`webhook-status-${service}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg?.configured ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                      <span className="text-sm capitalize">{service}</span>
                      {activity ? (
                        <span className="text-xs text-muted-foreground">({activity.count} today)</span>
                      ) : cfg && !cfg.configured ? (
                        <span className="text-xs text-muted-foreground">(not configured)</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncVercelMutation.mutate()}
                disabled={syncVercelMutation.isPending}
                data-testid="button-sync-vercel"
              >
                {syncVercelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Sync Vercel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncGithubMutation.mutate()}
                disabled={syncGithubMutation.isPending}
                data-testid="button-sync-github"
              >
                {syncGithubMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <GitCommit className="w-3.5 h-3.5 mr-1.5" />}
                Sync GitHub
              </Button>
            </div>
          </div>
          {webhookHealth && !Object.values(webhookHealth.health).some(h => h.configured) && (
            <p className="text-xs text-muted-foreground">
              No webhooks configured — use the sync buttons above for on-demand updates, or add webhook secrets for real-time automatic tracking.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total (30d)"
          value={stats?.summary?.totalDeployments ?? "-"}
          icon={Rocket}
          isLoading={!stats}
        />
        <StatCard
          title="Success Rate"
          value={stats?.summary ? `${stats.summary.successRate}%` : "-"}
          icon={CheckCircle}
          valueClass="text-green-600 dark:text-green-400"
          isLoading={!stats}
        />
        <StatCard
          title="Failed"
          value={stats?.summary?.failedCount ?? "-"}
          icon={XCircle}
          valueClass="text-red-600 dark:text-red-400"
          isLoading={!stats}
        />
        <StatCard
          title="Top Requester"
          value={stats?.topRequesters?.[0]?.requestedByName || "—"}
          icon={User}
          isLoading={!stats}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search commits, descriptions..."
                value={filters.search}
                onChange={e => setFilter("search", e.target.value)}
                data-testid="input-search-deployments"
              />
            </div>
            <Select value={filters.status || "all"} onValueChange={v => setFilter("status", v === "all" ? "" : v)}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="deployed">Deployed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="rolled_back">Rolled Back</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.changeType || "all"} onValueChange={v => setFilter("changeType", v === "all" ? "" : v)}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="bugfix">Bug Fix</SelectItem>
                <SelectItem value="hotfix">Hotfix</SelectItem>
                <SelectItem value="refactor">Refactor</SelectItem>
                <SelectItem value="config">Config</SelectItem>
                <SelectItem value="documentation">Docs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.deploymentTarget || "all"} onValueChange={v => setFilter("deploymentTarget", v === "all" ? "" : v)}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-target">
                <SelectValue placeholder="All Targets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Targets</SelectItem>
                <SelectItem value="replit">Replit</SelectItem>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="render">Render</SelectItem>
                <SelectItem value="github">GitHub</SelectItem>
              </SelectContent>
            </Select>
            {(filters.status || filters.changeType || filters.deploymentTarget || filters.search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ status: "", changeType: "", deploymentTarget: "", search: "", page: 1 })}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Commit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Requested By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data?.logs?.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Rocket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No deployment logs found</p>
                    <p className="text-xs mt-1">Log your first deployment to start tracking changes</p>
                  </td>
                </tr>
              ) : (
                data.logs.map(log => (
                  <DeploymentRow
                    key={log.id}
                    log={log}
                    onUpdateStatus={(id) => { setStatusUpdateId(id); setNewStatus("deployed"); }}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              {data.pagination.total} total entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= data.pagination.totalPages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Deployment Modal */}
      {showAddModal && (
        <AddDeploymentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/deployment-logs/stats"] });
          }}
        />
      )}

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateId !== null} onOpenChange={() => setStatusUpdateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Deployment Status</DialogTitle>
            <DialogDescription>Change the current status of this deployment entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>New Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger data-testid="select-new-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="deployed">Deployed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="rolled_back">Rolled Back</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusUpdateId(null)}>Cancel</Button>
            <Button
              onClick={() => statusUpdateId && updateStatusMutation.mutate({ id: statusUpdateId, status: newStatus })}
              disabled={updateStatusMutation.isPending}
              data-testid="button-confirm-status"
            >
              {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeploymentRow({ log, onUpdateStatus, onDelete }: { log: DeploymentLog; onUpdateStatus: (id: number) => void; onDelete: (id: number) => void }) {
  const statusCfg = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const changeCfg = CHANGE_TYPE_CONFIG[log.changeType as keyof typeof CHANGE_TYPE_CONFIG];
  const targetCfg = TARGET_CONFIG[log.deploymentTarget as keyof typeof TARGET_CONFIG];
  const StatusIcon = statusCfg.icon;

  return (
    <tr className="hover-elevate" data-testid={`row-deployment-${log.id}`}>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${statusCfg.className}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${log.status === "in_progress" ? "animate-spin" : ""}`} />
          {statusCfg.label}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-muted-foreground shrink-0" />
          {log.commitHash ? (
            <a
              href={log.commitUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-primary hover:underline"
            >
              {log.commitHash.substring(0, 7)}
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">no commit</span>
          )}
          {log.branch && log.branch !== "main" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitBranch className="w-3 h-3" />
              {log.branch}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 max-w-[280px]">
        <p className="text-sm leading-snug line-clamp-2">{log.changeDescription}</p>
        {log.commitMessage && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 font-mono">{log.commitMessage}</p>
        )}
      </td>

      <td className="px-4 py-3">
        {changeCfg && (
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${changeCfg.className}`}>
            {changeCfg.label}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {targetCfg && (
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${targetCfg.className}`}>
              {targetCfg.label}
            </span>
          )}
          {log.deploymentUrl && (
            <a href={log.deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm leading-tight">{log.requestedByName || "Unknown"}</p>
            {log.requestSource && <p className="text-xs text-muted-foreground">via {log.requestSource}</p>}
          </div>
        </div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-sm">{format(new Date(log.requestedAt!), "MMM d, yyyy")}</p>
        <p className="text-xs text-muted-foreground">{format(new Date(log.requestedAt!), "h:mm a")}</p>
        {log.deployedAt && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            Deployed {formatDistanceToNow(new Date(log.deployedAt), { addSuffix: true })}
          </p>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUpdateStatus(log.id)}
            data-testid={`button-update-status-${log.id}`}
            title="Update status"
          >
            <AlertCircle className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(log.id)}
            data-testid={`button-delete-deployment-${log.id}`}
            title="Delete entry"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StatCard({ title, value, icon: Icon, valueClass = "", isLoading }: { title: string; value: string | number; icon: any; valueClass?: string; isLoading?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className={`text-2xl font-semibold truncate ${valueClass}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AddDeploymentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);

  const mutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => apiRequest("/api/deployment-logs", "POST", data),
    onSuccess: () => {
      toast({ title: "Deployment logged successfully" });
      onSuccess();
      onClose();
    },
    onError: () => toast({ title: "Failed to log deployment", variant: "destructive" }),
  });

  const set = (key: keyof typeof EMPTY_FORM, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log New Deployment</DialogTitle>
          <DialogDescription>Record a code change or deployment manually.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="commitHash">Commit Hash</Label>
              <Input id="commitHash" value={form.commitHash} onChange={e => set("commitHash", e.target.value)} placeholder="abc1234" data-testid="input-commit-hash" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch">Branch</Label>
              <Input id="branch" value={form.branch} onChange={e => set("branch", e.target.value)} data-testid="input-branch" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitMessage">Commit Message</Label>
            <Input id="commitMessage" value={form.commitMessage} onChange={e => set("commitMessage", e.target.value)} placeholder="Fix feature visibility save error" data-testid="input-commit-message" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitUrl">Commit URL</Label>
            <Input id="commitUrl" value={form.commitUrl} onChange={e => set("commitUrl", e.target.value)} placeholder="https://github.com/..." data-testid="input-commit-url" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="changeDescription">Change Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="changeDescription"
              value={form.changeDescription}
              onChange={e => set("changeDescription", e.target.value)}
              placeholder="What was changed and why..."
              rows={3}
              required
              data-testid="textarea-change-description"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Change Type <span className="text-destructive">*</span></Label>
              <Select value={form.changeType} onValueChange={v => set("changeType", v)}>
                <SelectTrigger data-testid="select-change-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="bugfix">Bug Fix</SelectItem>
                  <SelectItem value="hotfix">Hotfix</SelectItem>
                  <SelectItem value="refactor">Refactor</SelectItem>
                  <SelectItem value="config">Config</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target <span className="text-destructive">*</span></Label>
              <Select value={form.deploymentTarget} onValueChange={v => set("deploymentTarget", v)}>
                <SelectTrigger data-testid="select-deployment-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="replit">Replit</SelectItem>
                  <SelectItem value="vercel">Vercel</SelectItem>
                  <SelectItem value="render">Render</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={v => set("environment", v)}>
                <SelectTrigger data-testid="select-environment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="deploymentUrl">Deployment URL</Label>
              <Input id="deploymentUrl" value={form.deploymentUrl} onChange={e => set("deploymentUrl", e.target.value)} placeholder="https://..." data-testid="input-deployment-url" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requestedByName">Requested By</Label>
              <Input id="requestedByName" value={form.requestedByName} onChange={e => set("requestedByName", e.target.value)} placeholder="Ryan Rodenbeck" data-testid="input-requested-by" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Request Source</Label>
              <Select value={form.requestSource} onValueChange={v => set("requestSource", v)}>
                <SelectTrigger data-testid="select-request-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="github">GitHub Issue</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requestReference">Reference (Slack link, Issue #)</Label>
              <Input id="requestReference" value={form.requestReference} onChange={e => set("requestReference", e.target.value)} placeholder="https://slack.com/... or #123" data-testid="input-request-reference" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes..." rows={2} data-testid="textarea-notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !form.changeDescription} data-testid="button-submit-deployment">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Deployment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
