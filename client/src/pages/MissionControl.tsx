import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Home, Users, AlertCircle, RefreshCw, FlaskConical } from "lucide-react";
import { format, subDays } from "date-fns";

interface ProductionData {
  buyer: {
    active: { count: number; volume: number };
    underContract: { count: number; volume: number };
    closed: { count: number; volume: number };
  };
  seller: {
    active: { count: number; volume: number };
    underContract: { count: number; volume: number };
    closed: { count: number; volume: number };
  };
  totals: {
    active: { count: number; volume: number };
    underContract: { count: number; volume: number };
    closed: { count: number; volume: number };
  };
  transactions: any[];
  dataSource: string;
  fetchedAt: string;
}

function formatVolume(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function ProductionCard({ title, count, volume, icon: Icon, variant = "default" }: { 
  title: string; 
  count: number; 
  volume: number; 
  icon: any;
  variant?: "default" | "success" | "warning";
}) {
  const bgColors = {
    default: "bg-card",
    success: "bg-green-50 dark:bg-green-900/20",
    warning: "bg-amber-50 dark:bg-amber-900/20",
  };
  
  return (
    <Card className={bgColors[variant]}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count}</div>
        <p className="text-xs text-muted-foreground">
          {formatVolume(volume)} total volume
        </p>
      </CardContent>
    </Card>
  );
}

