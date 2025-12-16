import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings as SettingsIcon, 
  User, 
  Database, 
  Palette, 
  Bell, 
  Code2, 
  Shield, 
  Eye, 
  Users,
  RefreshCw,
  Copy,
  Check,
  ExternalLink
} from "lucide-react";

const leadGateSchema = z.object({
  enabled: z.boolean(),
  freeViewsAllowed: z.coerce.number().min(1).max(50),
  countPropertyDetails: z.boolean(),
  countListViews: z.boolean(),
});

type LeadGateFormData = z.infer<typeof leadGateSchema>;

interface LeadGateSettings {
  id: string;
  enabled: boolean;
  freeViewsAllowed: number;
  countPropertyDetails: boolean;
  countListViews: boolean;
  updatedAt: string;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [copied, setCopied] = useState(false);
  const [embedWidth, setEmbedWidth] = useState("600");
  const [embedHeight, setEmbedHeight] = useState("800");

  const { data: leadGateSettings, isLoading: isLoadingLeadGate } = useQuery<LeadGateSettings>({
    queryKey: ["/api/lead-gate/settings"],
    enabled: activeTab === "lead-gate",
  });

  const leadGateForm = useForm<LeadGateFormData>({
    resolver: zodResolver(leadGateSchema),
    defaultValues: {
      enabled: false,
      freeViewsAllowed: 3,
      countPropertyDetails: true,
      countListViews: false,
    },
  });

