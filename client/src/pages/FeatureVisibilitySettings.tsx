import { useState } from 'react';
import { useFeatureVisibility } from '@/hooks/use-feature-visibility';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Shield, Save, Loader2 } from 'lucide-react';

interface FeatureState {
  featureKey: string;
  isVisible: boolean;
  status: string;
  hiddenMessage: string;
}

const SECTION_LABELS: Record<string, string> = {
  application: 'Application',
  admin: 'Admin',
  followupboss: 'Follow Up Boss',
};

export default function FeatureVisibilitySettings() {
  const { features, isLoading, bulkUpdate } = useFeatureVisibility();
  const { toast } = useToast();
  const [localChanges, setLocalChanges] = useState<Record<string, Partial<FeatureState>>>({});
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const hasChanges = Object.keys(localChanges).length > 0;

  const getFeatureValue = (featureKey: string, field: keyof FeatureState) => {
    if (localChanges[featureKey]?.[field] !== undefined) {
      return localChanges[featureKey][field];
    }
    const feature = features.find(f => f.featureKey === featureKey);
    return feature ? (feature as any)[field] : undefined;
  };

  const updateLocal = (featureKey: string, field: keyof FeatureState, value: any) => {
    setLocalChanges(prev => ({
      ...prev,
      [featureKey]: { ...prev[featureKey], featureKey, [field]: value },
    }));
  };

  const handleSave = async () => {
    const updates = Object.values(localChanges).map(change => {
      const feature = features.find(f => f.featureKey === change.featureKey);
      return {
        featureKey: change.featureKey!,
        isVisible: change.isVisible ?? feature?.isVisible ?? true,
        status: change.status ?? feature?.status ?? 'live',
        hiddenMessage: change.hiddenMessage ?? feature?.hiddenMessage ?? 'This feature is currently under development.',
      };
    });

    try {
      await bulkUpdate.mutateAsync(updates);
      setLocalChanges({});
      toast({ title: 'Settings saved', description: `Updated ${updates.length} feature${updates.length !== 1 ? 's' : ''}.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    }
  };

  const sections = [...new Set(features.map(f => f.section))];

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" data-testid="feature-visibility-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Feature Visibility</h1>
          <p className="text-muted-foreground">Control which features are visible to non-Developer users</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 no-default-hover-elevate no-default-active-elevate">
            <Shield className="w-3.5 h-3.5" />
            Developer Only
          </Badge>
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={bulkUpdate.isPending}
              className="gap-2"
              data-testid="button-save-features"
            >
              {bulkUpdate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {sections.map(section => (
        <Card key={section}>
          <CardHeader>
            <CardTitle>{SECTION_LABELS[section] || section}</CardTitle>
            <CardDescription>
              {section === 'application' && 'Main application pages available to all users'}
              {section === 'admin' && 'Admin pages for Super Admin and Developer users'}
              {section === 'followupboss' && 'Follow Up Boss integration pages'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.filter(f => f.section === section).map(feature => {
              const isVisible = getFeatureValue(feature.featureKey, 'isVisible') as boolean;
              const status = getFeatureValue(feature.featureKey, 'status') as string;
              const isExpanded = expandedFeature === feature.featureKey;
              const hasLocalChange = !!localChanges[feature.featureKey];

              return (
                <div
                  key={feature.featureKey}
                  className={`rounded-md border p-4 ${hasLocalChange ? 'border-primary/50 bg-primary/5' : ''}`}
                  data-testid={`feature-row-${feature.featureKey}`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      {isVisible ? (
                        <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-medium">{feature.featureLabel}</div>
                        <div className="text-xs text-muted-foreground">{feature.route}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Select
                        value={status}
                        onValueChange={(val) => updateLocal(feature.featureKey, 'status', val)}
                      >
                        <SelectTrigger className="w-[130px]" data-testid={`select-status-${feature.featureKey}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Switch
                        checked={isVisible}
                        onCheckedChange={(checked) => updateLocal(feature.featureKey, 'isVisible', checked)}
                        data-testid={`switch-visible-${feature.featureKey}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedFeature(isExpanded ? null : feature.featureKey)}
                        data-testid={`button-expand-${feature.featureKey}`}
                      >
                        {isExpanded ? 'Less' : 'More'}
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 space-y-2">
                      <label className="text-sm font-medium">Hidden Message</label>
                      <Textarea
                        value={(getFeatureValue(feature.featureKey, 'hiddenMessage') as string) || ''}
                        onChange={(e) => updateLocal(feature.featureKey, 'hiddenMessage', e.target.value)}
                        placeholder="Message shown when feature is hidden..."
                        className="text-sm"
                        data-testid={`textarea-message-${feature.featureKey}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
