import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Mail, Pause, Play, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SellerUpdate } from "@shared/schema";

export default function SellerUpdates() {
  const { data: updates, isLoading } = useQuery<SellerUpdate[]>({
    queryKey: ['/api/seller-updates'],
  });

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      'bi-weekly': 'Bi-Weekly',
      monthly: 'Monthly',
    };
    return labels[frequency] || frequency;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Seller Updates</h1>
          <p className="text-muted-foreground mt-1">
            Automated market update emails for sellers
          </p>
        </div>
        <Link href="/seller-updates/new">
          <Button data-testid="button-create-seller-update">
            <Plus className="w-4 h-4 mr-2" />
            Create Update
          </Button>
        </Link>
      </div>

      {/* Updates List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : updates && updates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {updates.map((update) => (
            <Card key={update.id} data-testid={`card-seller-update-${update.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{update.name}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {update.email}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant={update.isActive ? "default" : "secondary"}
                    data-testid={`badge-status-${update.id}`}
                  >
                    {update.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Zip Code:</span>
                    <span className="font-medium">{update.postalCode}</span>
                  </div>
                  {update.elementarySchool && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">School:</span>
                      <span className="font-medium">{update.elementarySchool}</span>
                    </div>
                  )}
                  {update.propertySubType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium">{update.propertySubType}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frequency:</span>
                    <span className="font-medium">{getFrequencyLabel(update.emailFrequency)}</span>
                  </div>
                  {update.lastSentAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Sent:</span>
                      <span className="font-medium">
                        {new Date(update.lastSentAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Link href={`/seller-updates/${update.id}/preview`}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      data-testid={`button-preview-${update.id}`}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`button-toggle-${update.id}`}
                  >
                    {update.isActive ? (
                      <>
                        <Pause className="w-3 h-3 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Resume
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`button-delete-${update.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No seller updates yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first automated market update to keep sellers informed about their area
            </p>
            <Link href="/seller-updates/new">
              <Button data-testid="button-create-first-update">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Update
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
