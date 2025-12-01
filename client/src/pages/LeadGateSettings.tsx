import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Shield, Eye, Users } from "lucide-react";
import { useEffect } from "react";

const settingsSchema = z.object({
  enabled: z.boolean(),
  freeViewsAllowed: z.number().min(1).max(50),
  countPropertyDetails: z.boolean(),
  countListViews: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface LeadGateSettings {
  id: string;
  enabled: boolean;
  freeViewsAllowed: number;
  countPropertyDetails: boolean;
  countListViews: boolean;
  updatedAt: string;
}

export default function LeadGateSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<LeadGateSettings>({
    queryKey: ["/api/lead-gate/settings"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      enabled: false,
      freeViewsAllowed: 3,
      countPropertyDetails: true,
      countListViews: false,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        enabled: settings.enabled,
        freeViewsAllowed: settings.freeViewsAllowed,
        countPropertyDetails: settings.countPropertyDetails,
        countListViews: settings.countListViews,
      });
    }
  }, [settings, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
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

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Lead Gate Settings</h1>
          <p className="text-muted-foreground">
            Configure how property viewing is gated for lead generation
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card data-testid="card-total-settings">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings?.enabled ? "Active" : "Inactive"}
            </div>
            <p className="text-xs text-muted-foreground">
              Lead gate is {settings?.enabled ? "capturing leads" : "disabled"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-free-views">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Free Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings?.freeViewsAllowed || 3}
            </div>
            <p className="text-xs text-muted-foreground">
              Properties before registration required
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-tracking">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[
                settings?.countPropertyDetails && "Details",
                settings?.countListViews && "Lists",
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

      <Card data-testid="card-settings-form">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Adjust lead gate behavior to optimize lead capture while maintaining a good user experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
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
                        data-testid="switch-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="freeViewsAllowed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Free Views Allowed</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                        className="w-32"
                        data-testid="input-free-views"
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
                  control={form.control}
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
                  control={form.control}
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
                disabled={updateMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card data-testid="card-info">
        <CardHeader>
          <CardTitle>How Lead Gate Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The lead gate is a proven strategy for capturing buyer leads while still providing 
            value to anonymous visitors. Here's how it works:
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
    </div>
  );
}
