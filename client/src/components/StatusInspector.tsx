import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Eye, EyeOff, Bug } from "lucide-react";

interface StatusInspectorProps {
  property: {
    id?: string;
    listingId?: string;
    standardStatus?: string;
    status?: string;
    lastStatus?: string;
    raw?: Record<string, any>;
  };
}

export function StatusInspector({ property }: StatusInspectorProps) {
  return (
    <div className="mt-2 p-2 bg-muted/50 border border-dashed rounded text-xs space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Bug className="h-3 w-3" />
        <span className="font-semibold">Status Inspector</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
        <div>
          <span className="font-medium">standardStatus:</span>{" "}
          <span className="text-foreground">{property.standardStatus || "(empty)"}</span>
        </div>
        <div>
          <span className="font-medium">status:</span>{" "}
          <span className="text-foreground">{property.status || "(empty)"}</span>
        </div>
        <div>
          <span className="font-medium">lastStatus:</span>{" "}
          <span className="text-foreground">{property.lastStatus || "(empty)"}</span>
        </div>
        <div>
          <span className="font-medium">listingId:</span>{" "}
          <span className="text-foreground">{property.listingId || property.id || "(empty)"}</span>
        </div>
      </div>
      {property.raw && Object.keys(property.raw).some(k => k.toLowerCase().includes('status')) && (
        <div className="border-t pt-1 mt-1">
          <span className="font-medium text-muted-foreground">Raw status fields:</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
            {Object.entries(property.raw)
              .filter(([k]) => k.toLowerCase().includes('status'))
              .map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium">{key}:</span>{" "}
                  <span className="text-foreground">{String(value) || "(empty)"}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatusInspectorToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function StatusInspectorToggle({ enabled, onToggle }: StatusInspectorToggleProps) {
  const isDev = import.meta.env.DEV;
  
  if (!isDev) return null;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded border border-dashed text-xs">
      <Bug className="h-4 w-4 text-muted-foreground" />
      <Label htmlFor="status-inspector" className="text-muted-foreground cursor-pointer">
        Status Inspector (Dev)
      </Label>
      <Switch
        id="status-inspector"
        checked={enabled}
        onCheckedChange={onToggle}
        data-testid="switch-status-inspector"
      />
      {enabled && (
        <Badge variant="outline" className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          ON
        </Badge>
      )}
    </div>
  );
}

interface APIConfigErrorProps {
  errors?: string[];
  isPartialData?: boolean;
}

export function APIConfigError({ errors, isPartialData }: APIConfigErrorProps) {
  if (!errors || errors.length === 0) return null;
  
  const hasRepliersError = errors.some(e => 
    e.toLowerCase().includes('repliers') || 
    e.toLowerCase().includes('api key not configured')
  );
  
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {hasRepliersError ? "API Configuration Issue" : "Data Warning"}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {errors.map((error, i) => (
          <p key={i} className="text-muted-foreground">{error}</p>
        ))}
        {hasRepliersError && (
          <p className="text-xs text-muted-foreground/70">
            Check that REPLIERS_API_KEY is set in environment variables. 
            Active, Active Under Contract, and Pending counts require a valid Repliers API key.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
