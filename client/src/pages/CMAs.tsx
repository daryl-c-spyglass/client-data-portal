import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus, Calendar } from "lucide-react";
import { Link } from "wouter";
import type { Cma } from "@shared/schema";

export default function CMAs() {
  const { data: cmas = [], isLoading } = useQuery<Cma[]>({
    queryKey: ['/api/cmas'],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-cmas-title">CMAs</h1>
          <p className="text-muted-foreground">
            {cmas.length > 0 
              ? `${cmas.length} Comparative Market Analyses`
              : 'Comparative Market Analyses'
            }
          </p>
        </div>
        <Link href="/cmas/new">
          <Button data-testid="button-create-new-cma">
            <Plus className="w-4 h-4 mr-2" />
            Create New CMA
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cmas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cmas.map((cma) => (
            <Link key={cma.id} href={`/cmas/${cma.id}`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-cma-${cma.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2">{cma.name}</span>
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Created {new Date(cma.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {cma.comparablePropertyIds.length} comparable properties
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No CMAs yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first comparative market analysis to get started
              </p>
              <Link href="/cmas/new">
                <Button data-testid="button-get-started-cma">
                  <Plus className="w-4 h-4 mr-2" />
                  Get Started
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
