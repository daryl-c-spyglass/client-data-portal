import { useState, useEffect, useMemo, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  PRICE_FORMAT_OPTIONS,
  AREA_UNIT_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DEFAULT_PREFERENCES,
  type PriceFormat,
  type AreaUnit,
  type DateFormatType,
} from "@/lib/formatters";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
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
  ExternalLink,
  RotateCcw,
  Camera,
  Briefcase,
  FileText,
  Globe,
  Loader2,
  Upload,
  Trash2
} from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin, SiX } from "react-icons/si";

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

interface DisplayPreferencesData {
  id: string;
  priceFormat: PriceFormat;
  areaUnit: AreaUnit;
  dateFormat: DateFormatType;
  includeAgentBranding: boolean;
  includeMarketStats: boolean;
  updatedAt: string;
}

interface AgentProfile {
  id?: string;
  userId?: string;
  title?: string;
  headshotUrl?: string;
  bio?: string;
  defaultCoverLetter?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  zillowProfileUrl?: string;
  realSatisfiedId?: string;
  ratedAgentId?: string;
}

interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  picture?: string;
}

interface AgentProfileResponse {
  profile: AgentProfile | null;
  user: UserData | null;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [copied, setCopied] = useState(false);
  const [embedWidth, setEmbedWidth] = useState("600");
  const [embedHeight, setEmbedHeight] = useState("800");

