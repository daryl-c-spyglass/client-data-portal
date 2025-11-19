import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, FileText, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import type { Property, Cma } from "@shared/schema";

export default function Dashboard() {
  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const { data: cmas = [], isLoading: cmasLoading } = useQuery<Cma[]>({
    queryKey: ['/api/cmas'],
  });

  const { data: healthCheck } = useQuery<{ mlsGridConfigured: boolean }>({
    queryKey: ['/api/health'],
  });

  const isLoading = propertiesLoading || cmasLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your MLS Grid IDX platform</p>
      </div>

      {/* MLS Grid Status Alert */}
      {healthCheck && !healthCheck.mlsGridConfigured && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  MLS Grid API Not Configured
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  To start importing property data from MLS Grid, please configure your API credentials in the environment variables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
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
                  {properties.length}
                </div>
                <p className="text-xs text-muted-foreground">Available in system</p>
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
                  {cmas.length}
                </div>
                <p className="text-xs text-muted-foreground">Total created</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved Searches</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-saved-searches">0</div>
            <p className="text-xs text-muted-foreground">Monitoring market</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthCheck?.mlsGridConfigured ? 'Ready' : 'Setup'}
            </div>
            <p className="text-xs text-muted-foreground">Platform status</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
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
          <Button className="w-full" variant="outline" data-testid="button-sync-data">
            <TrendingUp className="w-4 h-4 mr-2" />
            Sync MLS Data
          </Button>
        </CardContent>
      </Card>

      {/* Recent CMAs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent CMAs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
    </div>
  );
}