  const updateLeadGateMutation = useMutation({
    mutationFn: async (data: LeadGateFormData) => {
      const response = await apiRequest("PUT", "/api/lead-gate/settings", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-gate/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lead-gate/status"] });
      toast({
        title: "Settings saved",
        description: "Lead gate settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger sync");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/summary"] });
      toast({
        title: "Sync initiated",
        description: data.message || "Data synchronization has been triggered.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testMlsGridMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/mlsgrid/test", "GET");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "MLS Grid connection test failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection successful" : "Connection issue",
        description: data.message || "MLS Grid API is responding.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (leadGateSettings) {
      leadGateForm.reset({
        enabled: leadGateSettings.enabled,
        freeViewsAllowed: leadGateSettings.freeViewsAllowed,
        countPropertyDetails: leadGateSettings.countPropertyDetails,
        countListViews: leadGateSettings.countListViews,
      });
    }
  }, [leadGateSettings, leadGateForm]);

  const onLeadGateSubmit = (data: LeadGateFormData) => {
    updateLeadGateMutation.mutate(data);
  };

  const baseUrl = useMemo(() => typeof window !== 'undefined' ? window.location.origin : '', []);
  const embedUrl = `${baseUrl}/embed/seller-update`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${embedWidth}"
  height="${embedHeight}"
  frameborder="0"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);"
  title="Quick Seller Update Widget"
></iframe>`;

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Embed code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy embed code",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account, preferences, and integrations
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2" data-testid="tab-profile">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2" data-testid="tab-data">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Data & Sync</span>
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2" data-testid="tab-display">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Display</span>
          </TabsTrigger>
          <TabsTrigger value="embed" className="flex items-center gap-2" data-testid="tab-embed">
            <Code2 className="w-4 h-4" />
            <span className="hidden sm:inline">Embed Code</span>
          </TabsTrigger>
          <TabsTrigger value="lead-gate" className="flex items-center gap-2" data-testid="tab-lead-gate">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Lead Gate</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your personal and business information displayed on reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input placeholder="John Smith" data-testid="input-name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input placeholder="john@example.com" type="email" data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input placeholder="(512) 555-0123" data-testid="input-phone" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">License Number</label>
                  <Input placeholder="TX-12345" data-testid="input-license" />
                </div>
              </div>
              <div className="pt-4">
                <Button data-testid="button-save-profile">Save Profile</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brokerage Information</CardTitle>
              <CardDescription>
                Your brokerage details for MLS compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brokerage Name</label>
                  <Input placeholder="Spyglass Realty" data-testid="input-brokerage" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brokerage Address</label>
                  <Input placeholder="123 Main St, Austin TX" data-testid="input-brokerage-address" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data & Sync Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Data Synchronization
              </CardTitle>
              <CardDescription>
                MLS Grid data sync status and controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Last Sync</p>
                  <p className="text-sm text-muted-foreground">Property data was last updated</p>
                </div>
                <Badge variant="secondary">Today at 6:00 AM</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Auto Sync</p>
                  <p className="text-sm text-muted-foreground">Automatically sync data daily</p>
                </div>
                <Switch defaultChecked data-testid="switch-auto-sync" />
              </div>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="button-manual-sync"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Syncing...' : 'Trigger Manual Sync'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>
                Connected MLS and data providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">MLS Grid API</p>
                    <p className="text-xs text-muted-foreground">Sold/Closed listings from Austin Board of REALTORS</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>Configured</Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => testMlsGridMutation.mutate()}
                    disabled={testMlsGridMutation.isPending}
                    data-testid="button-test-mlsgrid"
                  >
                    {testMlsGridMutation.isPending ? 'Testing...' : 'Test'}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Repliers API</p>
                    <p className="text-xs text-muted-foreground">Active/Under Contract listings with photos</p>
                  </div>
                </div>
                <Badge>Connected</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Preferences Tab */}
        <TabsContent value="display" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Display Preferences
              </CardTitle>
              <CardDescription>
                Customize how data is displayed across the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Price Format</p>
                  <p className="text-sm text-muted-foreground">How prices are displayed</p>
                </div>
                <Badge variant="secondary">$1,234,567</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Area Units</p>
                  <p className="text-sm text-muted-foreground">Square footage display</p>
                </div>
                <Badge variant="secondary">sq ft</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Date Format</p>
                  <p className="text-sm text-muted-foreground">How dates are displayed</p>
                </div>
                <Badge variant="secondary">MMM d, yyyy</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CMA Report Defaults</CardTitle>
              <CardDescription>
                Default settings for new CMA reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Include Agent Branding</p>
                  <p className="text-sm text-muted-foreground">Show your info on shared reports</p>
                </div>
                <Switch defaultChecked data-testid="switch-branding" />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Include Market Stats</p>
                  <p className="text-sm text-muted-foreground">Show market analysis by default</p>
                </div>
                <Switch defaultChecked data-testid="switch-market-stats" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embed Code Tab */}
        <TabsContent value="embed" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                Embed Code Generator
              </CardTitle>
              <CardDescription>
                Generate embed code for the Quick Seller Update widget to place on your website or CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Width (pixels)</label>
                  <Input
                    type="number"
                    value={embedWidth}
                    onChange={(e) => setEmbedWidth(e.target.value)}
                    min="300"
                    max="1200"
                    data-testid="input-embed-width"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Height (pixels)</label>
                  <Input
                    type="number"
                    value={embedHeight}
                    onChange={(e) => setEmbedHeight(e.target.value)}
                    min="600"
                    max="1200"
                    data-testid="input-embed-height"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Preview URL</label>
                <div className="flex gap-2">
                  <Input
                    value={embedUrl}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-embed-url"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(embedUrl, '_blank')}
                    data-testid="button-preview-embed"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {iframeCode}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={handleCopyEmbed}
                  data-testid="button-copy-embed"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>Copy the embed code above</li>
                <li>Paste it into your website's HTML where you want the widget to appear</li>
                <li>Adjust width and height if needed to fit your layout</li>
                <li>Save and publish your changes</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Gate Tab */}
        <TabsContent value="lead-gate" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card data-testid="card-lead-gate-status">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {leadGateSettings?.enabled ? "Active" : "Inactive"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lead gate is {leadGateSettings?.enabled ? "capturing leads" : "disabled"}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-lead-gate-views">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Free Views</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {leadGateSettings?.freeViewsAllowed || 3}
                </div>
                <p className="text-xs text-muted-foreground">
                  Properties before registration required
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-lead-gate-tracking">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {[
                    leadGateSettings?.countPropertyDetails && "Details",
                    leadGateSettings?.countListViews && "Lists",
                  ]
                    .filter(Boolean)
                    .join(" + ") || "None"}
                </div>
                <p className="text-xs text-muted-foreground">
                  What counts as a property view
                </p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-lead-gate-config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Lead Gate Configuration
              </CardTitle>
              <CardDescription>
                Configure how property viewing is gated for lead generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLeadGate ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <Form {...leadGateForm}>
                  <form onSubmit={leadGateForm.handleSubmit(onLeadGateSubmit)} className="space-y-6">
                    <FormField
                      control={leadGateForm.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Lead Gate</FormLabel>
                            <FormDescription>
                              When enabled, anonymous users must register after viewing a set number of properties
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-lead-gate-enabled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={leadGateForm.control}
                      name="freeViewsAllowed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Free Views Allowed</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={field.value}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  field.onChange(1);
                                } else {
                                  const num = Math.floor(Number(val));
                                  field.onChange(Math.max(1, Math.min(50, isNaN(num) ? 1 : num)));
                                }
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              className="w-32"
                              data-testid="input-lead-gate-views"
                            />
                          </FormControl>
                          <FormDescription>
                            Number of property views allowed before registration is required (1-50)
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormLabel className="text-base">What Counts as a View</FormLabel>
                      
                      <FormField
                        control={leadGateForm.control}
                        name="countPropertyDetails"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Property Detail Pages</FormLabel>
                              <FormDescription>
                                Count when a user views a full property listing page
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-count-details"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={leadGateForm.control}
                        name="countListViews"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Search Result List Views</FormLabel>
                              <FormDescription>
                                Count each time search results are loaded (more aggressive)
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-count-lists"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={updateLeadGateMutation.isPending}
                      data-testid="button-save-lead-gate"
                    >
                      {updateLeadGateMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How Lead Gate Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The lead gate is a proven strategy for capturing buyer leads while still providing 
                value to anonymous visitors:
              </p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Anonymous visitors can browse and view a limited number of properties</li>
                <li>After reaching the limit, they're prompted to register with their contact info</li>
                <li>Once registered, they have unlimited access to all listings</li>
                <li>You capture qualified leads who have demonstrated interest in properties</li>
              </ol>
              <p className="text-xs">
                Tip: A setting of 3-5 free views typically balances lead capture with user experience.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
