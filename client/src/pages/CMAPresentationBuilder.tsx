import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  GripVertical,
  Eye,
  EyeOff,
  Loader2,
  Save,
  RotateCcw,
  FileText,
  User,
  Building2,
  LayoutGrid,
  ImageIcon,
  Home,
  Phone,
  Mail,
  Globe,
  MapPin,
  BarChart3,
  Table,
  Map,
  Check,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Expand,
} from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { CMAPdfDocument } from "@/components/CMAPdfDocument";
import { ListingBrochureContent } from "@/components/ListingBrochureContent";
import { ExpandedPreviewModal } from "@/components/ExpandedPreviewModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { 
  CMA_REPORT_SECTIONS, 
  type CmaSectionId,
  type AgentProfile,
  type CompanySettings,
  type CmaReportConfig,
  type Cma,
  type CmaBrochure,
} from "@shared/schema";

// Extended type to handle API response which may include defaults
interface ReportConfigResponse {
  id?: string;
  cmaId: string;
  includedSections?: string[];
  sectionOrder?: string[];
  coverLetterOverride?: string | null;
  layout?: string;
  template?: string;
  theme?: string;
  photoLayout?: string;
  includeAgentFooter?: boolean;
}

interface AuthUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

const SECTION_CATEGORIES = {
  introduction: { label: "Introduction", icon: FileText },
  listings: { label: "Listings", icon: Home },
  analysis: { label: "Analysis", icon: BarChart3 },
} as const;

const LAYOUT_OPTIONS = [
  { value: "two_photos", label: "Two Photos per Property" },
  { value: "single_photo", label: "Single Photo per Property" },
  { value: "no_photos", label: "No Photos" },
];

const PHOTO_LAYOUT_OPTIONS = [
  { value: "first_dozen", label: "First 12 Photos" },
  { value: "all", label: "All Photos" },
];

interface PropertyData {
  id?: string;
  listingId?: string;
  address?: string;
  streetAddress?: string;
  city?: string;
  listPrice?: number | string | null;
  closePrice?: number | string | null;
  livingArea?: number | string | null;
  bedroomsTotal?: number | string | null;
  bathroomsTotal?: number | string | null;
  yearBuilt?: number | string | null;
  daysOnMarket?: number | string | null;
  standardStatus?: string;
  closeDate?: string;
}

interface PropertyStatistics {
  avgPrice: number;
  medianPrice: number;
  avgPricePerSqft: number;
  medianPricePerSqft: number;
  avgLivingArea: number;
  avgBedrooms: number;
  avgBathrooms: number;
  priceRange: { min: number; max: number };
  sqftRange: { min: number; max: number };
  propertyCount: number;
}

