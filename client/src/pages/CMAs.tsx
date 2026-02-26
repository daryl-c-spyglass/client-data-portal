import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Plus, Calendar, ArrowUpDown, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Cma } from "@shared/schema";

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

export default function CMAs() {
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cmaToDelete, setCmaToDelete] = useState<Cma | null>(null);
  const { role, user } = usePermissions();
  const { toast } = useToast();

  const { data: cmas = [], isLoading } = useQuery<Cma[]>({
    queryKey: ['/api/cmas'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cmas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cmas'] });
      toast({ title: "CMA deleted successfully" });
      setDeleteDialogOpen(false);
      setCmaToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete CMA",
        variant: "destructive",
      });
    },
  });

  const canDeleteCma = (cma: Cma) => {
    if (role === 'developer' || role === 'super_admin') return true;
    return cma.userId === user?.id;
  };

  const sortedCmas = useMemo(() => {
    const sorted = [...cmas];

    switch (sortOption) {
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA;
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateA - dateB;
        });
      case 'az':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'za':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return sorted;
    }
  }, [cmas, sortOption]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-cmas-title">CMAs</h1>
          <p className="text-muted-foreground">
            {cmas.length > 0
              ? `${cmas.length} Comparative Market Analyses`
              : 'Comparative Market Analyses'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {cmas.length > 0 && (
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <Select value={sortOption} onValueChange={(val) => setSortOption(val as SortOption)}>
                <SelectTrigger className="w-[180px]" data-testid="select-cma-sort">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest" data-testid="sort-newest">Newest to Oldest</SelectItem>
                  <SelectItem value="oldest" data-testid="sort-oldest">Oldest to Newest</SelectItem>
                  <SelectItem value="az" data-testid="sort-az">Name A-Z</SelectItem>
                  <SelectItem value="za" data-testid="sort-za">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Link href="/cmas/new">
            <Button data-testid="button-create-new-cma">
              <Plus className="w-4 h-4 mr-2" />
              Create New CMA
            </Button>
          </Link>
        </div>
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
      ) : sortedCmas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCmas.map((cma) => (
            <div key={cma.id} className="relative group">
              <Link href={`/cmas/${cma.id}`}>
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
                    {cma.updatedAt && new Date(cma.updatedAt).getTime() !== new Date(cma.createdAt).getTime() && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Modified {new Date(cma.updatedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {cma.comparablePropertyIds.length} comparable properties
                    </p>
                  </CardContent>
                </Card>
              </Link>
              {canDeleteCma(cma) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 invisible group-hover:visible text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setCmaToDelete(cma);
                    setDeleteDialogOpen(true);
                  }}
                  data-testid={`button-delete-cma-${cma.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-dialog-title">Delete CMA?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{cmaToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => cmaToDelete && deleteMutation.mutate(cmaToDelete.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
