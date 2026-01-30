import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share2, Mail, Link as LinkIcon, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { SiFacebook, SiX, SiInstagram, SiTiktok } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import type { Cma, Property, PropertyStatistics } from "@shared/schema";

interface ShareResponse {
  shareToken: string;
  shareUrl: string;
}

interface CMAShareDropdownProps {
  cma: Cma;
  statistics: PropertyStatistics | null;
  onRefetch?: () => void;
}

export function CMAShareDropdown({ cma, statistics, onRefetch }: CMAShareDropdownProps) {
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailShareDialogOpen, setEmailShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailFallbackUrl, setEmailFallbackUrl] = useState<string | null>(null);
  
  // Email share form state
  const [emailForm, setEmailForm] = useState({
    yourName: '',
    yourEmail: '',
    friendName: '',
    friendEmail: '',
    comments: 'Check out this CMA report I created for you.',
  });

  // Generate share link mutation
  const shareMutation = useMutation<ShareResponse>({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${cma.id}/share`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to generate share link');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Share link generated",
        description: "Your CMA is now shareable via the link.",
      });
      onRefetch?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate share link.",
        variant: "destructive",
      });
    },
  });

  // Unshare mutation
  const unshareMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cmas/${cma.id}/share`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to remove share link');
    },
    onSuccess: () => {
      toast({
        title: "Share link removed",
        description: "This CMA is no longer publicly accessible.",
      });
      setShareDialogOpen(false);
      onRefetch?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove share link.",
        variant: "destructive",
      });
    },
  });

  // Email share mutation
  const emailShareMutation = useMutation({
    mutationFn: async (data: typeof emailForm) => {
      // First ensure we have a public link
      if (!cma.publicLink) {
        await shareMutation.mutateAsync();
      }
      // Then send the email
      const response = await fetch(`/api/cmas/${cma.id}/email-share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: data.yourName,
          senderEmail: data.yourEmail,
          recipientName: data.friendName,
          recipientEmail: data.friendEmail,
          message: data.comments,
        }),
      });
      if (!response.ok) throw new Error('Failed to send email');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        setEmailShareDialogOpen(false);
        toast({
          title: "CMA Shared",
          description: "Your CMA has been sent via email.",
        });
        setEmailFallbackUrl(null);
      } else {
        setEmailFallbackUrl(data.shareUrl);
        toast({
          title: "Email Not Sent",
          description: data.message,
          variant: "destructive",
        });
      }
      setEmailForm({
        yourName: '',
        yourEmail: '',
        friendName: '',
        friendEmail: '',
        comments: 'Check out this CMA report I created for you.',
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate client email text
  const generateClientEmail = () => {
    if (!cma || !statistics) return '';
    
    const propertiesData = (cma as any).propertiesData || [];
    const compCount = propertiesData.length;
    
    const subjectProperty = cma.subjectPropertyId 
      ? propertiesData.find((p: Property) => p.id === cma.subjectPropertyId)
      : null;
    
    const subjectAddress = subjectProperty?.unparsedAddress || cma.name || 'your property';
    const subdivision = (cma.searchCriteria as any)?.subdivisionName || 
                        (cma.searchCriteria as any)?.subdivision ||
                        'the area';
    
    const avgPrice = statistics.price?.average ? 
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(statistics.price.average) : 
      'N/A';
    const avgPricePerSqft = statistics.pricePerSqFt?.average ? 
      `$${Math.round(statistics.pricePerSqFt.average)}` : 
      'N/A';
    const avgDaysOnMarket = statistics.daysOnMarket?.average ? 
      Math.round(statistics.daysOnMarket.average) : 
      'N/A';
    
    return `Subject: Market Analysis for ${subjectAddress}

Hi,

I've prepared a comprehensive Comparative Market Analysis (CMA) for ${subjectAddress} in ${subdivision}.

Key Market Insights:
- ${compCount} comparable properties analyzed
- Average Price: ${avgPrice}
- Average Price/SqFt: ${avgPricePerSqft}
- Average Days on Market: ${avgDaysOnMarket}

This analysis provides a detailed look at recent market activity to help you make informed decisions about pricing and market timing.

I'd love to discuss these findings with you. Please let me know a good time to connect.

Best regards`;
  };

  // Copy email to clipboard
  const handleCopyClientEmail = async () => {
    const emailText = generateClientEmail();
    if (!emailText) {
      toast({
        title: "Unable to generate email",
        description: "CMA data is still loading.",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(emailText);
      toast({
        title: "Email copied to clipboard",
        description: "Paste into your email client to send.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get share URL
  const getShareUrl = () => {
    if (!cma.publicLink) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/cma/${cma.publicLink}`;
  };

  // Copy share link
  const handleCopyLink = async () => {
    const url = getShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied",
        description: url,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Copy live URL (generate if needed)
  const handleCopyLiveUrl = async () => {
    try {
      let shareUrl: string;
      if (cma.publicLink) {
        shareUrl = `${window.location.origin}/share/cma/${cma.publicLink}`;
      } else {
        const result = await shareMutation.mutateAsync();
        shareUrl = `${window.location.origin}/share/cma/${result.shareToken}`;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "URL copied to clipboard",
        description: shareUrl,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate or copy share URL",
        variant: "destructive",
      });
    }
  };

  // Handle email share submit
  const handleEmailShare = () => {
    if (!emailForm.yourName || !emailForm.yourEmail || !emailForm.friendName || !emailForm.friendEmail) {
      toast({
        title: "Required fields missing",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    emailShareMutation.mutate(emailForm);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="button-share-dropdown">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={handleCopyClientEmail}
            data-testid="menu-item-copy-email"
          >
            <Mail className="w-4 h-4 mr-2" />
            Copy Email
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleCopyLiveUrl}
            disabled={shareMutation.isPending}
            data-testid="menu-item-copy-url"
          >
            {shareMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LinkIcon className="w-4 h-4 mr-2" />
            )}
            Copy Live URL
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShareDialogOpen(true)}
            data-testid="menu-item-share-cma"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Share CMA
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setEmailShareDialogOpen(true)}
            data-testid="menu-item-email-share"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email to Client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
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
                
                {/* Social share buttons */}
                <div className="space-y-2">
                  <Label>Share on Social Media</Label>
                  <div className="flex gap-2">
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => {
                        const url = encodeURIComponent(getShareUrl());
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
                      }}
                      data-testid="button-share-facebook"
                    >
                      <SiFacebook className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => {
                        const url = encodeURIComponent(getShareUrl());
                        window.open(`https://twitter.com/intent/tweet?url=${url}&text=Check out this property analysis`, '_blank', 'width=600,height=400');
                      }}
                      data-testid="button-share-x"
                    >
                      <SiX className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(getShareUrl());
                        window.open('https://www.instagram.com/', '_blank');
                      }}
                      data-testid="button-share-instagram"
                    >
                      <SiInstagram className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(getShareUrl());
                        window.open('https://www.tiktok.com/', '_blank');
                      }}
                      data-testid="button-share-tiktok"
                    >
                      <SiTiktok className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button 
                    variant="destructive" 
                    onClick={() => unshareMutation.mutate()}
                    disabled={unshareMutation.isPending}
                    data-testid="button-remove-share"
                  >
                    Remove Share Link
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate a shareable link for this CMA. Links are permanent and can be manually revoked.
                </p>
                <Button 
                  onClick={() => shareMutation.mutate()}
                  disabled={shareMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-share"
                >
                  {shareMutation.isPending ? 'Generating...' : 'Generate Share Link'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Share Dialog */}
      <Dialog open={emailShareDialogOpen} onOpenChange={setEmailShareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share CMA via Email</DialogTitle>
            <DialogDescription>
              Send a link to this CMA report directly to your client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yourName">Your Name *</Label>
                <Input 
                  id="yourName"
                  value={emailForm.yourName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, yourName: e.target.value }))}
                  placeholder="Enter your name"
                  data-testid="input-your-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yourEmail">Your Email *</Label>
                <Input 
                  id="yourEmail"
                  type="email"
                  value={emailForm.yourEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, yourEmail: e.target.value }))}
                  placeholder="you@example.com"
                  data-testid="input-your-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="friendName">Client Name *</Label>
                <Input 
                  id="friendName"
                  value={emailForm.friendName}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, friendName: e.target.value }))}
                  placeholder="Client's name"
                  data-testid="input-friend-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="friendEmail">Client Email *</Label>
                <Input 
                  id="friendEmail"
                  type="email"
                  value={emailForm.friendEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, friendEmail: e.target.value }))}
                  placeholder="client@example.com"
                  data-testid="input-friend-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments">Personal Message</Label>
              <Textarea 
                id="comments"
                value={emailForm.comments}
                onChange={(e) => setEmailForm(prev => ({ ...prev, comments: e.target.value }))}
                placeholder="Add a personal note..."
                rows={3}
                data-testid="textarea-comments"
              />
            </div>
            
            {emailFallbackUrl && (
              <div className="p-3 bg-muted rounded-md space-y-2">
                <p className="text-sm text-muted-foreground">
                  Email service not configured. Share this link manually:
                </p>
                <div className="flex gap-2">
                  <Input 
                    value={emailFallbackUrl} 
                    readOnly 
                    data-testid="input-fallback-share-url"
                  />
                  <Button 
                    size="icon" 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(emailFallbackUrl);
                      toast({ title: "Link copied" });
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEmailShareDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEmailShare}
              disabled={emailShareMutation.isPending}
              data-testid="button-send-email-share"
            >
              {emailShareMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
