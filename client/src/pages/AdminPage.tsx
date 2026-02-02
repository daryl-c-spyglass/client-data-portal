import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield,
  Building2,
  FileText,
  Users,
  Palette,
  Loader2,
  Plus,
  Trash2,
  Edit,
  RotateCcw,
  Save,
  GripVertical,
  Crown,
  Lock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompanySettings {
  id?: string;
  companyName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
  whatIsCmaContent?: string;
  ourCompanyContent?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

interface CustomReportPage {
  id: string;
  title: string;
  content?: string;
  pdfUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  phone?: string;
  company?: string;
  picture?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("company");

  // Check if user is admin
  const { data: currentUser, isLoading: isLoadingUser } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
  });

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  // Show loading while checking auth
  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show access denied for non-admins
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="p-4 bg-destructive/10 rounded-full">
          <Lock className="w-12 h-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have permission to access the Admin Panel. 
          Please contact your administrator if you believe this is an error.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  // Company settings state
  const [companyForm, setCompanyForm] = useState<CompanySettings>({
    companyName: "Spyglass Realty",
    primaryColor: "#EF4923",
    secondaryColor: "#1E3A5F",
    accentColor: "#FFFFFF",
  });
  const [originalCompany, setOriginalCompany] = useState(companyForm);
  const [hasCompanyChanges, setHasCompanyChanges] = useState(false);

  // Custom page dialog state
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CustomReportPage | null>(null);
  const [pageForm, setPageForm] = useState({ title: '', content: '', pdfUrl: '', isActive: true });

  // Fetch company settings
  const { data: companySettings, isLoading: isLoadingCompany } = useQuery<CompanySettings>({
    queryKey: ["/api/admin/company-settings"],
    enabled: activeTab === "company",
  });

  // Fetch custom pages
  const { data: customPages = [], isLoading: isLoadingPages } = useQuery<CustomReportPage[]>({
    queryKey: ["/api/admin/custom-pages"],
    enabled: activeTab === "pages",
  });

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: activeTab === "users",
  });

  // Populate company form when data is fetched
  useEffect(() => {
    if (companySettings) {
      const form = {
        companyName: companySettings.companyName || "Spyglass Realty",
        logoUrl: companySettings.logoUrl || '',
        address: companySettings.address || '',
        phone: companySettings.phone || '',
        website: companySettings.website || '',
        description: companySettings.description || '',
        whatIsCmaContent: companySettings.whatIsCmaContent || '',
        ourCompanyContent: companySettings.ourCompanyContent || '',
        primaryColor: companySettings.primaryColor || "#EF4923",
        secondaryColor: companySettings.secondaryColor || "#1E3A5F",
        accentColor: companySettings.accentColor || "#FFFFFF",
      };
      setCompanyForm(form);
      setOriginalCompany(form);
      setHasCompanyChanges(false);
    }
  }, [companySettings]);

  // Track company changes
  useEffect(() => {
    const changed = JSON.stringify(companyForm) !== JSON.stringify(originalCompany);
    setHasCompanyChanges(changed);
  }, [companyForm, originalCompany]);

  // Save company settings mutation
  const saveCompanyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/admin/company-settings", "PUT", companyForm);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/company-settings"] });
      setOriginalCompany(companyForm);
      setHasCompanyChanges(false);
      toast({
        title: "Settings saved",
        description: "Company settings have been updated successfully.",
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

  // Create/update custom page mutation
  const savePageMutation = useMutation({
    mutationFn: async () => {
      const url = editingPage 
        ? `/api/admin/custom-pages/${editingPage.id}` 
        : "/api/admin/custom-pages";
      const method = editingPage ? "PUT" : "POST";
      const response = await apiRequest(url, method, pageForm);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save page");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-pages"] });
      setIsPageDialogOpen(false);
      setEditingPage(null);
      setPageForm({ title: '', content: '', pdfUrl: '', isActive: true });
      toast({
        title: "Page saved",
        description: editingPage ? "Custom page updated successfully." : "Custom page created successfully.",
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

  // Delete custom page mutation
  const deletePageMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/admin/custom-pages/${id}`, "DELETE");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete page");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-pages"] });
      toast({
        title: "Page deleted",
        description: "Custom page has been deleted.",
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

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest(`/api/admin/users/${userId}`, "PUT", { role });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User updated",
        description: "User role has been updated successfully.",
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

  const openEditPage = (page: CustomReportPage) => {
    setEditingPage(page);
    setPageForm({
      title: page.title,
      content: page.content || '',
      pdfUrl: page.pdfUrl || '',
      isActive: page.isActive,
    });
    setIsPageDialogOpen(true);
  };

  const openNewPage = () => {
    setEditingPage(null);
    setPageForm({ title: '', content: '', pdfUrl: '', isActive: true });
    setIsPageDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage company settings, custom pages, and users
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="company" className="flex items-center gap-2" data-testid="tab-company">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Company</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="flex items-center gap-2" data-testid="tab-pages">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Custom Pages</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
        </TabsList>

        {/* Company Settings Tab */}
        <TabsContent value="company" className="space-y-6">
          {isLoadingCompany ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Company Information
                  </CardTitle>
                  <CardDescription>
                    Branding information displayed on all CMA reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-6">
                    <div className="flex flex-col items-center gap-2">
                      {companyForm.logoUrl ? (
                        <img 
                          src={companyForm.logoUrl} 
                          alt="Company logo" 
                          className="w-24 h-24 object-contain rounded border"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-muted rounded border flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <Label className="text-xs text-muted-foreground">Logo</Label>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="logoUrl">Logo URL</Label>
                      <Input 
                        id="logoUrl"
                        placeholder="https://example.com/logo.png" 
                        value={companyForm.logoUrl || ''}
                        onChange={(e) => setCompanyForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                        data-testid="input-logo-url" 
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input 
                        id="companyName"
                        placeholder="Spyglass Realty" 
                        value={companyForm.companyName || ''}
                        onChange={(e) => setCompanyForm(prev => ({ ...prev, companyName: e.target.value }))}
                        data-testid="input-company-name" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Phone</Label>
                      <Input 
                        id="companyPhone"
                        placeholder="(512) 555-0123" 
                        value={companyForm.phone || ''}
                        onChange={(e) => setCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                        data-testid="input-company-phone" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyAddress">Address</Label>
                      <Input 
                        id="companyAddress"
                        placeholder="123 Main St, Austin, TX 78701" 
                        value={companyForm.address || ''}
                        onChange={(e) => setCompanyForm(prev => ({ ...prev, address: e.target.value }))}
                        data-testid="input-company-address" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyWebsite">Website</Label>
                      <Input 
                        id="companyWebsite"
                        placeholder="https://spyglassrealty.com" 
                        value={companyForm.website || ''}
                        onChange={(e) => setCompanyForm(prev => ({ ...prev, website: e.target.value }))}
                        data-testid="input-company-website" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyDescription">Company Description</Label>
                    <Textarea 
                      id="companyDescription"
                      placeholder="Brief description of your company..."
                      value={companyForm.description || ''}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, description: e.target.value }))}
                      className="min-h-[80px]"
                      data-testid="textarea-company-description"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Brand Colors
                  </CardTitle>
                  <CardDescription>
                    Color scheme used in CMA report templates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Primary Color</Label>
                      <div className="flex gap-2">
                        <div 
                          className="w-10 h-10 rounded border" 
                          style={{ backgroundColor: companyForm.primaryColor || '#EF4923' }}
                        />
                        <Input 
                          id="primaryColor"
                          placeholder="#EF4923" 
                          value={companyForm.primaryColor || ''}
                          onChange={(e) => setCompanyForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                          data-testid="input-primary-color" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondaryColor">Secondary Color</Label>
                      <div className="flex gap-2">
                        <div 
                          className="w-10 h-10 rounded border" 
                          style={{ backgroundColor: companyForm.secondaryColor || '#1E3A5F' }}
                        />
                        <Input 
                          id="secondaryColor"
                          placeholder="#1E3A5F" 
                          value={companyForm.secondaryColor || ''}
                          onChange={(e) => setCompanyForm(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          data-testid="input-secondary-color" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accentColor">Accent Color</Label>
                      <div className="flex gap-2">
                        <div 
                          className="w-10 h-10 rounded border" 
                          style={{ backgroundColor: companyForm.accentColor || '#FFFFFF' }}
                        />
                        <Input 
                          id="accentColor"
                          placeholder="#FFFFFF" 
                          value={companyForm.accentColor || ''}
                          onChange={(e) => setCompanyForm(prev => ({ ...prev, accentColor: e.target.value }))}
                          data-testid="input-accent-color" 
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Report Content
                  </CardTitle>
                  <CardDescription>
                    Default content for CMA report sections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatIsCma">"What is a CMA?" Content</Label>
                    <Textarea 
                      id="whatIsCma"
                      placeholder="A Comparative Market Analysis (CMA) is a report that helps determine the market value of a property..."
                      value={companyForm.whatIsCmaContent || ''}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, whatIsCmaContent: e.target.value }))}
                      className="min-h-[120px]"
                      data-testid="textarea-what-is-cma"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ourCompany">"Our Company" Content</Label>
                    <Textarea 
                      id="ourCompany"
                      placeholder="Spyglass Realty is a full-service real estate brokerage..."
                      value={companyForm.ourCompanyContent || ''}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, ourCompanyContent: e.target.value }))}
                      className="min-h-[120px]"
                      data-testid="textarea-our-company"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCompanyForm(originalCompany);
                    setHasCompanyChanges(false);
                  }}
                  disabled={!hasCompanyChanges}
                  data-testid="button-reset-company"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Changes
                </Button>
                <Button 
                  onClick={() => saveCompanyMutation.mutate()}
                  disabled={!hasCompanyChanges || saveCompanyMutation.isPending}
                  data-testid="button-save-company"
                >
                  {saveCompanyMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Custom Pages Tab */}
        <TabsContent value="pages" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Custom Report Pages
                </CardTitle>
                <CardDescription>
                  Add custom pages to include in CMA reports
                </CardDescription>
              </div>
              <Button onClick={openNewPage} data-testid="button-add-page">
                <Plus className="w-4 h-4 mr-2" />
                Add Page
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingPages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : customPages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No custom pages yet</p>
                  <p className="text-sm">Add pages like "Resources & Links" or "Company Overview"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customPages.map((page) => (
                    <div 
                      key={page.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        <div>
                          <p className="font-medium">{page.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {page.pdfUrl ? 'PDF Upload' : 'Rich Text Content'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={page.isActive ? "default" : "secondary"}>
                          {page.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditPage(page)}
                          data-testid={`button-edit-page-${page.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              data-testid={`button-delete-page-${page.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Custom Page</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{page.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePageMutation.mutate(page.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Page Dialog */}
          <Dialog open={isPageDialogOpen} onOpenChange={setIsPageDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPage ? "Edit Custom Page" : "Add Custom Page"}</DialogTitle>
                <DialogDescription>
                  Create a custom page to include in your CMA reports
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="pageTitle">Page Title</Label>
                  <Input 
                    id="pageTitle"
                    placeholder="Spyglass Resources & Links" 
                    value={pageForm.title}
                    onChange={(e) => setPageForm(prev => ({ ...prev, title: e.target.value }))}
                    data-testid="input-page-title" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pageContent">Page Content (HTML/Markdown)</Label>
                  <Textarea 
                    id="pageContent"
                    placeholder="Enter the content for this page..."
                    value={pageForm.content}
                    onChange={(e) => setPageForm(prev => ({ ...prev, content: e.target.value }))}
                    className="min-h-[200px] font-mono text-sm"
                    data-testid="textarea-page-content"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pagePdfUrl">Or PDF URL (optional)</Label>
                  <Input 
                    id="pagePdfUrl"
                    placeholder="https://example.com/document.pdf" 
                    value={pageForm.pdfUrl}
                    onChange={(e) => setPageForm(prev => ({ ...prev, pdfUrl: e.target.value }))}
                    data-testid="input-page-pdf-url" 
                  />
                  <p className="text-xs text-muted-foreground">If provided, the PDF will be embedded in the report</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    id="pageActive"
                    checked={pageForm.isActive}
                    onCheckedChange={(checked) => setPageForm(prev => ({ ...prev, isActive: checked }))}
                    data-testid="switch-page-active"
                  />
                  <Label htmlFor="pageActive">Active (include in reports)</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPageDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => savePageMutation.mutate()}
                  disabled={!pageForm.title || savePageMutation.isPending}
                  data-testid="button-save-page"
                >
                  {savePageMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Page'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage agent accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div 
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.picture || undefined} alt={user.firstName || 'User'} />
                          <AvatarFallback>
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            {user.role === 'admin' && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select
                          value={user.role}
                          onValueChange={(role) => updateUserRoleMutation.mutate({ userId: user.id, role })}
                        >
                          <SelectTrigger className="w-[120px]" data-testid={`select-role-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
