import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, RefreshCw, Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PropertyData {
  address?: string;
  streetAddress?: string;
  listPrice?: number | string | null;
  bedroomsTotal?: number | string | null;
  bathroomsTotal?: number | string | null;
  livingArea?: number | string | null;
  publicRemarks?: string;
  standardStatus?: string;
  daysOnMarket?: number | string | null;
}

interface PropertyStatistics {
  avgPrice: number;
  medianPrice: number;
  avgPricePerSqft: number;
  propertyCount: number;
  priceRange: { min: number; max: number };
}

interface CoverLetterEditorProps {
  value: string;
  onChange: (value: string) => void;
  subjectProperty?: PropertyData | null;
  properties?: PropertyData[];
  statistics?: PropertyStatistics;
  agentName?: string;
  companyName?: string;
  clientName?: string;
  onClientNameChange?: (name: string) => void;
}

type Tone = "professional" | "friendly" | "confident";

function buildContext(
  subjectProperty: PropertyData | undefined | null,
  properties: PropertyData[] | undefined,
  statistics: PropertyStatistics | undefined,
  agentName: string,
  companyName: string,
  clientName?: string
) {
  const subject = subjectProperty || {};
  const address = subject.streetAddress || subject.address || "Property Address";
  const price = Number(subject.listPrice) || 0;
  const beds = Number(subject.bedroomsTotal) || 0;
  const baths = Number(subject.bathroomsTotal) || 0;
  const sqft = Number(subject.livingArea) || 0;

  const props = properties || [];
  const stats = statistics || {
    avgPrice: 0,
    medianPrice: 0,
    avgPricePerSqft: 0,
    propertyCount: 0,
    priceRange: { min: 0, max: 0 },
  };

  const activeCount = props.filter(
    (p) => p.standardStatus === "Active" || p.standardStatus === "Active Under Contract"
  ).length;
  const closedCount = props.filter((p) => p.standardStatus === "Closed").length;
  const domValues = props
    .map((p) => Number(p.daysOnMarket))
    .filter((d) => d > 0);
  const avgDOM = domValues.length
    ? Math.round(domValues.reduce((a, b) => a + b, 0) / domValues.length)
    : 0;

  return {
    subjectProperty: {
      address,
      price,
      beds,
      baths,
      sqft,
      description: subject.publicRemarks || undefined,
    },
    comparables: {
      count: stats.propertyCount,
      avgPrice: stats.avgPrice,
      medianPrice: stats.medianPrice,
      avgPricePerSqft: stats.avgPricePerSqft,
      priceRange: stats.priceRange,
    },
    marketStats: {
      avgDOM,
      activeCount,
      closedCount,
    },
    agentInfo: {
      name: agentName,
      brokerage: companyName,
    },
    clientName: clientName || undefined,
  };
}

export function CoverLetterEditor({
  value,
  onChange,
  subjectProperty,
  properties,
  statistics,
  agentName = "Your Agent",
  companyName = "Spyglass Realty",
  clientName = "",
  onClientNameChange,
}: CoverLetterEditorProps) {
  const [tone, setTone] = useState<Tone>("professional");
  const [copied, setCopied] = useState(false);
  const [localClientName, setLocalClientName] = useState(clientName);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const context = buildContext(
        subjectProperty,
        properties,
        statistics,
        agentName,
        companyName,
        localClientName
      );

      const response = await apiRequest("POST", "/api/ai/generate-cover-letter", {
        context,
        tone,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate cover letter");
      }

      const data = await response.json();
      return data.coverLetter;
    },
    onSuccess: (letter: string) => {
      onChange(letter);
      toast({
        title: "Cover letter generated",
        description: "AI has created a personalized cover letter based on your CMA data.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClientNameChange = (name: string) => {
    setLocalClientName(name);
    onClientNameChange?.(name);
  };

  const hasSubjectData = !!(subjectProperty?.streetAddress || subjectProperty?.address);
  const hasComparables = (statistics?.propertyCount || 0) > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client-name">Client Name (Optional)</Label>
        <Input
          id="client-name"
          value={localClientName}
          onChange={(e) => handleClientNameChange(e.target.value)}
          placeholder="e.g., John and Jane Smith"
          data-testid="input-client-name"
        />
        <p className="text-xs text-muted-foreground">
          Include client name for personalized cover letter greeting
        </p>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-100 dark:border-purple-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-purple-500 w-4 h-4" />
          <span className="font-medium text-purple-900 dark:text-purple-100">AI Assistant</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Tone:</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger className="w-32" data-testid="select-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="confident">Confident</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || !hasSubjectData}
            variant="default"
            size="sm"
            className="bg-purple-500 hover:bg-purple-600"
            data-testid="button-generate-cover-letter"
          >
            {generateMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
        </div>

        {!hasSubjectData && (
          <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3 h-3" />
            <span>Subject property data is needed for AI generation</span>
          </div>
        )}

        {!hasComparables && hasSubjectData && (
          <p className="text-xs text-muted-foreground mt-2">
            Add comparable properties for richer market insights in the cover letter.
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          AI will create a cover letter based on your CMA data, comparables, and market statistics.
        </p>
      </div>

      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your cover letter content, or use AI to generate one based on your CMA data..."
          className="min-h-64 resize-none"
          data-testid="textarea-cover-letter"
        />

        {value && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="absolute top-2 right-2"
            title="Copy to clipboard"
            data-testid="button-copy-cover-letter"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Leave blank to use your default cover letter from agent settings.
      </p>
    </div>
  );
}
