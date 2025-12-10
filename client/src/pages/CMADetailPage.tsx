import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Share2, Link as LinkIcon, Copy, Check, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { CMAReport } from "@/components/CMAReport";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Cma, Property, PropertyStatistics, TimelineDataPoint } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ShareResponse {
  shareToken: string;
  shareUrl: string;
  expiresAt: string;
}

export default function CMADetailPage() {
  const [, params] = useRoute("/cmas/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: cma, isLoading: cmaLoading, refetch: refetchCma } = useQuery<Cma>({
    queryKey: ['/api/cmas', id],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}`);
      if (!response.ok) throw new Error('Failed to fetch CMA');
      return response.json();
    },
  });

  const { data: statistics, isLoading: statsLoading } = useQuery<PropertyStatistics>({
    queryKey: ['/api/cmas', id, 'statistics'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/statistics`);
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    },
  });

  const { data: timelineData = [], isLoading: timelineLoading } = useQuery<TimelineDataPoint[]>({
    queryKey: ['/api/cmas', id, 'timeline'],
    enabled: !!id && !!cma,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${id}/timeline`);
      if (!response.ok) throw new Error('Failed to fetch timeline');
      return response.json();
    },
  });


  const shareMutation = useMutation<ShareResponse>({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to generate share link');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      toast({
        title: "Share link generated",
        description: "Your CMA is now shareable via the link.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate share link.",
        variant: "destructive",
      });
    },
  });

  const unshareMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${id}/share`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove share link');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      setShareDialogOpen(false);
      toast({
        title: "Share link removed",
        description: "This CMA is no longer publicly accessible.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove share link.",
        variant: "destructive",
      });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await fetch(`/api/cmas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      });
      if (!response.ok) throw new Error('Failed to update notes');
      return response.json();
    },
    onSuccess: () => {
      refetchCma();
      setNotesDialogOpen(false);
      toast({
        title: "Notes saved",
        description: "Your notes have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notes.",
        variant: "destructive",
      });
    },
  });

  const properties = cma ? ((cma as any).propertiesData || []) : [];

  // Sync notes state when CMA loads
  const handleOpenNotesDialog = () => {
    setNotes(cma?.notes || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  const handleSave = () => {
    toast({
      title: "CMA Saved",
      description: "Your CMA has been saved successfully.",
    });
  };

  const handleModifySearch = () => {
    // Navigate to CMA builder with current CMA data pre-loaded
    setLocation(`/cmas/new?from=${id}`);
  };

  const handleModifyStats = () => {
    toast({
      title: "Modify Stats",
      description: "Statistics are automatically calculated from the selected properties. To change stats, modify the comparable properties in a new CMA.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const isLoading = cmaLoading || statsLoading || timelineLoading;

  const getShareUrl = () => {
    if (!cma?.publicLink) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/cma/${cma.publicLink}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied",
      description: "Share link copied to clipboard.",
    });
  };

  const mockStatistics: PropertyStatistics = {
    price: {
      range: { min: 371000, max: 710000 },
      average: 508577,
      median: 519500,
    },
    pricePerSqFt: {
      range: { min: 268.23, max: 503.06 },
      average: 406.53,
      median: 406.7,
    },
    daysOnMarket: {
      range: { min: 2, max: 139 },
      average: 37,
      median: 25,
    },
    livingArea: {
      range: { min: 1045, max: 1474 },
      average: 1263,
      median: 1296,
    },
    lotSize: {
      range: { min: 3816, max: 11609 },
      average: 8923,
      median: 8494,
    },
    acres: {
      range: { min: 0.09, max: 0.27 },
      average: 0.2,
      median: 0.2,
    },
    bedrooms: {
      range: { min: 3, max: 4 },
      average: 3,
      median: 3,
    },
    bathrooms: {
      range: { min: 1, max: 2 },
      average: 2,
      median: 2,
    },
    yearBuilt: {
      range: { min: 1953, max: 2018 },
      average: 1964,
      median: 1959,
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!cma) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">CMA not found</h2>
        <Link href="/cmas">
          <Button variant="outline">Back to CMAs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/cmas">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cmas">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to CMAs
            </Button>
          </Link>
          <h1 className="text-3xl font-bold" data-testid="text-cma-title">{cma.name}</h1>
          {cma.publicLink && (
            <Badge variant="secondary" className="mt-2">
              <LinkIcon className="w-3 h-3 mr-1" />
              Shared
            </Badge>
          )}
        </div>

        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-share-cma">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share CMA</DialogTitle>
              <DialogDescription>
                Generate a public link to share this CMA with clients.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {cma.publicLink ? (
                <>
                  <div className="space-y-2">
                    <Label>Share Link</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={getShareUrl()} 
                        readOnly 
                        data-testid="input-share-link"
                      />
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={handleCopyLink}
                        data-testid="button-copy-link"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {cma.expiresAt && (
                    <p className="text-sm text-muted-foreground">
                      Link expires: {new Date(cma.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex justify-between pt-4">
                    <Button
                      variant="destructive"
                      onClick={() => unshareMutation.mutate()}
                      disabled={unshareMutation.isPending}
                      data-testid="button-remove-share"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Link
                    </Button>
                    <Button onClick={() => setShareDialogOpen(false)}>
                      Done
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    Generate a shareable link for this CMA. The link will be valid for 30 days.
                  </p>
                  <Button 
                    onClick={() => shareMutation.mutate()}
                    disabled={shareMutation.isPending}
                    data-testid="button-generate-link"
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    {shareMutation.isPending ? 'Generating...' : 'Generate Share Link'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <CMAReport
        properties={properties}
        statistics={statistics || mockStatistics}
        timelineData={timelineData}
        isPreview={true}
        expiresAt={cma.expiresAt ? new Date(cma.expiresAt) : new Date(Date.now() + 30 * 60 * 1000)}
        onSave={handleSave}
        onPublicLink={() => setShareDialogOpen(true)}
        onModifySearch={handleModifySearch}
        onModifyStats={handleModifyStats}
        onAddNotes={handleOpenNotesDialog}
        onPrint={handlePrint}
      />

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CMA Notes</DialogTitle>
            <DialogDescription>
              Add notes or comments to this CMA report.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter your notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="mt-2"
              data-testid="textarea-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveNotes}
              disabled={updateNotesMutation.isPending}
              data-testid="button-save-notes"
            >
              {updateNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
