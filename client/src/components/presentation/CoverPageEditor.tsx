import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

export interface CoverPageConfig {
  title: string;
  subtitle: string;
  showDate: boolean;
  showAgentPhoto: boolean;
  background: "none" | "gradient" | "property";
}

interface CoverPageEditorProps {
  config: CoverPageConfig;
  onChange: (config: CoverPageConfig) => void;
  cmaName: string;
  agentInfo: {
    name: string;
    brokerage: string;
  };
}

const defaultConfig: CoverPageConfig = {
  title: "Comparative Market Analysis",
  subtitle: "Prepared exclusively for you",
  showDate: true,
  showAgentPhoto: true,
  background: "none",
};

export function getDefaultCoverPageConfig(): CoverPageConfig {
  return { ...defaultConfig };
}

export function CoverPageEditor({ 
  config, 
  onChange,
  cmaName,
  agentInfo 
}: CoverPageEditorProps) {
  const backgroundOptions = [
    { value: "none", label: "Plain White" },
    { value: "gradient", label: "Gradient" },
    { value: "property", label: "Property Photo" },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Cover Page</h3>
        <p className="text-sm text-muted-foreground">
          Customize how your CMA cover page appears
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover-title">Title</Label>
        <Input
          id="cover-title"
          type="text"
          value={config.title || defaultConfig.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder={defaultConfig.title}
          data-testid="input-cover-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover-subtitle">Subtitle</Label>
        <Input
          id="cover-subtitle"
          type="text"
          value={config.subtitle || defaultConfig.subtitle}
          onChange={(e) => onChange({ ...config, subtitle: e.target.value })}
          placeholder={defaultConfig.subtitle}
          data-testid="input-cover-subtitle"
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label>Show Date</Label>
          <p className="text-sm text-muted-foreground">Display report date on cover</p>
        </div>
        <Switch
          checked={config.showDate !== false}
          onCheckedChange={(v) => onChange({ ...config, showDate: v })}
          data-testid="switch-cover-show-date"
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label>Show Agent Photo</Label>
          <p className="text-sm text-muted-foreground">Include your photo on cover</p>
        </div>
        <Switch
          checked={config.showAgentPhoto !== false}
          onCheckedChange={(v) => onChange({ ...config, showAgentPhoto: v })}
          data-testid="switch-cover-show-agent-photo"
        />
      </div>

      <div className="space-y-2">
        <Label>Cover Background</Label>
        <div className="grid grid-cols-3 gap-2">
          {backgroundOptions.map((bg) => (
            <Button
              key={bg.value}
              type="button"
              variant={config.background === bg.value ? "default" : "outline"}
              onClick={() => onChange({ ...config, background: bg.value })}
              className="relative h-auto py-3"
              data-testid={`button-cover-bg-${bg.value}`}
            >
              {config.background === bg.value && (
                <Check className="absolute top-1 right-1 h-3 w-3" />
              )}
              {bg.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview:</p>
          <div 
            className={`rounded shadow-sm p-4 text-center ${
              config.background === "gradient" 
                ? "bg-gradient-to-br from-[#FEF2EF] to-[#FDE5DF]" 
                : config.background === "property"
                ? "bg-gray-200"
                : "bg-white"
            }`}
          >
            <p className="text-primary font-medium text-sm">{agentInfo.brokerage}</p>
            <h2 className="text-lg font-bold mt-2">
              {config.title || defaultConfig.title}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {config.subtitle || defaultConfig.subtitle}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{cmaName}</p>
            {config.showDate !== false && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleDateString()}
              </p>
            )}
            {config.showAgentPhoto !== false && (
              <div className="mt-2 flex justify-center">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                  {agentInfo.name.charAt(0)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