  // Agent profile state
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    headshotUrl: '',
    bio: '',
    defaultCoverLetter: '',
    websiteUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
  });
  const [originalProfile, setOriginalProfile] = useState(profileForm);
  const [hasProfileChanges, setHasProfileChanges] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `profile_photo_${Date.now()}.${file.name.split(".").pop()}`,
          contentType: file.type,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await urlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload photo");
      }

      const photoUrl = objectPath.startsWith("/") ? objectPath : `/${objectPath}`;
      setProfileForm(prev => ({ ...prev, headshotUrl: photoUrl }));
      
      toast({
        title: "Photo uploaded",
        description: "Your profile photo has been uploaded. Don't forget to save your changes.",
      });
    } catch (error) {
      console.error("Photo upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhoto = () => {
    setProfileForm(prev => ({ ...prev, headshotUrl: '' }));
  };

  // Fetch agent profile
  const { data: agentProfileData, isLoading: isLoadingProfile } = useQuery<AgentProfileResponse>({
    queryKey: ["/api/agent/profile"],
    enabled: activeTab === "profile",
  });

  // Populate profile form when data is fetched
  useEffect(() => {
    if (agentProfileData) {
      const form = {
        firstName: agentProfileData.user?.firstName || '',
        lastName: agentProfileData.user?.lastName || '',
        email: agentProfileData.user?.email || '',
        phone: agentProfileData.user?.phone || '',
        company: agentProfileData.user?.company || '',
        title: agentProfileData.profile?.title || '',
        headshotUrl: agentProfileData.profile?.headshotUrl || agentProfileData.user?.picture || '',
        bio: agentProfileData.profile?.bio || '',
        defaultCoverLetter: agentProfileData.profile?.defaultCoverLetter || '',
        websiteUrl: agentProfileData.profile?.websiteUrl || '',
        facebookUrl: agentProfileData.profile?.facebookUrl || '',
        instagramUrl: agentProfileData.profile?.instagramUrl || '',
        linkedinUrl: agentProfileData.profile?.linkedinUrl || '',
        twitterUrl: agentProfileData.profile?.twitterUrl || '',
      };
      setProfileForm(form);
      setOriginalProfile(form);
      setHasProfileChanges(false);
    }
  }, [agentProfileData]);

  // Track profile changes
  useEffect(() => {
    const changed = JSON.stringify(profileForm) !== JSON.stringify(originalProfile);
    setHasProfileChanges(changed);
  }, [profileForm, originalProfile]);

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/agent/profile", "PUT", {
        profile: {
          title: profileForm.title,
          headshotUrl: profileForm.headshotUrl,
          bio: profileForm.bio,
          defaultCoverLetter: profileForm.defaultCoverLetter,
          websiteUrl: profileForm.websiteUrl,
          facebookUrl: profileForm.facebookUrl,
          instagramUrl: profileForm.instagramUrl,
          linkedinUrl: profileForm.linkedinUrl,
          twitterUrl: profileForm.twitterUrl,
        },
        user: {
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          phone: profileForm.phone,
          company: profileForm.company,
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/profile"] });
      setOriginalProfile(profileForm);
      setHasProfileChanges(false);
      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
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
  
  // Display preferences state
  const [displayPrefs, setDisplayPrefs] = useState<{
    priceFormat: PriceFormat;
    areaUnit: AreaUnit;
    dateFormat: DateFormatType;
    includeAgentBranding: boolean;
    includeMarketStats: boolean;
  }>({
    priceFormat: 'commas',
    areaUnit: 'sqft',
    dateFormat: 'MM/DD/YYYY',
    includeAgentBranding: true,
    includeMarketStats: true,
  });
  const [originalPrefs, setOriginalPrefs] = useState(displayPrefs);
  const [hasDisplayChanges, setHasDisplayChanges] = useState(false);

  // Fetch display preferences
  const { data: displayPreferencesData, isLoading: isLoadingDisplayPrefs } = useQuery<DisplayPreferencesData>({
    queryKey: ["/api/display-preferences"],
    enabled: activeTab === "display",
  });

  // Update local state when preferences are fetched
  useEffect(() => {
    if (displayPreferencesData) {
      const prefs = {
        priceFormat: displayPreferencesData.priceFormat,
        areaUnit: displayPreferencesData.areaUnit,
        dateFormat: displayPreferencesData.dateFormat,
        includeAgentBranding: displayPreferencesData.includeAgentBranding,
        includeMarketStats: displayPreferencesData.includeMarketStats,
      };
      setDisplayPrefs(prefs);
      setOriginalPrefs(prefs);
      setHasDisplayChanges(false);
    }
  }, [displayPreferencesData]);

  // Track changes
  useEffect(() => {
    const changed = 
      displayPrefs.priceFormat !== originalPrefs.priceFormat ||
      displayPrefs.areaUnit !== originalPrefs.areaUnit ||
      displayPrefs.dateFormat !== originalPrefs.dateFormat ||
      displayPrefs.includeAgentBranding !== originalPrefs.includeAgentBranding ||
      displayPrefs.includeMarketStats !== originalPrefs.includeMarketStats;
    setHasDisplayChanges(changed);
  }, [displayPrefs, originalPrefs]);

  // Save display preferences mutation
  const saveDisplayPrefsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/display-preferences", "PUT", displayPrefs);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save preferences");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/display-preferences"] });
      setOriginalPrefs(displayPrefs);
      setHasDisplayChanges(false);
      toast({
        title: "Preferences saved",
        description: "Display preferences have been updated successfully.",
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

  // Reset display preferences to defaults
  const handleResetDisplayPrefs = () => {
    setDisplayPrefs({
      priceFormat: DEFAULT_PREFERENCES.priceFormat,
      areaUnit: DEFAULT_PREFERENCES.areaUnit,
      dateFormat: DEFAULT_PREFERENCES.dateFormat,
      includeAgentBranding: DEFAULT_PREFERENCES.includeAgentBranding,
      includeMarketStats: DEFAULT_PREFERENCES.includeMarketStats,
    });
  };

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
      const response = await apiRequest("/api/lead-gate/settings", "PUT", data);
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
      const response = await apiRequest("/api/sync", "POST");
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

  const [repliersCapabilities, setRepliersCapabilities] = useState<{
    active: boolean;
    underContract: boolean;
    sold: boolean;
  } | null>(null);

  const testRepliersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/repliers/test", "GET");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Repliers connection test failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setRepliersCapabilities(data.capabilities);
      toast({
        title: data.success ? "Connection successful" : "Connection issue",
        description: data.message || "Repliers API test complete.",
        variant: data.capabilities?.sold ? "default" : "default",
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
          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Your personal information displayed on CMA reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-6">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative group">
                        <Avatar className="w-24 h-24">
                          <AvatarImage src={profileForm.headshotUrl} alt="Profile" />
                          <AvatarFallback className="text-2xl">
                            {profileForm.firstName?.[0]}{profileForm.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        {profileForm.headshotUrl && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-1 -right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handleDeletePhoto}
                            data-testid="button-delete-photo"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        data-testid="input-photo-upload"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        data-testid="button-upload-photo"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {profileForm.headshotUrl ? "Change" : "Upload"}
                      </Button>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Profile Photo</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload a professional headshot photo. Max 5MB, JPG or PNG recommended.
                        </p>
                      </div>
                      {profileForm.headshotUrl && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-muted-foreground">Photo uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName"
                        placeholder="John" 
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                        data-testid="input-first-name" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName"
                        placeholder="Smith" 
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                        data-testid="input-last-name" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email"
                        placeholder="john@example.com" 
                        type="email" 
                        value={profileForm.email}
                        disabled
                        className="bg-muted"
                        data-testid="input-email" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input 
                        id="phone"
                        placeholder="(512) 555-0123" 
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                        data-testid="input-phone" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input 
                        id="title"
                        placeholder="Broker/Owner, Realtor, Agent" 
                        value={profileForm.title}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, title: e.target.value }))}
                        data-testid="input-title" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input 
                        id="company"
                        placeholder="Spyglass Realty" 
                        value={profileForm.company}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, company: e.target.value }))}
                        data-testid="input-company" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Bio & Cover Letter
                  </CardTitle>
                  <CardDescription>
                    Your biography and default cover letter for CMA reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bio">Agent Bio / Resume</Label>
                    <Textarea 
                      id="bio"
                      placeholder="Tell clients about your experience, expertise, and what makes you the right agent for them..."
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                      className="min-h-[120px]"
                      data-testid="textarea-bio"
                    />
                    <p className="text-xs text-muted-foreground">This will appear on the Agent Resume page in your CMA reports</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverLetter">Default Cover Letter</Label>
                    <Textarea 
                      id="coverLetter"
                      placeholder="Dear [Client Name],

