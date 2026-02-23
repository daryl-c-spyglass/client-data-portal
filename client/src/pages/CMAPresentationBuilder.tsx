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
import { AdjustmentsSection } from "@/components/AdjustmentsSection";
import { ExpandedPreviewModal } from "@/components/ExpandedPreviewModal";
import { MapboxCMAMap } from "@/components/presentation/MapboxCMAMap";
import { CoverLetterEditor } from "@/components/presentation/CoverLetterEditor";
import { CoverPageEditor, getDefaultCoverPageConfig, type CoverPageConfig } from "@/components/presentation/CoverPageEditor";
import { PhotoSelectionModal, type Photo } from "@/components/presentation/PhotoSelectionModal";
import { SaveAsTemplateModal } from "@/components/presentation/SaveAsTemplateModal";
import { LoadTemplateDropdown } from "@/components/presentation/LoadTemplateDropdown";
import { ExpandableList, ExpandableTable, ExpandableGrid } from "@/components/presentation/ExpandableList";
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
  type CmaAdjustmentsData,
  type CmaReportTemplate,
} from "@shared/schema";
import {
  calculateAdjustments,
  formatAdjustment,
  getUniqueFeatures,
  getPropertyId,
  DEFAULT_ADJUSTMENT_RATES,
  type PropertyForAdjustment,
  type CompAdjustmentResult,
} from "@/lib/adjustmentCalculations";

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
  mapStyle?: 'streets' | 'satellite';
  showMapPolygon?: boolean;
  includeAgentFooter?: boolean;
  customPhotoSelections?: Record<string, string[]>;
  coverPageConfig?: CoverPageConfig;
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
  { value: "ai_suggested", label: "AI Suggested (Best Quality)" },
  { value: "custom", label: "Custom Selection" },
];