function calculateStatistics(properties: PropertyData[]): PropertyStatistics {
  const validProperties = properties.filter(p => {
    const price = Number(p.listPrice || p.closePrice);
    return price > 0;
  });

  const prices = validProperties.map(p => Number(p.listPrice || p.closePrice));
  const sqftValues = validProperties
    .filter(p => Number(p.livingArea) > 0)
    .map(p => Number(p.livingArea));
  const pricesPerSqft = validProperties
    .filter(p => Number(p.listPrice || p.closePrice) > 0 && Number(p.livingArea) > 0)
    .map(p => Number(p.listPrice || p.closePrice) / Number(p.livingArea));
  const bedrooms = validProperties
    .filter(p => Number(p.bedroomsTotal) > 0)
    .map(p => Number(p.bedroomsTotal));
  const bathrooms = validProperties
    .filter(p => Number(p.bathroomsTotal) > 0)
    .map(p => Number(p.bathroomsTotal));

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  return {
    avgPrice: avg(prices),
    medianPrice: median(prices),
    avgPricePerSqft: avg(pricesPerSqft),
    medianPricePerSqft: median(pricesPerSqft),
    avgLivingArea: avg(sqftValues),
    avgBedrooms: avg(bedrooms),
    avgBathrooms: avg(bathrooms),
    priceRange: { min: Math.min(...prices) || 0, max: Math.max(...prices) || 0 },
    sqftRange: { min: Math.min(...sqftValues) || 0, max: Math.max(...sqftValues) || 0 },
    propertyCount: validProperties.length,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(value);
}

export default function CMAPresentationBuilder() {
  const [, params] = useRoute("/cmas/:id/presentation");
  const [, setLocation] = useLocation();
  const cmaId = params?.id;
  const { toast } = useToast();
  const queryClientInstance = useQueryClient();

  const [activeTab, setActiveTab] = useState("sections");
  const [hasChanges, setHasChanges] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);

  const [includedSections, setIncludedSections] = useState<string[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [coverLetterOverride, setCoverLetterOverride] = useState("");
  const [layout, setLayout] = useState("two_photos");
  const [photoLayout, setPhotoLayout] = useState("first_dozen");
  const [includeAgentFooter, setIncludeAgentFooter] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    introduction: true,
    listings: true,
    analysis: true,
  });
  const [brochure, setBrochure] = useState<CmaBrochure | null>(null);

  const { data: cma, isLoading: cmaLoading, isError: cmaError } = useQuery<Cma | null>({
    queryKey: ["/api/cmas", cmaId],
    enabled: !!cmaId,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${cmaId}`);
      if (!response.ok) throw new Error("Failed to fetch CMA");
      return response.json();
    },
  });

  const { data: reportConfig, isLoading: configLoading, isError: configError } = useQuery<ReportConfigResponse | null>({
    queryKey: ["/api/cmas", cmaId, "report-config"],
    enabled: !!cmaId,
    queryFn: async () => {
      const response = await fetch(`/api/cmas/${cmaId}/report-config`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch config");
      return response.json();
    },
  });

  const { data: agentProfile, isLoading: profileLoading, isError: profileError } = useQuery<AgentProfile | null>({
    queryKey: ["/api/agent/profile"],
    queryFn: async () => {
      const response = await fetch("/api/agent/profile");
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });

  // Fetch company settings - handle 403 for non-admins gracefully
  const { data: companySettings, isLoading: companyLoading } = useQuery<CompanySettings | null>({
    queryKey: ["/api/admin/company-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/company-settings");
      // Return defaults if forbidden (non-admin) or not found
      if (response.status === 403 || response.status === 404) {
        return {
          companyName: "Spyglass Realty",
          primaryColor: "#F97316",
          secondaryColor: "#1E3A5F",
          accentColor: "#FFFFFF",
        } as CompanySettings;
      }
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    },
  });

  const { data: currentUser } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
  });

  // Calculate statistics from CMA properties
  const { statistics, pricePerSqftData } = useMemo(() => {
    const properties = (cma?.propertiesData || []) as PropertyData[];
    const stats = calculateStatistics(properties);
    
    // Prepare chart data for price per sqft visualization
    const subjectId = cma?.subjectPropertyId;
    const chartData = properties
      .filter(p => Number(p.listPrice || p.closePrice) > 0 && Number(p.livingArea) > 0)
      .map(p => {
        const price = Number(p.listPrice || p.closePrice);
        const sqft = Number(p.livingArea);
        const pricePerSqft = price / sqft;
        const address = p.streetAddress || p.address || "Property";
        const shortAddress = address.length > 20 ? address.substring(0, 18) + "..." : address;
        // Check both id and listingId for subject property match
        const isSubject = subjectId ? (p.id === subjectId || p.listingId === subjectId) : false;
        return {
          name: shortAddress,
          fullAddress: address,
          pricePerSqft: Math.round(pricePerSqft),
          price,
          sqft,
          isSubject,
        };
      })
      .sort((a, b) => a.pricePerSqft - b.pricePerSqft);

    return { statistics: stats, pricePerSqftData: chartData };
  }, [cma?.propertiesData, cma?.subjectPropertyId]);

  useEffect(() => {
    if (reportConfig) {
      const defaultSections = CMA_REPORT_SECTIONS.filter(s => s.defaultEnabled).map(s => s.id);
      setIncludedSections(reportConfig.includedSections || defaultSections);
      setSectionOrder(reportConfig.sectionOrder || CMA_REPORT_SECTIONS.map(s => s.id));
      setCoverLetterOverride(reportConfig.coverLetterOverride || "");
      setLayout(reportConfig.layout || "two_photos");
      setPhotoLayout(reportConfig.photoLayout || "first_dozen");
      setIncludeAgentFooter(reportConfig.includeAgentFooter ?? true);
    } else if (!configLoading) {
      const defaultSections = CMA_REPORT_SECTIONS.filter(s => s.defaultEnabled).map(s => s.id);
      setIncludedSections(defaultSections);
      setSectionOrder(CMA_REPORT_SECTIONS.map(s => s.id));
      setCoverLetterOverride(agentProfile?.defaultCoverLetter || "");
    }
  }, [reportConfig, configLoading, agentProfile]);

  // Initialize brochure from CMA data
  useEffect(() => {
    if (cma?.brochure) {
      setBrochure(cma.brochure);
    }
  }, [cma?.brochure]);

  // Visual feedback when preview updates
  useEffect(() => {
    setIsPreviewUpdating(true);
    const timer = setTimeout(() => setIsPreviewUpdating(false), 300);
    return () => clearTimeout(timer);
  }, [includedSections, layout, photoLayout, includeAgentFooter, coverLetterOverride]);

  // Handle section click from preview to jump to settings
  const handlePreviewSectionClick = (sectionId: string) => {
    setActiveTab("sections");
    setTimeout(() => {
      const element = document.getElementById(`section-${sectionId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // Extract subject property from CMA data
  const subjectProperty = useMemo(() => {
    if (!cma?.propertiesData || !cma?.subjectPropertyId) return null;
    const properties = cma.propertiesData as PropertyData[];
    const subject = properties.find(
      p => p.id === cma.subjectPropertyId || p.listingId === cma.subjectPropertyId
    );
    return subject || null;
  }, [cma?.propertiesData, cma?.subjectPropertyId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const configData = {
        includedSections,
        sectionOrder,
        coverLetterOverride: coverLetterOverride || undefined,
        layout,
        photoLayout,
        includeAgentFooter,
      };

      return apiRequest(`/api/cmas/${cmaId}/report-config`, "PUT", configData);
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClientInstance.invalidateQueries({ queryKey: ["/api/cmas", cmaId, "report-config"] });
      toast({
        title: "Configuration saved",
        description: "Your presentation settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Failed to save presentation configuration.",
        variant: "destructive",
      });
    },
  });

  const toggleSection = (sectionId: string) => {
    setHasChanges(true);
    setIncludedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    setHasChanges(true);
    setSectionOrder(prev => {
      const index = prev.indexOf(sectionId);
      if (index === -1) return prev;
      const newOrder = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return prev;
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      return newOrder;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleReset = () => {
    const defaultSections = CMA_REPORT_SECTIONS.filter(s => s.defaultEnabled).map(s => s.id);
    setIncludedSections(defaultSections);
    setSectionOrder(CMA_REPORT_SECTIONS.map(s => s.id));
    setCoverLetterOverride(agentProfile?.defaultCoverLetter || "");
    setLayout("two_photos");
    setPhotoLayout("first_dozen");
    setIncludeAgentFooter(true);
    setHasChanges(true);
    toast({
      title: "Reset to defaults",
      description: "Settings have been reset. Save to apply.",
    });
  };

  const handleExportPdf = async () => {
    if (!cma) return;
    
    setIsGeneratingPdf(true);
    try {
      const brochureWithAbsoluteUrl = brochure ? {
        ...brochure,
        url: brochure.url.startsWith("http") ? brochure.url : `${window.location.origin}/${brochure.url.replace(/^\//, "")}`,
      } : null;
      
      const pdfDoc = (
        <CMAPdfDocument
          cma={{
            ...cma,
            propertiesData: cma.propertiesData || undefined,
          }}
          agentProfile={agentProfile}
          companySettings={companySettings}
          currentUser={currentUser}
          includedSections={includedSections}
          coverLetterOverride={coverLetterOverride}
          includeAgentFooter={includeAgentFooter}
          brochure={brochureWithAbsoluteUrl}
        />
      );
      
      const blob = await pdf(pdfDoc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CMA_Report_${cma.name?.replace(/\s+/g, "_") || "Report"}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "PDF exported",
        description: "Your CMA report has been downloaded.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const isLoading = cmaLoading || configLoading || profileLoading || companyLoading;
  const hasError = cmaError || configError;

  const getSortedSectionsByCategory = (category: string) => {
    return sectionOrder
      .map(id => CMA_REPORT_SECTIONS.find(s => s.id === id))
      .filter(s => s && s.category === category) as typeof CMA_REPORT_SECTIONS[number][];
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <h1 className="text-2xl font-semibold">Error loading data</h1>
        <p className="text-muted-foreground">Failed to load the presentation builder. Please try again.</p>
        <Button asChild variant="outline">
          <Link href="/cmas">Return to CMAs</Link>
        </Button>
      </div>
    );
  }

  if (!cma) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <h1 className="text-2xl font-semibold">CMA not found</h1>
        <Button asChild variant="outline">
          <Link href="/cmas">Return to CMAs</Link>
        </Button>
      </div>
    );
  }

  const userName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.email?.split("@")[0] || "Agent";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/cmas/${cmaId}`)}
            data-testid="button-back-to-cma"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CMA
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-builder-title">
              Presentation Builder
            </h1>
            <p className="text-muted-foreground">{cma.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary" className="mr-2">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            data-testid="button-reset-config"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            data-testid="button-save-config"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Configuration
          </Button>
          <Button
            onClick={handleExportPdf}
            disabled={isGeneratingPdf || !cma}
            variant="secondary"
            data-testid="button-export-pdf"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sections" data-testid="tab-sections">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Sections
              </TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content">
                <FileText className="w-4 h-4 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="layout" data-testid="tab-layout">
                <ImageIcon className="w-4 h-4 mr-2" />
                Layout
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sections" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Report Sections</CardTitle>
                  <CardDescription>
                    Toggle sections on/off and reorder them for your presentation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(SECTION_CATEGORIES).map(([category, { label, icon: Icon }]) => (
                    <div key={category} className="space-y-2">
                      <button
                        className="flex items-center justify-between w-full p-2 rounded-md hover-elevate"
                        onClick={() => toggleCategory(category)}
                        data-testid={`button-toggle-category-${category}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{label}</span>
                          <Badge variant="secondary" className="ml-2">
                            {getSortedSectionsByCategory(category).filter(s => includedSections.includes(s.id)).length}/
                            {getSortedSectionsByCategory(category).length}
                          </Badge>
                        </div>
                        {expandedCategories[category] ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      {expandedCategories[category] && (
                        <div className="ml-6 space-y-1">
                          {getSortedSectionsByCategory(category).map((section, index) => {
                            const isEnabled = includedSections.includes(section.id);
                            const categorySections = getSortedSectionsByCategory(category);
                            const isFirst = index === 0;
                            const isLast = index === categorySections.length - 1;

                            return (
                              <div
                                key={section.id}
                                id={`section-${section.id}`}
                                className={`flex items-center justify-between p-3 rounded-md border ${
                                  isEnabled ? "bg-card" : "bg-muted/50"
                                }`}
                                data-testid={`section-item-${section.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                                  <div className="flex flex-col">
                                    <span className={!isEnabled ? "text-muted-foreground" : ""}>
                                      {section.name}
                                    </span>
                                    {"editable" in section && section.editable && (
                                      <span className="text-xs text-muted-foreground">
                                        Customizable content
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={isFirst}
                                      onClick={() => moveSection(section.id, "up")}
                                      data-testid={`button-move-up-${section.id}`}
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={isLast}
                                      onClick={() => moveSection(section.id, "down")}
                                      data-testid={`button-move-down-${section.id}`}
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={() => toggleSection(section.id)}
                                    data-testid={`switch-section-${section.id}`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Cover Letter</CardTitle>
                  <CardDescription>
                    Customize the cover letter for this CMA report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={coverLetterOverride}
                    onChange={(e) => {
                      setCoverLetterOverride(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Enter your cover letter content..."
                    className="min-h-[200px]"
                    data-testid="textarea-cover-letter"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Leave blank to use your default cover letter from agent settings
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Agent Footer</CardTitle>
                  <CardDescription>
                    Include agent contact information at the bottom of each page
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="agent-footer">Include agent footer</Label>
                    <Switch
                      id="agent-footer"
                      checked={includeAgentFooter}
                      onCheckedChange={(checked) => {
                        setIncludeAgentFooter(checked);
                        setHasChanges(true);
                      }}
                      data-testid="switch-agent-footer"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Listing Brochure</CardTitle>
                  <CardDescription>
                    Add a marketing flyer for the subject property
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cmaId && (
                    <ListingBrochureContent
                      cmaId={cmaId}
                      brochure={brochure}
                      subjectProperty={subjectProperty ? {
                        address: subjectProperty.address,
                        streetAddress: subjectProperty.streetAddress,
                        listPrice: subjectProperty.listPrice,
                        bedroomsTotal: subjectProperty.bedroomsTotal,
                        bathroomsTotal: subjectProperty.bathroomsTotal,
                        livingArea: subjectProperty.livingArea,
                        yearBuilt: subjectProperty.yearBuilt,
                        publicRemarks: subjectProperty.publicRemarks,
                        photos: subjectProperty.photos,
                      } : undefined}
                      onBrochureChange={(newBrochure) => {
                        setBrochure(newBrochure);
                        queryClientInstance.invalidateQueries({ queryKey: ["/api/cmas", cmaId] });
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="layout" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Property Layout</CardTitle>
                  <CardDescription>
                    Choose how properties are displayed in the report
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Photos per property</Label>
                    <Select
                      value={layout}
                      onValueChange={(value) => {
                        setLayout(value);
                        setHasChanges(true);
                      }}
                    >
                      <SelectTrigger data-testid="select-layout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LAYOUT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Photo selection</Label>
                    <Select
                      value={photoLayout}
                      onValueChange={(value) => {
                        setPhotoLayout(value);
                        setHasChanges(true);
                      }}
                    >
                      <SelectTrigger data-testid="select-photo-layout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHOTO_LAYOUT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Live Preview</CardTitle>
                  <CardDescription>
                    Preview how your CMA presentation will appear
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline">
                    {includedSections.length} sections
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsPreviewModalOpen(true)}
                    title="Expand preview"
                    data-testid="button-expand-preview"
                  >
                    <Expand className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] border rounded-md">
                <div className={`p-4 space-y-4 transition-opacity duration-300 ${isPreviewUpdating ? "opacity-50" : "opacity-100"}`}>
                  {includedSections.includes("cover_page") && (
                    <PreviewSection title="Cover Page" icon={FileText} sectionId="cover_page" onClick={handlePreviewSectionClick}>
                      <div className="text-center space-y-4">
                        {companySettings?.logoUrl ? (
                          <img
                            src={companySettings.logoUrl}
                            alt="Company Logo"
                            className="h-12 mx-auto object-contain"
                          />
                        ) : (
                          <div className="font-bold text-xl" style={{ color: companySettings?.primaryColor ?? undefined }}>
                            {companySettings?.companyName || "Spyglass Realty"}
                          </div>
                        )}
                        <div className="text-2xl font-bold">
                          Comparative Market Analysis
                        </div>
                        <div className="text-muted-foreground">{cma.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Prepared by {userName}
                        </div>
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("listing_brochure") && (
                    <PreviewSection title="Listing Brochure" icon={ImageIcon} sectionId="listing_brochure" onClick={handlePreviewSectionClick}>
                      {brochure ? (
                        <div className="space-y-2">
                          <div className="aspect-[8.5/11] bg-muted rounded-lg overflow-hidden border max-h-[200px]">
                            {brochure.type === "pdf" ? (
                              <div className="flex items-center justify-center h-full text-muted-foreground">
                                <FileText className="h-8 w-8 mr-2" />
                                <span className="text-sm">{brochure.filename}</span>
                              </div>
                            ) : (
                              <img
                                src={brochure.url.startsWith("http") ? brochure.url : `/${brochure.url}`}
                                alt="Listing Brochure"
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            {brochure.generated ? "Auto-generated brochure" : "Uploaded brochure"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center">
                          No brochure uploaded. Go to Content tab to add one.
                        </p>
                      )}
                    </PreviewSection>
                  )}

                  {includedSections.includes("cover_letter") && (
                    <PreviewSection title="Cover Letter" icon={FileText} sectionId="cover_letter" onClick={handlePreviewSectionClick}>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {coverLetterOverride || agentProfile?.defaultCoverLetter || "Your personalized cover letter will appear here..."}
                      </p>
                    </PreviewSection>
                  )}

                  {includedSections.includes("agent_resume") && (
                    <PreviewSection title="Agent Resume" icon={User} sectionId="agent_resume" onClick={handlePreviewSectionClick}>
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={agentProfile?.headshotUrl ?? undefined} />
                          <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="font-semibold">{userName}</div>
                          <div className="text-sm text-muted-foreground">
                            {agentProfile?.title || "Real Estate Agent"}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {agentProfile?.bio || "Agent bio will appear here..."}
                          </p>
                        </div>
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("our_company") && (
                    <PreviewSection title="Our Company" icon={Building2} sectionId="our_company" onClick={handlePreviewSectionClick}>
                      <div className="space-y-2">
                        <div className="font-semibold">
                          {companySettings?.companyName || "Spyglass Realty"}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {companySettings?.ourCompanyContent || "Your trusted real estate partner..."}
                        </p>
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("what_is_cma") && (
                    <PreviewSection title="What is a CMA?" icon={FileText} sectionId="what_is_cma" onClick={handlePreviewSectionClick}>
                      <p className="text-sm text-muted-foreground">
                        A Comparative Market Analysis (CMA) is a detailed report that helps determine the value of a property by comparing it to similar properties that have recently sold or are currently on the market in the same area.
                      </p>
                    </PreviewSection>
                  )}

                  {includedSections.includes("contact_me") && (
                    <PreviewSection title="Contact Me" icon={Phone} sectionId="contact_me" onClick={handlePreviewSectionClick}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{currentUser?.email}</span>
                        </div>
                        {companySettings?.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>{companySettings.phone}</span>
                          </div>
                        )}
                        {agentProfile?.websiteUrl && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <span>{agentProfile.websiteUrl}</span>
                          </div>
                        )}
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("map_all_listings") && (
                    <PreviewSection title="Map of All Listings" icon={Map} sectionId="map_all_listings" onClick={handlePreviewSectionClick}>
                      <div className="h-32 bg-muted rounded-md flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">
                          Interactive map with {cma.propertiesData?.length || 0} properties
                        </span>
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("summary_comparables") && (
                    <PreviewSection title="Summary of Comparable Properties" icon={Table} sectionId="summary_comparables" onClick={handlePreviewSectionClick}>
                      {statistics.propertyCount > 0 ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 bg-muted rounded-md text-center">
                              <div className="text-muted-foreground mb-1">Avg Price</div>
                              <div className="font-semibold">{formatCurrency(statistics.avgPrice)}</div>
                            </div>
                            <div className="p-2 bg-muted rounded-md text-center">
                              <div className="text-muted-foreground mb-1">Avg $/SqFt</div>
                              <div className="font-semibold">${formatNumber(statistics.avgPricePerSqft)}</div>
                            </div>
                            <div className="p-2 bg-muted rounded-md text-center">
                              <div className="text-muted-foreground mb-1">Properties</div>
                              <div className="font-semibold">{statistics.propertyCount}</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            Price range: {formatCurrency(statistics.priceRange.min)} - {formatCurrency(statistics.priceRange.max)}
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">
                            No comparable properties in this CMA
                          </span>
                        </div>
                      )}
                    </PreviewSection>
                  )}

                  {includedSections.includes("property_details") && (
                    <PreviewSection title="Property Details" icon={Home} sectionId="property_details" onClick={handlePreviewSectionClick}>
                      <div className="h-24 bg-muted rounded-md flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">
                          Detailed property information pages
                        </span>
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("property_photos") && (
                    <PreviewSection title="Property Photos" icon={ImageIcon} sectionId="property_photos" onClick={handlePreviewSectionClick}>
                      <div className="h-24 bg-muted rounded-md flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">
                          Photo gallery ({photoLayout === "all" ? "All" : "First 12"} photos)
                        </span>
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("online_valuation") && (
                    <PreviewSection title="Online Valuation Analysis" icon={BarChart3} sectionId="online_valuation" onClick={handlePreviewSectionClick}>
                      <div className="space-y-3">
                        <div className="p-3 bg-muted/50 rounded-md border border-dashed">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">Online Valuations vs. Actual Sale Prices</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This section compares automated valuation models (Zestimate, Redfin Estimate) 
                            against actual closed sale prices to demonstrate accuracy variance.
                          </p>
                          <div className="mt-3 pt-3 border-t border-dashed">
                            <p className="text-xs text-muted-foreground italic">
                              Note: Online valuation data requires Zillow API integration. Contact your administrator to enable this feature.
                            </p>
                          </div>
                        </div>
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("price_per_sqft") && (
                    <PreviewSection title="Average Price Per Sq. Ft." icon={BarChart3} sectionId="price_per_sqft" onClick={handlePreviewSectionClick}>
                      <div className="space-y-3">
                        {pricePerSqftData.length > 0 ? (
                          <>
                            <div className="h-40">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pricePerSqftData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 9 }} 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={50}
                                    interval={0}
                                  />
                                  <YAxis 
                                    tick={{ fontSize: 10 }} 
                                    tickFormatter={(value) => `$${value}`}
                                    width={50}
                                  />
                                  <Tooltip 
                                    formatter={(value: number) => [`$${value}/sqft`, "Price/SqFt"]}
                                    labelFormatter={(label) => pricePerSqftData.find(d => d.name === label)?.fullAddress || label}
                                  />
                                  <ReferenceLine 
                                    y={statistics.avgPricePerSqft} 
                                    stroke="hsl(var(--primary))" 
                                    strokeDasharray="5 5"
                                    label={{ value: `Avg: $${Math.round(statistics.avgPricePerSqft)}`, fontSize: 10, fill: 'hsl(var(--primary))' }}
                                  />
                                  <Bar dataKey="pricePerSqft" radius={[2, 2, 0, 0]}>
                                    {pricePerSqftData.map((entry, index) => (
                                      <Cell 
                                        key={`cell-${index}`}
                                        fill={entry.isSubject ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex items-center justify-center gap-4 text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-primary" />
                                <span>Subject Property</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
                                <span>Comparables</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="h-24 bg-muted rounded-md flex items-center justify-center">
                            <span className="text-muted-foreground text-sm">
                              No property data available for chart
                            </span>
                          </div>
                        )}
                      </div>
                    </PreviewSection>
                  )}

                  {includedSections.includes("comparable_stats") && (
                    <PreviewSection title="Comparable Property Statistics" icon={Table} sectionId="comparable_stats" onClick={handlePreviewSectionClick}>
                      {statistics.propertyCount > 0 ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <StatCard 
                              label="Average Price" 
                              value={formatCurrency(statistics.avgPrice)}
                              subValue={`Median: ${formatCurrency(statistics.medianPrice)}`}
                            />
                            <StatCard 
                              label="Avg Price/SqFt" 
                              value={`$${formatNumber(statistics.avgPricePerSqft)}`}
                              subValue={`Median: $${formatNumber(statistics.medianPricePerSqft)}`}
                            />
                            <StatCard 
                              label="Avg Living Area" 
                              value={`${formatNumber(statistics.avgLivingArea)} sqft`}
                              subValue={`Range: ${formatNumber(statistics.sqftRange.min)} - ${formatNumber(statistics.sqftRange.max)}`}
                            />
                            <StatCard 
                              label="Avg Bed/Bath" 
                              value={`${statistics.avgBedrooms.toFixed(1)} / ${statistics.avgBathrooms.toFixed(1)}`}
                              subValue={`${statistics.propertyCount} properties analyzed`}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">
                            No comparable properties in this CMA
                          </span>
                        </div>
                      )}
                    </PreviewSection>
                  )}

                  {includeAgentFooter && (
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={agentProfile?.headshotUrl ?? undefined} />
                            <AvatarFallback className="text-xs">{userName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{userName}</span>
                          {companySettings?.phone && (
                            <>
                              <span className="mx-1">·</span>
                              <span>{companySettings.phone}</span>
                            </>
                          )}
                        </div>
                        <span>{companySettings?.companyName || "Spyglass Realty"}</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <ExpandedPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        sectionsEnabled={includedSections.length}
      >
        <div className="p-4 space-y-4">
          {includedSections.includes("cover_page") && (
            <PreviewSection title="Cover Page" icon={FileText} sectionId="cover_page" onClick={handlePreviewSectionClick}>
              <div className="text-center space-y-4">
                {companySettings?.logoUrl ? (
                  <img
                    src={companySettings.logoUrl}
                    alt="Company Logo"
                    className="h-12 mx-auto object-contain"
                  />
                ) : (
                  <div className="font-bold text-xl" style={{ color: companySettings?.primaryColor ?? undefined }}>
                    {companySettings?.companyName || "Spyglass Realty"}
                  </div>
                )}
                <div className="text-2xl font-bold">
                  Comparative Market Analysis
                </div>
                <div className="text-muted-foreground">{cma?.name}</div>
                <div className="text-sm text-muted-foreground">
                  Prepared by {userName}
                </div>
              </div>
            </PreviewSection>
          )}

          {includedSections.includes("listing_brochure") && (
            <PreviewSection title="Listing Brochure" icon={ImageIcon} sectionId="listing_brochure" onClick={handlePreviewSectionClick}>
              {brochure ? (
                <div className="space-y-2">
                  <div className="aspect-[8.5/11] bg-muted rounded-lg overflow-hidden border max-h-[300px]">
                    {brochure.type === "pdf" ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <FileText className="h-8 w-8 mr-2" />
                        <span className="text-sm">{brochure.filename}</span>
                      </div>
                    ) : (
                      <img
                        src={brochure.url.startsWith("http") ? brochure.url : `/${brochure.url}`}
                        alt="Listing Brochure"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  No brochure uploaded
                </p>
              )}
            </PreviewSection>
          )}

          {includedSections.includes("cover_letter") && (
            <PreviewSection title="Cover Letter" icon={FileText} sectionId="cover_letter" onClick={handlePreviewSectionClick}>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {coverLetterOverride || agentProfile?.defaultCoverLetter || "Your personalized cover letter will appear here..."}
              </p>
            </PreviewSection>
          )}

          {includedSections.includes("agent_resume") && (
            <PreviewSection title="Agent Resume" icon={User} sectionId="agent_resume" onClick={handlePreviewSectionClick}>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={agentProfile?.headshotUrl ?? undefined} />
                  <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="font-semibold">{userName}</div>
                  <div className="text-sm text-muted-foreground">
                    {agentProfile?.title || "Real Estate Agent"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {agentProfile?.bio || "Agent bio will appear here..."}
                  </p>
                </div>
              </div>
            </PreviewSection>
          )}

          {includedSections.includes("summary_comparables") && (
            <PreviewSection title="Summary of Comparable Properties" icon={Table} sectionId="summary_comparables" onClick={handlePreviewSectionClick}>
              {statistics.propertyCount > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-muted rounded-md text-center">
                      <div className="text-muted-foreground mb-1">Avg Price</div>
                      <div className="font-semibold">{formatCurrency(statistics.avgPrice)}</div>
                    </div>
                    <div className="p-2 bg-muted rounded-md text-center">
                      <div className="text-muted-foreground mb-1">Avg $/SqFt</div>
                      <div className="font-semibold">${formatNumber(statistics.avgPricePerSqft)}</div>
                    </div>
                    <div className="p-2 bg-muted rounded-md text-center">
                      <div className="text-muted-foreground mb-1">Properties</div>
                      <div className="font-semibold">{statistics.propertyCount}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No comparable properties</span>
                </div>
              )}
            </PreviewSection>
          )}

          {includedSections.includes("comparable_stats") && (
            <PreviewSection title="Comparable Property Statistics" icon={Table} sectionId="comparable_stats" onClick={handlePreviewSectionClick}>
              {statistics.propertyCount > 0 ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <StatCard 
                    label="Average Price" 
                    value={formatCurrency(statistics.avgPrice)}
                    subValue={`Median: ${formatCurrency(statistics.medianPrice)}`}
                  />
                  <StatCard 
                    label="Avg Price/SqFt" 
                    value={`$${formatNumber(statistics.avgPricePerSqft)}`}
                    subValue={`Median: $${formatNumber(statistics.medianPricePerSqft)}`}
                  />
                </div>
              ) : (
                <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No comparable properties</span>
                </div>
              )}
            </PreviewSection>
          )}
        </div>
      </ExpandedPreviewModal>
    </div>
  );
}

function PreviewSection({
  title,
  icon: Icon,
  children,
  sectionId,
  onClick,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  sectionId?: string;
  onClick?: (sectionId: string) => void;
}) {
  const handleClick = () => {
    if (sectionId && onClick) {
      onClick(sectionId);
    }
  };

  return (
    <div 
      className={`p-4 border rounded-md space-y-3 transition-colors ${onClick ? "cursor-pointer hover:border-primary/50 hover:bg-muted/30" : ""}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="p-2 bg-muted rounded-md">
      <div className="text-muted-foreground text-xs mb-0.5">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
      {subValue && (
        <div className="text-muted-foreground text-xs mt-0.5">{subValue}</div>
      )}
    </div>
  );
}