Thank you for the opportunity to prepare this Comparative Market Analysis for your property. This report will help you understand the current market conditions and determine the best listing price for your home..."
                      value={profileForm.defaultCoverLetter}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, defaultCoverLetter: e.target.value }))}
                      className="min-h-[150px]"
                      data-testid="textarea-cover-letter"
                    />
                    <p className="text-xs text-muted-foreground">This will be used as the default cover letter in your CMA presentations (can be customized per CMA)</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Social & Web Links
                  </CardTitle>
                  <CardDescription>
                    Your website and social media links for reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Website
                      </Label>
                      <Input 
                        id="websiteUrl"
                        placeholder="https://yourwebsite.com" 
                        value={profileForm.websiteUrl}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, websiteUrl: e.target.value }))}
                        data-testid="input-website" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facebookUrl" className="flex items-center gap-2">
                        <SiFacebook className="w-4 h-4" /> Facebook
                      </Label>
                      <Input 
                        id="facebookUrl"
                        placeholder="https://facebook.com/yourpage" 
                        value={profileForm.facebookUrl}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, facebookUrl: e.target.value }))}
                        data-testid="input-facebook" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagramUrl" className="flex items-center gap-2">
                        <SiInstagram className="w-4 h-4" /> Instagram
                      </Label>
                      <Input 
                        id="instagramUrl"
                        placeholder="https://instagram.com/yourprofile" 
                        value={profileForm.instagramUrl}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, instagramUrl: e.target.value }))}
                        data-testid="input-instagram" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                        <SiLinkedin className="w-4 h-4" /> LinkedIn
                      </Label>
                      <Input 
                        id="linkedinUrl"
                        placeholder="https://linkedin.com/in/yourprofile" 
                        value={profileForm.linkedinUrl}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                        data-testid="input-linkedin" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setProfileForm(originalProfile);
                    setHasProfileChanges(false);
                  }}
                  disabled={!hasProfileChanges}
                  data-testid="button-reset-profile"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Changes
                </Button>
                <Button 
                  onClick={() => saveProfileMutation.mutate()}
                  disabled={!hasProfileChanges || saveProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {saveProfileMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Profile'
                  )}
                </Button>
              </div>
            </>
          )}
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
                    <p className="text-xs text-muted-foreground">Closed listings from Austin Board of REALTORS</p>
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
                    <p className="text-xs text-muted-foreground">
                      {repliersCapabilities 
                        ? `Active: ${repliersCapabilities.active ? '✓' : '✗'}, AUC: ${repliersCapabilities.underContract ? '✓' : '✗'}, Closed: ${repliersCapabilities.sold ? '✓' : '✗ (not enabled)'}`
                        : 'Active/AUC listings with photos'}
                    </p>
                    {repliersCapabilities && !repliersCapabilities.sold && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Closed data requires Repliers to enable it for your feed
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>Connected</Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => testRepliersMutation.mutate()}
                    disabled={testRepliersMutation.isPending}
                    data-testid="button-test-repliers"
                  >
                    {testRepliersMutation.isPending ? 'Testing...' : 'Test'}
                  </Button>
                </div>
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
              {isLoadingDisplayPrefs ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg flex-wrap gap-2">
                    <div>
                      <p className="font-medium">Price Format</p>
                      <p className="text-sm text-muted-foreground">How prices are displayed</p>
                    </div>
                    <Select
                      value={displayPrefs.priceFormat}
                      onValueChange={(value: PriceFormat) => 
                        setDisplayPrefs(prev => ({ ...prev, priceFormat: value }))
                      }
                    >
                      <SelectTrigger className="w-[180px]" data-testid="select-price-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICE_FORMAT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg flex-wrap gap-2">
                    <div>
                      <p className="font-medium">Area Units</p>
                      <p className="text-sm text-muted-foreground">Square footage display</p>
                    </div>
                    <Select
                      value={displayPrefs.areaUnit}
                      onValueChange={(value: AreaUnit) => 
                        setDisplayPrefs(prev => ({ ...prev, areaUnit: value }))
                      }
                    >
                      <SelectTrigger className="w-[180px]" data-testid="select-area-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AREA_UNIT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg flex-wrap gap-2">
                    <div>
                      <p className="font-medium">Date Format</p>
                      <p className="text-sm text-muted-foreground">How dates are displayed</p>
                    </div>
                    <Select
                      value={displayPrefs.dateFormat}
                      onValueChange={(value: DateFormatType) => 
                        setDisplayPrefs(prev => ({ ...prev, dateFormat: value }))
                      }
                    >
                      <SelectTrigger className="w-[180px]" data-testid="select-date-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_FORMAT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
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
              <div className="flex items-center justify-between p-4 border rounded-lg flex-wrap gap-2">
                <div>
                  <p className="font-medium">Include Agent Branding</p>
                  <p className="text-sm text-muted-foreground">Show your info on shared reports</p>
                </div>
                <Switch 
                  checked={displayPrefs.includeAgentBranding}
                  onCheckedChange={(checked) => 
                    setDisplayPrefs(prev => ({ ...prev, includeAgentBranding: checked }))
                  }
                  data-testid="switch-branding" 
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg flex-wrap gap-2">
                <div>
                  <p className="font-medium">Include Market Stats</p>
                  <p className="text-sm text-muted-foreground">Show market analysis by default</p>
                </div>
                <Switch 
                  checked={displayPrefs.includeMarketStats}
                  onCheckedChange={(checked) => 
                    setDisplayPrefs(prev => ({ ...prev, includeMarketStats: checked }))
                  }
                  data-testid="switch-market-stats" 
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => saveDisplayPrefsMutation.mutate()}
                  disabled={!hasDisplayChanges || saveDisplayPrefsMutation.isPending}
                  data-testid="button-save-display-prefs"
                >
                  {saveDisplayPrefsMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetDisplayPrefs}
                  data-testid="button-reset-display-prefs"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Defaults
                </Button>
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