interface PropertyData {
  id?: string;
  listingId?: string;
  address?: string;
  streetAddress?: string;
  unparsedAddress?: string;
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
  latitude?: number | string | null;
  longitude?: number | string | null;
  publicRemarks?: string;
  photos?: string[];
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

// Helper to construct proper brochure URL from stored path
function getBrochureUrl(url: string): string {
  if (!url) return "";
  // If it's already a full URL, return it
  if (url.startsWith("http")) return url;
  // If it already starts with /, use it directly (don't double-prefix)
  if (url.startsWith("/")) return url;
  // Otherwise, add the leading slash
  return `/${url}`;
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
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>("streets");
  const [showMapPolygon, setShowMapPolygon] = useState(true);
  const [includeAgentFooter, setIncludeAgentFooter] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    introduction: true,
    listings: true,
    analysis: true,
  });
  const [brochure, setBrochure] = useState<CmaBrochure | null>(null);
  const [adjustments, setAdjustments] = useState<CmaAdjustmentsData | null>(null);
  const [isSavingAdjustments, setIsSavingAdjustments] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoProperty, setSelectedPhotoProperty] = useState<string | null>(null);
  const [customPhotoSelections, setCustomPhotoSelections] = useState<Record<string, string[]>>({});
  const [coverPageConfig, setCoverPageConfig] = useState<CoverPageConfig>(getDefaultCoverPageConfig());
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

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
      const response = await fetch("/api/agent/profile", { cache: "no-store" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch profile");
      const data = await response.json();
      // API returns { profile: {...}, user: {...} } - unwrap and merge
      return data.profile ? {
        ...data.profile,
        // Include user picture as fallback for headshotUrl
        headshotUrl: data.profile.headshotUrl || data.user?.picture || null,
      } : null;
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
          primaryColor: "#EF4923",
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

  // Get properties from CMA data
  const properties = useMemo(() => {
    return (cma?.propertiesData || []) as PropertyData[];
  }, [cma?.propertiesData]);

  // Calculate statistics from CMA properties
  const { statistics, pricePerSqftData } = useMemo(() => {
    const allProperties = properties;
    const stats = calculateStatistics(allProperties);
    
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
  }, [properties, cma?.subjectPropertyId]);

  // Prepare property locations for the map
  const { propertyLocations, subjectLocation } = useMemo(() => {
    const subjectId = cma?.subjectPropertyId;
    
    const locations = properties
      .filter(p => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        return lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
      })
      .map(p => ({
        id: p.id || p.listingId || '',
        address: p.streetAddress || p.address || 'Unknown',
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        price: Number(p.listPrice || p.closePrice) || 0,
        status: p.standardStatus || 'Active',
        isSubject: subjectId ? (p.id === subjectId || p.listingId === subjectId) : false,
      }));
    
    const subject = locations.find(l => l.isSubject) || null;
    
    return { 
      propertyLocations: locations, 
      subjectLocation: subject 
    };
  }, [properties, cma?.subjectPropertyId]);

  useEffect(() => {
    if (reportConfig) {
      const defaultSections = CMA_REPORT_SECTIONS.filter(s => s.defaultEnabled).map(s => s.id);
      setIncludedSections(reportConfig.includedSections || defaultSections);
      setSectionOrder(reportConfig.sectionOrder || CMA_REPORT_SECTIONS.map(s => s.id));
      setCoverLetterOverride(reportConfig.coverLetterOverride || "");
      setLayout(reportConfig.layout || "two_photos");
      setPhotoLayout(reportConfig.photoLayout || "first_dozen");
      setMapStyle(reportConfig.mapStyle || "streets");
      setShowMapPolygon(reportConfig.showMapPolygon ?? true);
      setIncludeAgentFooter(reportConfig.includeAgentFooter ?? true);
      setCustomPhotoSelections(reportConfig.customPhotoSelections || {});
      setCoverPageConfig(reportConfig.coverPageConfig || getDefaultCoverPageConfig());
    } else if (!configLoading) {
      const defaultSections = CMA_REPORT_SECTIONS.filter(s => s.defaultEnabled).map(s => s.id);
      setIncludedSections(defaultSections);
      setSectionOrder(CMA_REPORT_SECTIONS.map(s => s.id));
      setCoverLetterOverride(agentProfile?.defaultCoverLetter || "");
      setCustomPhotoSelections({});
      setCoverPageConfig(getDefaultCoverPageConfig());
    }
  }, [reportConfig, configLoading, agentProfile]);

  // Initialize brochure from CMA data
  useEffect(() => {
    if (cma?.brochure) {
      setBrochure(cma.brochure);
    }
  }, [cma?.brochure]);

  // Initialize adjustments from CMA data
  useEffect(() => {
    if (cma?.adjustments) {
      setAdjustments(cma.adjustments as CmaAdjustmentsData);
    } else if (cma && !cma.adjustments) {
      // Clear stale adjustments when switching to a CMA without saved adjustments
      setAdjustments(null);
    }
  }, [cma?.adjustments, cma]);

  // Handle saving adjustments
  const handleSaveAdjustments = async (newAdjustments: CmaAdjustmentsData) => {
    if (!cmaId) return;
    setIsSavingAdjustments(true);
    try {
      const response = await fetch(`/api/cmas/${cmaId}/adjustments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustments: newAdjustments }),
      });
      if (!response.ok) throw new Error("Failed to save adjustments");
      setAdjustments(newAdjustments);
      toast({
        title: "Adjustments saved",
        description: "Your property value adjustments have been saved.",
      });
      queryClientInstance.invalidateQueries({ queryKey: ["/api/cmas", cmaId] });
    } catch (error) {
      console.error("[Adjustments] Save error:", error);
      toast({
        title: "Failed to save adjustments",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAdjustments(false);
    }
  };

  // Visual feedback when preview updates
  useEffect(() => {
    setIsPreviewUpdating(true);
    const timer = setTimeout(() => setIsPreviewUpdating(false), 300);
    return () => clearTimeout(timer);
  }, [includedSections, sectionOrder, layout, photoLayout, includeAgentFooter, coverLetterOverride, brochure, coverPageConfig]);

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

  const comparables = useMemo(() => {
    if (!cma?.propertiesData || !cma?.subjectPropertyId) return [];
    const properties = cma.propertiesData as PropertyData[];
    return properties.filter(
      p => p.id !== cma.subjectPropertyId && p.listingId !== cma.subjectPropertyId
    );
  }, [cma?.propertiesData, cma?.subjectPropertyId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const configData = {
        includedSections,
        sectionOrder,
        coverLetterOverride: coverLetterOverride || undefined,
        layout,
        photoLayout,
        mapStyle,
        showMapPolygon,
        includeAgentFooter,
        customPhotoSelections: Object.keys(customPhotoSelections).length > 0 
          ? customPhotoSelections 
          : undefined,
        coverPageConfig,
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
    setMapStyle("streets");
    setShowMapPolygon(true);
    setIncludeAgentFooter(true);
    setCustomPhotoSelections({});
    setCoverPageConfig(getDefaultCoverPageConfig());
    setHasChanges(true);
    toast({
      title: "Reset to defaults",
      description: "Settings have been reset. Save to apply.",
    });
  };

  const handleSaveAsTemplate = async (data: { name: string; isDefault: boolean }) => {
    setIsSavingTemplate(true);
    try {
      const config = {
        includedSections,
        sectionOrder,
        coverLetterOverride: coverLetterOverride || undefined,
        layout,
        photoLayout,
        mapStyle,
        showMapPolygon,
        includeAgentFooter,
        coverPageConfig,
      };

      await apiRequest("/api/report-templates", "POST", {
        name: data.name,
        isDefault: data.isDefault,
        config,
      });

      setIsTemplateModalOpen(false);
      toast({
        title: "Template saved",
        description: data.isDefault 
          ? `"${data.name}" is now your default template.`
          : `Template "${data.name}" has been saved.`,
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleApplyTemplate = (template: CmaReportTemplate) => {
    if (template.includedSections) {
      setIncludedSections(template.includedSections as CmaSectionId[]);
    }
    if (template.sectionOrder) {
      setSectionOrder(template.sectionOrder as CmaSectionId[]);
    }
    if (template.coverLetterOverride) {
      setCoverLetterOverride(template.coverLetterOverride);
    }
    if (template.layout) {
      setLayout(template.layout);
    }
    if (template.photoLayout) {
      setPhotoLayout(template.photoLayout);
    }
    if (template.mapStyle) {
      setMapStyle(template.mapStyle as 'streets' | 'satellite');
    }
    if (template.showMapPolygon !== null && template.showMapPolygon !== undefined) {
      setShowMapPolygon(template.showMapPolygon);
    }
    if (template.includeAgentFooter !== null && template.includeAgentFooter !== undefined) {
      setIncludeAgentFooter(template.includeAgentFooter);
    }
    if (template.coverPageConfig) {
      setCoverPageConfig(template.coverPageConfig);
    }
    
    toast({
      title: "Template applied",
      description: `Configuration loaded from "${template.name}".`,
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
          <LoadTemplateDropdown onApply={handleApplyTemplate} />
          <Button
            variant="outline"
            onClick={() => setIsTemplateModalOpen(true)}
            data-testid="button-save-as-template"
          >
            <FileText className="w-4 h-4 mr-2" />
            Save as Template
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

      <SaveAsTemplateModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onSave={handleSaveAsTemplate}
        isSaving={isSavingTemplate}
      />

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
                  <CardTitle className="text-lg">Cover Page</CardTitle>
                  <CardDescription>
                    Customize the title and appearance of your cover page
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CoverPageEditor
                    config={coverPageConfig}
                    onChange={(config) => {
                      setCoverPageConfig(config);
                      setHasChanges(true);
                    }}
                    cmaName={cma?.name || "CMA Report"}
                    agentInfo={{
                      name: userName,
                      brokerage: companySettings?.companyName || "Spyglass Realty",
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Cover Letter</CardTitle>
                  <CardDescription>
                    Customize the cover letter for this CMA report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CoverLetterEditor
                    value={coverLetterOverride}
                    onChange={(value) => {
                      setCoverLetterOverride(value);
                      setHasChanges(true);
                    }}
                    subjectProperty={subjectProperty}
                    properties={(cma?.propertiesData || []) as PropertyData[]}
                    statistics={statistics}
                    agentName={userName}
                    companyName={companySettings?.companyName || "Spyglass Realty"}
                  />
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
                        listPrice: subjectProperty.listPrice ?? undefined,
                        bedroomsTotal: subjectProperty.bedroomsTotal ?? undefined,
                        bathroomsTotal: subjectProperty.bathroomsTotal ?? undefined,
                        livingArea: subjectProperty.livingArea ?? undefined,
                        yearBuilt: subjectProperty.yearBuilt ?? undefined,
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Property Value Adjustments</CardTitle>
                  <CardDescription>
                    Configure adjustment rates to compare property values between subject and comparables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cmaId && (
                    <AdjustmentsSection
                      cmaId={cmaId}
                      adjustments={adjustments}
                      subjectProperty={subjectProperty as PropertyForAdjustment | null}
                      comparables={comparables.map(c => c as PropertyForAdjustment)}
                      onSave={handleSaveAdjustments}
                      isSaving={isSavingAdjustments}
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
                    
                    {photoLayout === "ai_suggested" && (
                      <p className="text-xs text-muted-foreground">
                        Photos will be automatically ranked by AI quality scores from Repliers.
                      </p>
                    )}
                    
                    {photoLayout === "custom" && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Select photos for each property in your CMA
                        </p>
                        {properties.map((property, index) => {
                          const mlsNumber = property.listingId || property.id || `prop-${index}`;
                          const address = property.streetAddress || property.address || "Unknown Property";
                          const photoCount = customPhotoSelections[mlsNumber]?.length || 0;
                          
                          return (
                            <Button
                              key={mlsNumber}
                              variant="outline"
                              className="w-full justify-between"
                              onClick={() => {
                                setSelectedPhotoProperty(mlsNumber);
                                setIsPhotoModalOpen(true);
                              }}
                              data-testid={`button-select-photos-${index}`}
                            >
                              <span className="truncate text-left flex-1">{address}</span>
                              <Badge variant="secondary" className="ml-2">
                                {photoCount} selected
                              </Badge>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              </TabsContent>
          </Tabs>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start space-y-6">
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
              <ScrollArea className="h-[500px] md:h-[600px] lg:h-[calc(100vh-200px)] lg:min-h-[600px] lg:max-h-[900px] border rounded-md scroll-smooth">
                <div className={`p-4 space-y-4 transition-opacity duration-300 ${isPreviewUpdating ? "opacity-50" : "opacity-100"}`}>
                  {includedSections.includes("cover_page") && (
                    <PreviewSection title="Cover Page" icon={FileText} sectionId="cover_page" onClick={handlePreviewSectionClick}>
                      <div 
                        className={`text-center space-y-4 p-4 rounded-md ${
                          coverPageConfig.background === "gradient" 
                            ? "bg-gradient-to-br from-spyglass-orange-light to-spyglass-orange-100" 
                            : coverPageConfig.background === "property"
                            ? "bg-gray-200"
                            : ""
                        }`}
                      >
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
                          {coverPageConfig.title || "Comparative Market Analysis"}
                        </div>
                        <div className="text-muted-foreground">
                          {coverPageConfig.subtitle || "Prepared exclusively for you"}
                        </div>
                        <div className="text-muted-foreground">{cma.name}</div>
                        {coverPageConfig.showDate !== false && (
                          <div className="text-sm text-muted-foreground">
                            {new Date().toLocaleDateString()}
                          </div>
                        )}
                        {coverPageConfig.showAgentPhoto !== false && (
                          <div className="flex justify-center items-center gap-2 mt-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={agentProfile?.headshotUrl ?? undefined} />
                              <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground">{userName}</span>
                          </div>
                        )}
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
                                src={getBrochureUrl(brochure.url)}
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
                      {propertyLocations.length > 0 ? (
                        <div className="h-48 rounded-md overflow-hidden">
                          <MapboxCMAMap
                            properties={propertyLocations}
                            subjectProperty={subjectLocation}
                            style={mapStyle}
                            showPolygon={showMapPolygon}
                            height="192px"
                            onStyleChange={(s) => {
                              setMapStyle(s);
                              setHasChanges(true);
                            }}
                            onPolygonChange={(v) => {
                              setShowMapPolygon(v);
                              setHasChanges(true);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-32 bg-muted rounded-md flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">
                            No properties with location data available
                          </span>
                        </div>
                      )}
                    </PreviewSection>
                  )}

                  {includedSections.includes("listings_header") && (
                    <PreviewSection title="Listings Chapter Header" icon={FileText} sectionId="listings_header" onClick={handlePreviewSectionClick}>
                      <div className="text-center py-4 bg-muted/30 rounded-md border-l-4 border-primary">
                        <span className="text-lg font-semibold">Comparable Properties</span>
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
                      {properties.length > 0 ? (
                        <ExpandableList
                          items={properties}
                          initialCount={3}
                          itemLabel="properties"
                          renderItem={(property, index) => (
                            <div key={property.id || property.listingId || index} className="p-2 bg-muted rounded-md">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {property.streetAddress || property.address || "Address"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {property.city}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs ml-2 shrink-0">
                                  {property.standardStatus || "Active"}
                                </Badge>
                              </div>
                              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{formatCurrency(Number(property.listPrice || property.closePrice) || 0)}</span>
                                <span>{property.bedroomsTotal ?? "—"} bd</span>
                                <span>{property.bathroomsTotal ?? "—"} ba</span>
                                <span>{property.livingArea ? `${formatNumber(Number(property.livingArea))} sqft` : "— sqft"}</span>
                              </div>
                            </div>
                          )}
                        />
                      ) : (
                        <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">No properties in this CMA</span>
                        </div>
                      )}
                    </PreviewSection>
                  )}

                  {includedSections.includes("property_photos") && (
                    <PreviewSection title="Property Photos" icon={ImageIcon} sectionId="property_photos" onClick={handlePreviewSectionClick}>
                      {(() => {
                        const allPhotos: { url: string; address: string }[] = [];
                        properties.forEach(p => {
                          (p.photos || []).slice(0, 2).forEach(url => {
                            allPhotos.push({ url, address: p.streetAddress || p.address || "" });
                          });
                        });
                        
                        return allPhotos.length > 0 ? (
                          <ExpandableGrid
                            items={allPhotos}
                            initialCount={6}
                            itemLabel="photos"
                            columns={3}
                            renderItem={(photo, index) => (
                              <div key={index} className="aspect-video bg-muted rounded overflow-hidden">
                                <img 
                                  src={photo.url} 
                                  alt={`Property ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                          />
                        ) : (
                          <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                            <span className="text-muted-foreground text-sm">No photos available</span>
                          </div>
                        );
                      })()}
                    </PreviewSection>
                  )}

                  {includedSections.includes("adjustments") && (
                    <PreviewSection title="Adjustments" icon={Table} sectionId="adjustments" onClick={handlePreviewSectionClick}>
                      {(() => {
                        const rates = adjustments?.rates || DEFAULT_ADJUSTMENT_RATES;
                        const results = subjectProperty && comparables.length > 0
                          ? comparables.map((comp) => {
                              const compId = getPropertyId(comp as PropertyForAdjustment);
                              const compOverrides = adjustments?.compAdjustments?.[compId];
                              return calculateAdjustments(subjectProperty as PropertyForAdjustment, comp as PropertyForAdjustment, rates, compOverrides);
                            })
                          : [];
                        
                        if (results.length === 0) {
                          return (
                            <div className="h-24 bg-muted rounded-md flex items-center justify-center">
                              <span className="text-muted-foreground text-sm">
                                No comparable properties to show adjustments
                              </span>
                            </div>
                          );
                        }

                        return (
                          <ExpandableTable
                            items={results}
                            initialCount={3}
                            itemLabel="comparables"
                            header={
                              <tr className="border-b">
                                <th className="text-left p-1.5 font-medium">Property</th>
                                <th className="text-right p-1.5 font-medium">Close Price</th>
                                <th className="text-right p-1.5 font-medium">Adj. Total</th>
                                <th className="text-right p-1.5 font-medium">Adj. Price</th>
                              </tr>
                            }
                            renderRow={(result: CompAdjustmentResult) => (
                              <tr key={result.compId} className="border-b border-muted">
                                <td className="p-1.5 truncate max-w-[120px]">{result.compAddress}</td>
                                <td className="text-right p-1.5">${(result.salePrice / 1000).toFixed(0)}k</td>
                                <td className={`text-right p-1.5 ${result.totalAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatAdjustment(result.totalAdjustment)}
                                </td>
                                <td className="text-right p-1.5 font-medium">${(result.adjustedPrice / 1000).toFixed(0)}k</td>
                              </tr>
                            )}
                          />
                        );
                      })()}
                    </PreviewSection>
                  )}

                  {includedSections.includes("analysis_header") && (
                    <PreviewSection title="Analysis Chapter Header" icon={FileText} sectionId="analysis_header" onClick={handlePreviewSectionClick}>
                      <div className="text-center py-4 bg-muted/30 rounded-md border-l-4 border-primary">
                        <span className="text-lg font-semibold">Market Analysis</span>
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
              <div 
                className={`text-center space-y-4 p-4 rounded-md ${
                  coverPageConfig.background === "gradient" 
                    ? "bg-gradient-to-br from-spyglass-orange-light to-spyglass-orange-100" 
                    : coverPageConfig.background === "property"
                    ? "bg-gray-200"
                    : ""
                }`}
              >
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
                  {coverPageConfig.title || "Comparative Market Analysis"}
                </div>
                <div className="text-muted-foreground">
                  {coverPageConfig.subtitle || "Prepared exclusively for you"}
                </div>
                <div className="text-muted-foreground">{cma?.name}</div>
                {coverPageConfig.showDate !== false && (
                  <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </div>
                )}
                {coverPageConfig.showAgentPhoto !== false && (
                  <div className="flex justify-center items-center gap-2 mt-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={agentProfile?.headshotUrl ?? undefined} />
                      <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{userName}</span>
                  </div>
                )}
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
                        src={getBrochureUrl(brochure.url)}
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

          {includedSections.includes("our_company") && (
            <PreviewSection title="Our Company" icon={Building2} sectionId="our_company" onClick={handlePreviewSectionClick}>
              <div className="space-y-2">
                <div className="font-semibold">
                  {companySettings?.companyName || "Spyglass Realty"}
                </div>
                <p className="text-sm text-muted-foreground">Company profile and information</p>
              </div>
            </PreviewSection>
          )}

          {includedSections.includes("what_is_cma") && (
            <PreviewSection title="What is a CMA?" icon={FileText} sectionId="what_is_cma" onClick={handlePreviewSectionClick}>
              <p className="text-sm text-muted-foreground">
                A Comparative Market Analysis (CMA) is a detailed report that helps determine the value of a property.
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
              {propertyLocations.length > 0 ? (
                <div className="h-64 rounded-md overflow-hidden">
                  <MapboxCMAMap
                    properties={propertyLocations}
                    subjectProperty={subjectLocation}
                    style={mapStyle}
                    showPolygon={showMapPolygon}
                    height="256px"
                    onStyleChange={(s) => {
                      setMapStyle(s);
                      setHasChanges(true);
                    }}
                    onPolygonChange={(v) => {
                      setShowMapPolygon(v);
                      setHasChanges(true);
                    }}
                  />
                </div>
              ) : (
                <div className="h-32 bg-muted rounded-md flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">
                    No properties with location data available
                  </span>
                </div>
              )}
            </PreviewSection>
          )}

          {includedSections.includes("listings_header") && (
            <PreviewSection title="Listings Chapter Header" icon={FileText} sectionId="listings_header" onClick={handlePreviewSectionClick}>
              <div className="text-center py-4 bg-muted/30 rounded-md border-l-4 border-primary">
                <span className="text-lg font-semibold">Comparable Properties</span>
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

          {includedSections.includes("property_details") && (
            <PreviewSection title="Property Details" icon={Home} sectionId="property_details" onClick={handlePreviewSectionClick}>
              {properties.length > 0 ? (
                <div className="space-y-2">
                  {properties.slice(0, 4).map((property, index) => (
                    <div key={property.id || property.listingId || index} className="p-2 bg-muted rounded-md">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {property.streetAddress || property.address || "Address"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {property.city}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs ml-2 shrink-0">
                          {property.standardStatus || "Active"}
                        </Badge>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatCurrency(Number(property.listPrice || property.closePrice) || 0)}</span>
                        <span>{property.bedroomsTotal ?? "—"} bd</span>
                        <span>{property.bathroomsTotal ?? "—"} ba</span>
                        <span>{property.livingArea ? `${formatNumber(Number(property.livingArea))} sqft` : "— sqft"}</span>
                      </div>
                    </div>
                  ))}
                  {properties.length > 4 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{properties.length - 4} more properties
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No properties in this CMA</span>
                </div>
              )}
            </PreviewSection>
          )}

          {includedSections.includes("property_photos") && (
            <PreviewSection title="Property Photos" icon={ImageIcon} sectionId="property_photos" onClick={handlePreviewSectionClick}>
              {(() => {
                const allPhotos: { url: string; address: string }[] = [];
                properties.forEach(p => {
                  (p.photos || []).slice(0, 3).forEach(url => {
                    allPhotos.push({ url, address: p.streetAddress || p.address || "" });
                  });
                });
                const displayPhotos = allPhotos.slice(0, 9);
                
                return displayPhotos.length > 0 ? (
                  <div>
                    <div className="grid grid-cols-3 gap-2">
                      {displayPhotos.map((photo, index) => (
                        <div key={index} className="aspect-video bg-muted rounded overflow-hidden">
                          <img 
                            src={photo.url} 
                            alt={`Property ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {allPhotos.length > 9 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        +{allPhotos.length - 9} more photos in full report
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="h-20 bg-muted rounded-md flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">No photos available</span>
                  </div>
                );
              })()}
            </PreviewSection>
          )}

          {includedSections.includes("adjustments") && (
            <PreviewSection title="Adjustments" icon={Table} sectionId="adjustments" onClick={handlePreviewSectionClick}>
              {(() => {
                const rates = adjustments?.rates || DEFAULT_ADJUSTMENT_RATES;
                const results = subjectProperty && comparables.length > 0
                  ? comparables.map((comp) => {
                      const compId = getPropertyId(comp as PropertyForAdjustment);
                      const compOverrides = adjustments?.compAdjustments?.[compId];
                      return calculateAdjustments(subjectProperty as PropertyForAdjustment, comp as PropertyForAdjustment, rates, compOverrides);
                    })
                  : [];
                
                if (results.length === 0) {
                  return (
                    <div className="h-24 bg-muted rounded-md flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">
                        No comparable properties to show adjustments
                      </span>
                    </div>
                  );
                }

                // Get all unique features across all results
                const allFeatures = getUniqueFeatures(results);
                // Show max 4 feature columns to keep table manageable
                const displayFeatures = allFeatures.slice(0, 4);

                // Helper to get adjustment value by feature name
                const getAdjValue = (result: CompAdjustmentResult, feature: string): number => {
                  const adj = result.adjustments.find(a => a.feature === feature);
                  return adj?.adjustment || 0;
                };

                // Short labels for features
                const getFeatureLabel = (feature: string): string => {
                  const labels: Record<string, string> = {
                    'Square Feet': 'Sq Ft',
                    'Bedrooms': 'Beds',
                    'Bathrooms': 'Baths',
                    'Pool': 'Pool',
                    'Garage Spaces': 'Garage',
                    'Year Built': 'Year',
                    'Lot Size': 'Lot',
                  };
                  return labels[feature] || feature;
                };

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Property</th>
                          <th className="text-right p-2 font-medium">Close Price</th>
                          {displayFeatures.map(feature => (
                            <th key={feature} className="text-right p-2 font-medium">{getFeatureLabel(feature)}</th>
                          ))}
                          <th className="text-right p-2 font-medium">Total Adj</th>
                          <th className="text-right p-2 font-medium">Adj. Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.slice(0, 5).map((result: CompAdjustmentResult) => (
                          <tr key={result.compId} className="border-b border-muted">
                            <td className="p-2 truncate max-w-[200px]">{result.compAddress}</td>
                            <td className="text-right p-2">${(result.salePrice / 1000).toFixed(0)}k</td>
                            {displayFeatures.map(feature => {
                              const adjVal = getAdjValue(result, feature);
                              return (
                                <td key={feature} className={`text-right p-2 ${adjVal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatAdjustment(adjVal)}
                                </td>
                              );
                            })}
                            <td className={`text-right p-2 font-medium ${result.totalAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatAdjustment(result.totalAdjustment)}
                            </td>
                            <td className="text-right p-2 font-bold">${(result.adjustedPrice / 1000).toFixed(0)}k</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {allFeatures.length > 4 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        +{allFeatures.length - 4} more adjustment types in full report
                      </p>
                    )}
                    {results.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        +{results.length - 5} more comparables in full report
                      </p>
                    )}
                  </div>
                );
              })()}
            </PreviewSection>
          )}

          {includedSections.includes("analysis_header") && (
            <PreviewSection title="Analysis Chapter Header" icon={FileText} sectionId="analysis_header" onClick={handlePreviewSectionClick}>
              <div className="text-center py-4 bg-muted/30 rounded-md border-l-4 border-primary">
                <span className="text-lg font-semibold">Market Analysis</span>
              </div>
            </PreviewSection>
          )}

          {includedSections.includes("online_valuation") && (
            <PreviewSection title="Online Valuation Analysis" icon={BarChart3} sectionId="online_valuation" onClick={handlePreviewSectionClick}>
              <div className="p-3 bg-muted/50 rounded-md border border-dashed">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Online Valuations vs. Actual Sale Prices</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Comparison of automated valuation models against actual closed sale prices.
                </p>
              </div>
            </PreviewSection>
          )}

          {includedSections.includes("price_per_sqft") && (
            <PreviewSection title="Average Price Per Sq. Ft." icon={BarChart3} sectionId="price_per_sqft" onClick={handlePreviewSectionClick}>
              {pricePerSqftData.length > 0 ? (
                <div className="space-y-2">
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
                        />
                        <Bar dataKey="pricePerSqft" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Average: ${formatNumber(statistics.avgPricePerSqft)}/sqft
                  </div>
                </div>
              ) : (
                <div className="h-32 bg-muted rounded-md flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No price data available</span>
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

      {selectedPhotoProperty && (
        <PhotoSelectionModalWrapper
          isOpen={isPhotoModalOpen}
          onClose={() => {
            setIsPhotoModalOpen(false);
            setSelectedPhotoProperty(null);
          }}
          mlsNumber={selectedPhotoProperty}
          selectedPhotos={customPhotoSelections[selectedPhotoProperty] || []}
          onSelectionChange={(urls) => {
            setCustomPhotoSelections(prev => ({
              ...prev,
              [selectedPhotoProperty]: urls,
            }));
            setHasChanges(true);
          }}
          propertyAddress={
            properties.find(p => (p.listingId || p.id) === selectedPhotoProperty)?.streetAddress ||
            properties.find(p => (p.listingId || p.id) === selectedPhotoProperty)?.address ||
            "Property"
          }
        />
      )}
    </div>
  );
}

function PhotoSelectionModalWrapper({
  isOpen,
  onClose,
  mlsNumber,
  selectedPhotos,
  onSelectionChange,
  propertyAddress,
}: {
  isOpen: boolean;
  onClose: () => void;
  mlsNumber: string;
  selectedPhotos: string[];
  onSelectionChange: (urls: string[]) => void;
  propertyAddress: string;
}) {
  const { data: photoInsights, isLoading } = useQuery<{
    photos: Photo[];
    hasInsights: boolean;
  }>({
    queryKey: ["/api/repliers/listings", mlsNumber, "photo-insights"],
    enabled: isOpen && !!mlsNumber,
    queryFn: async () => {
      const response = await fetch(`/api/repliers/listings/${mlsNumber}/photo-insights`);
      if (!response.ok) {
        // Fall back to basic photos if insights not available
        return { photos: [], hasInsights: false };
      }
      return response.json();
    },
  });

  const photos: Photo[] = photoInsights?.photos || [];

  return (
    <PhotoSelectionModal
      isOpen={isOpen}
      onClose={onClose}
      photos={photos}
      selectedPhotos={selectedPhotos}
      onSelectionChange={onSelectionChange}
      maxPhotos={12}
      propertyAddress={propertyAddress}
      isLoading={isLoading}
    />
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
