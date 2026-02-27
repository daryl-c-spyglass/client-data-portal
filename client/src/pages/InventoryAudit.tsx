import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  Globe,
  AlertCircle,
  Search
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface InventoryAudit {
  source: string;
  generatedAt: string;
  totals: {
    total: number;
    byStatus: Record<string, number>;
  };
  subtypes: Array<{ name: string; count: number }>;
  statusBySubtype: Record<string, Record<string, number>>;
  unknowns: {
    missingStatus: number;
    missingSubtype: number;
    samples: Array<{ id: string; status: string | null; subtype: string | null }>;
  };
  diagnostics: {
    repliersConfigured: boolean;
    databaseConnected: boolean;
    cacheAge: number | null;
    errors: string[];
    warnings: string[];
  };
}

export default function InventoryAudit() {
  const [subtypeSearch, setSubtypeSearch] = useState("");
  const [showCrossTab, setShowCrossTab] = useState(false);
  const [showUnknowns, setShowUnknowns] = useState(false);

  const { data: audit, isLoading, isRefetching, refetch } = useQuery<InventoryAudit>({
    queryKey: ["/api/inventory/audit"],
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/audit"] });
    refetch();
  };

  const filteredSubtypes = audit?.subtypes?.filter(s => 
    s.name.toLowerCase().includes(subtypeSearch.toLowerCase())
  ) ?? [];

  const formatNumber = (num: number) => num.toLocaleString();

  const formatCacheAge = (ms: number | null) => {
    if (ms === null) return "No cache";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="title-inventory-audit">Inventory Audit</h1>
            <p className="text-muted-foreground text-sm">
              Source: {audit?.source} | Generated: {audit?.generatedAt ? new Date(audit.generatedAt).toLocaleString() : 'N/A'}
            </p>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={isRefetching}
            variant="outline"
            data-testid="button-refresh-audit"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {(audit?.diagnostics?.warnings?.length ?? 0) > 0 && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-5 w-5" />
                Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {audit?.diagnostics?.warnings?.map((warning, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                    {warning}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {(audit?.diagnostics?.errors?.length ?? 0) > 0 && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-5 w-5" />
                Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {audit?.diagnostics?.errors?.map((error, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
                    {error}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-total-count">
                {formatNumber(audit?.totals?.total || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Repliers API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {audit?.diagnostics?.repliersConfigured ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400 font-medium">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400 font-medium">Not Configured</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">MLS Cache</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {audit?.diagnostics?.databaseConnected ? (
                  <>
                    <Globe className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400 font-medium">Disconnected</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cache Age</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">
                {formatCacheAge(audit?.diagnostics?.cacheAge ?? null)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Counts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <span className="font-medium">Active</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-active-count">
                  {formatNumber(audit?.totals?.byStatus?.Active || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span className="font-medium">Active Under Contract</span>
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-uc-count">
                  {formatNumber(audit?.totals?.byStatus?.['Active Under Contract'] || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="font-medium">Closed</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-closed-count">
                  {formatNumber(audit?.totals?.byStatus?.Closed || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg">Property Subtypes</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subtypes..."
                value={subtypeSearch}
                onChange={(e) => setSubtypeSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-subtype"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredSubtypes.map((subtype, i) => (
                <div 
                  key={subtype.name} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`row-subtype-${i}`}
                >
                  <span className="font-medium">{subtype.name}</span>
                  <Badge variant="secondary">{formatNumber(subtype.count)}</Badge>
                </div>
              ))}
              {filteredSubtypes.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No subtypes found</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Collapsible open={showCrossTab} onOpenChange={setShowCrossTab}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover-elevate">
                <CardTitle className="text-lg flex items-center justify-between">
                  Status x Subtype Cross-Tab
                  {showCrossTab ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Subtype</th>
                        <th className="text-right p-2 font-medium text-green-600">Active</th>
                        <th className="text-right p-2 font-medium text-yellow-600">Active Under Contract</th>
                        <th className="text-right p-2 font-medium text-blue-600">Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit?.subtypes?.map((subtype) => (
                        <tr key={subtype.name} className="border-b last:border-0">
                          <td className="p-2">{subtype.name}</td>
                          <td className="text-right p-2">
                            {formatNumber(audit?.statusBySubtype?.['Active']?.[subtype.name] || 0)}
                          </td>
                          <td className="text-right p-2">
                            {formatNumber(audit?.statusBySubtype?.['Active Under Contract']?.[subtype.name] || 0)}
                          </td>
                          <td className="text-right p-2">
                            {formatNumber(audit?.statusBySubtype?.['Closed']?.[subtype.name] || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={showUnknowns} onOpenChange={setShowUnknowns}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover-elevate">
                <CardTitle className="text-lg flex items-center justify-between">
                  Unknown/Missing Data
                  <div className="flex items-center gap-2">
                    {((audit?.unknowns?.missingStatus || 0) + (audit?.unknowns?.missingSubtype || 0)) > 0 && (
                      <Badge variant="destructive">
                        {(audit?.unknowns?.missingStatus || 0) + (audit?.unknowns?.missingSubtype || 0)} issues
                      </Badge>
                    )}
                    {showUnknowns ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Missing Status</p>
                    <p className="text-xl font-bold">{formatNumber(audit?.unknowns?.missingStatus || 0)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Missing Subtype</p>
                    <p className="text-xl font-bold">{formatNumber(audit?.unknowns?.missingSubtype || 0)}</p>
                  </div>
                </div>

                {(audit?.unknowns?.samples?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Sample Records</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">ID</th>
                            <th className="text-left p-2">Status</th>
                            <th className="text-left p-2">Subtype</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audit?.unknowns?.samples?.map((sample, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2 font-mono text-xs">{sample.id}</td>
                              <td className="p-2">
                                {sample.status || <span className="text-red-500">null</span>}
                              </td>
                              <td className="p-2">
                                {sample.subtype || <span className="text-red-500">null</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </ScrollArea>
  );
}
