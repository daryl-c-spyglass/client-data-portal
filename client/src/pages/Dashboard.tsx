import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, FileText, TrendingUp, Clock, AlertCircle, RefreshCw, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Cma } from "@shared/schema";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ListingsByMonth {
  month: string;
  active: number;
  closed: number;
}

interface PriceDistribution {
  range: string;
  count: number;
}

interface CmasByMonth {
  month: string;
  count: number;
}

interface DashboardStats {
  totalActiveProperties: number;
  totalClosedProperties: number;
  totalProperties: number;
  activeCmas: number;
  sellerUpdates: number;
  systemStatus: string;
  repliersConfigured: boolean;
  mlsGridConfigured: boolean;
}

export default function Dashboard() {
  const { toast } = useToast();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats/dashboard'],
  });

  const { data: cmas = [], isLoading: cmasLoading } = useQuery<Cma[]>({
    queryKey: ['/api/cmas'],
  });

  const { data: listingsByMonth = [], isLoading: listingsLoading } = useQuery<ListingsByMonth[]>({
    queryKey: ['/api/stats/listings-by-month'],
  });

  const { data: priceDistribution = [], isLoading: priceLoading } = useQuery<PriceDistribution[]>({
    queryKey: ['/api/stats/price-distribution'],
  });

  const { data: cmasByMonth = [], isLoading: cmasChartLoading } = useQuery<CmasByMonth[]>({
    queryKey: ['/api/stats/cmas-by-month'],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/sync', 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "MLS data sync has been triggered. This may take a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to start MLS data sync",
        variant: "destructive",
      });
    },
  });

  const isLoading = statsLoading || cmasLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your Spyglass Realty agent platform</p>
      </div>

      {stats && !stats.mlsGridConfigured && !stats.repliersConfigured && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  API Not Configured
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  To start importing property data, please configure your API credentials in the environment variables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Home className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-properties">
                  {stats?.totalProperties?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalActiveProperties?.toLocaleString() || 0} active, {stats?.totalClosedProperties?.toLocaleString() || 0} closed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active CMAs</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-active-cmas">
                  {stats?.activeCmas || 0}
                </div>
                <p className="text-xs text-muted-foreground">Total created</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seller Updates</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-saved-searches">
                  {stats?.sellerUpdates || 0}
                </div>
                <p className="text-xs text-muted-foreground">Monitoring market</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-system-status">
              {stats?.systemStatus || 'Loading...'}
            </div>
            <p className="text-xs text-muted-foreground">Platform status</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/properties">
            <Button className="w-full" data-testid="button-search-properties">
              <Home className="w-4 h-4 mr-2" />
              Search Properties
            </Button>
          </Link>
          <Link href="/cmas/new">
            <Button className="w-full" variant="outline" data-testid="button-create-cma">
              <FileText className="w-4 h-4 mr-2" />
              Create CMA
            </Button>
          </Link>
          <Button 
            className="w-full" 
            variant="outline" 
            data-testid="button-sync-data"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync MLS Data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent CMAs</CardTitle>
        </CardHeader>
        <CardContent>
          {cmasLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : cmas.length > 0 ? (
            <div className="space-y-4">
              {cmas.slice(0, 5).map((cma) => (
                <Link key={cma.id} href={`/cmas/${cma.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-md hover-elevate active-elevate-2 cursor-pointer">
                    <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{cma.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {cma.comparablePropertyIds.length} properties • Created {new Date(cma.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No CMAs yet. Create your first comparative market analysis.</p>
              <Link href="/cmas/new">
                <Button className="mt-4" variant="outline">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Insights Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Market Insights</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Market Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Market Activity (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {listingsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : listingsByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={listingsByMonth.map(item => ({
                    ...item,
                    monthLabel: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="monthLabel" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="active" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="New Listings"
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="closed" 
                      stroke="hsl(142, 76%, 36%)" 
                      strokeWidth={2}
                      name="Closed Sales"
                      dot={{ fill: 'hsl(142, 76%, 36%)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price Distribution (Active Listings)</CardTitle>
            </CardHeader>
            <CardContent>
              {priceLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : priceDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={priceDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="range" 
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [value.toLocaleString(), 'Properties']}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="Properties"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* CMA Activity Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">CMA Activity (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {cmasChartLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : cmasByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={cmasByMonth.map(item => ({
                    ...item,
                    monthLabel: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="monthLabel" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [value, 'CMAs Created']}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="CMAs Created"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No CMA data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