function SideBreakdown({ title, data }: { 
  title: string; 
  data: { active: { count: number; volume: number }; underContract: { count: number; volume: number }; closed: { count: number; volume: number } };
}) {
  const totalCount = data.active.count + data.underContract.count + data.closed.count;
  const totalVolume = data.active.volume + data.underContract.volume + data.closed.volume;
  
  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title} Side</CardTitle>
          <CardDescription>No transactions found</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {title === "Buyer" ? <Users className="h-5 w-5" /> : <Home className="h-5 w-5" />}
          {title} Side
        </CardTitle>
        <CardDescription>
          {totalCount} transactions • {formatVolume(totalVolume)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.active.count > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Active</Badge>
              <span className="text-sm">{data.active.count} listings</span>
            </div>
            <span className="font-medium">{formatVolume(data.active.volume)}</span>
          </div>
        )}
        {data.underContract.count > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Under Contract</Badge>
              <span className="text-sm">{data.underContract.count} pending</span>
            </div>
            <span className="font-medium">{formatVolume(data.underContract.volume)}</span>
          </div>
        )}
        {data.closed.count > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Closed</Badge>
              <span className="text-sm">{data.closed.count} closed</span>
            </div>
            <span className="font-medium">{formatVolume(data.closed.volume)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MissionControl() {
  const [agentId, setAgentId] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [emphasis, setEmphasis] = useState<"volume" | "count">("volume");
  const [useMockData, setUseMockData] = useState(false);
  
  const startDate = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
  const endDate = format(new Date(), "yyyy-MM-dd");
  
  const { data: statusData, isLoading: statusLoading } = useQuery<{ configured: boolean; status: string; message: string }>({
    queryKey: ["/api/rezen/status"],
  });
  
  // Build the API URL with query params - mock mode defaults to sample agent ID
  const effectiveAgentId = useMockData ? (agentId || 'agent_ryan_001') : agentId;
  const apiPath = useMockData ? '/api/rezen/mock/production' : '/api/rezen/production';
  
  const { data: production, isLoading, error, refetch } = useQuery<ProductionData>({
    queryKey: [apiPath, effectiveAgentId, startDate, endDate],
    queryFn: async () => {
      // Safety check: never request live endpoint without an agentId
      if (!useMockData && !effectiveAgentId) {
        throw new Error('Agent ID is required for live ReZen data');
      }
      const url = `${apiPath}?agentId=${encodeURIComponent(effectiveAgentId)}&startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
    enabled: useMockData || (!!agentId && statusData?.configured === true),
  });
  
  const isConfigured = statusData?.configured === true;
  const isStatusChecking = statusLoading || statusData === undefined;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Mission Control</h1>
          <p className="text-muted-foreground">Agent production volume reporting from ReZen</p>
        </div>
        {production && (
          <Badge variant="outline" className="text-xs">
            Data from: {production.dataSource}
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
              <p className="font-medium text-amber-800 dark:text-amber-200">ReZen API Not Configured</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {statusData?.message || "Please configure REZEN_API_KEY to enable production reporting."}
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
              <Label htmlFor="agentId">Agent ID (Yenta ID)</Label>
              <Input
                id="agentId"
                placeholder="Enter agent Yenta ID"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                data-testid="input-agent-id"
              />
            </div>
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 6 months</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Emphasis</Label>
              <Select value={emphasis} onValueChange={(v) => setEmphasis(v as "volume" | "count")}>
                <SelectTrigger data-testid="select-emphasis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volume">Emphasize Volume</SelectItem>
                  <SelectItem value="count">Emphasize Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => refetch()} 
                disabled={!useMockData && (!agentId || !isConfigured)}
                className="w-full"
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="mock-toggle" className="text-sm">Use Mock Data (Testing)</Label>
            </div>
            <Switch 
              id="mock-toggle"
              checked={useMockData}
              onCheckedChange={setUseMockData}
              data-testid="switch-mock-data"
            />
          </div>
          {useMockData && (
            <p className="text-xs text-muted-foreground mt-2">
              Using sample data for testing. Agent ID will default to "agent_ryan_001" if empty.
            </p>
          )}
        </CardContent>
      </Card>
      
      {!useMockData && !agentId && isConfigured && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter an Agent ID to view production data</p>
          </CardContent>
        </Card>
      )}
      
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
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
              <p>Failed to load production data. Please check the agent ID and try again.</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {production && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ProductionCard
              title="Active Listings"
              count={production.totals.active.count}
              volume={production.totals.active.volume}
              icon={Home}
              variant="default"
            />
            <ProductionCard
              title="Under Contract"
              count={production.totals.underContract.count}
              volume={production.totals.underContract.volume}
              icon={DollarSign}
              variant="warning"
            />
            <ProductionCard
              title="Closed"
              count={production.totals.closed.count}
              volume={production.totals.closed.volume}
              icon={TrendingUp}
              variant="success"
            />
          </div>
          
          <Tabs defaultValue="breakdown">
            <TabsList>
              <TabsTrigger value="breakdown" data-testid="tab-breakdown">Buyer/Seller Breakdown</TabsTrigger>
              <TabsTrigger value="transactions" data-testid="tab-transactions">Transaction List</TabsTrigger>
            </TabsList>
            
            <TabsContent value="breakdown" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SideBreakdown title="Buyer" data={production.buyer} />
                <SideBreakdown title="Seller" data={production.seller} />
              </div>
            </TabsContent>
            
            <TabsContent value="transactions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>
                    {production.transactions.length} transactions found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {production.transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No transactions found for this period
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {production.transactions.slice(0, 20).map((tx, idx) => (
                        <div 
                          key={tx.id || idx} 
                          className="flex items-center justify-between p-3 rounded-lg border"
                          data-testid={`row-transaction-${idx}`}
                        >
                          <div>
                            <p className="font-medium">{tx.address || "Unknown Address"}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {tx.side === "buyer" ? "Buyer" : tx.side === "seller" ? "Seller" : "Unknown"}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={
                                  tx.status === "closed" ? "bg-green-100 text-green-800" :
                                  tx.status === "under_contract" ? "bg-amber-100 text-amber-800" :
                                  "bg-blue-100 text-blue-800"
                                }
                              >
                                {tx.status === "closed" ? "Closed" : 
                                 tx.status === "under_contract" ? "Under Contract" : 
                                 tx.status === "active" ? "Active" : tx.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatVolume(tx.volume)}</p>
                            {tx.closingDate && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(tx.closingDate), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
