import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Upload,
  FileImage,
  Trash2,
  Loader2,
  FileText,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { CmaBrochure } from "@shared/schema";

interface ListingBrochureContentProps {
  cmaId: string;
  brochure: CmaBrochure | null;
  subjectProperty?: {
    address?: string;
    streetAddress?: string;
    listPrice?: number | string;
    bedroomsTotal?: number | string;
    bathroomsTotal?: number | string;
    livingArea?: number | string;
    yearBuilt?: number | string;
    publicRemarks?: string;
    photos?: string[];
  };
  onBrochureChange?: (brochure: CmaBrochure | null) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ListingBrochureContent({
  cmaId,
  brochure,
  subjectProperty,
  onBrochureChange,
}: ListingBrochureContentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const saveBrochureMutation = useMutation({
    mutationFn: async (data: { url: string; filename: string; type: "pdf" | "image"; generated?: boolean }) => {
      const response = await apiRequest(`/api/cmas/${cmaId}/brochure`, "POST", data);
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmas", cmaId] });
      onBrochureChange?.(result.brochure);
      toast({
        title: "Brochure saved",
        description: "Your listing brochure has been added to the presentation.",
      });
    },
    onError: () => {
      toast({
        title: "Error saving brochure",
        description: "Failed to save the brochure. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteBrochureMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/cmas/${cmaId}/brochure`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmas", cmaId] });
      onBrochureChange?.(null);
      toast({
        title: "Brochure removed",
        description: "The listing brochure has been removed from the presentation.",
      });
    },
    onError: () => {
      toast({
        title: "Error removing brochure",
        description: "Failed to remove the brochure. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    
    if (!isImage && !isPdf) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or image file (JPG, PNG).",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Request presigned URL
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await urlResponse.json();

      // Step 2: Upload file directly to presigned URL
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Step 3: Save brochure metadata to CMA
      await saveBrochureMutation.mutateAsync({
        url: objectPath,
        filename: file.name,
        type: isPdf ? "pdf" : "image",
        generated: false,
      });

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload the brochure. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveBrochure = () => {
    deleteBrochureMutation.mutate();
  };

  const handleGenerateBrochure = async () => {
    if (!subjectProperty) {
      toast({
        title: "No subject property",
        description: "Please select a subject property to generate a brochure.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    // For now, show a placeholder message - auto-generate will be implemented in a later task
    toast({
      title: "Coming soon",
      description: "Auto-generated brochures will be available in a future update.",
    });
    
    setIsGenerating(false);
  };

  const formatCurrency = (value: number | string | undefined) => {
    if (!value) return "N/A";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getBrochureUrl = (url: string) => {
    // If it's already a full URL, return it
    if (url.startsWith("http")) return url;
    // If it's an object path, construct the URL
    return url.startsWith("/") ? url : `/${url}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Listing Brochure</h3>
        <p className="text-sm text-muted-foreground">
          Add a marketing flyer for the subject property to include in your CMA presentation.
        </p>
      </div>

      {brochure ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {brochure.type === "pdf" ? (
                  <FileText className="h-5 w-5 text-red-500" />
                ) : (
                  <FileImage className="h-5 w-5 text-blue-500" />
                )}
                <div>
                  <p className="font-medium text-sm">{brochure.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {brochure.generated ? "Auto-generated" : "Uploaded"} •{" "}
                    {new Date(brochure.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveBrochure}
                disabled={deleteBrochureMutation.isPending}
                data-testid="button-remove-brochure"
              >
                {deleteBrochureMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </div>

            <div className="aspect-[8.5/11] bg-muted rounded-lg overflow-hidden border">
              {brochure.type === "pdf" ? (
                <iframe
                  src={getBrochureUrl(brochure.url)}
                  className="w-full h-full"
                  title="Brochure Preview"
                />
              ) : (
                <img
                  src={getBrochureUrl(brochure.url)}
                  alt="Listing Brochure"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card
            className="border-2 border-dashed hover-elevate cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-brochure-dropzone"
          >
            <CardContent className="p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-brochure-file"
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    Click to upload PDF or image
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maximum file size: 10MB • Recommended: 8.5" × 11" portrait
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {subjectProperty && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Generate Automatically</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Create a professional brochure using the subject property's data and photos.
                    </p>
                    <div className="text-xs text-muted-foreground mb-3 space-y-1">
                      <p>
                        <strong>Address:</strong>{" "}
                        {subjectProperty.streetAddress || subjectProperty.address || "N/A"}
                      </p>
                      <p>
                        <strong>Price:</strong>{" "}
                        {formatCurrency(subjectProperty.listPrice)}
                      </p>
                      <p>
                        <strong>Details:</strong>{" "}
                        {subjectProperty.bedroomsTotal || "-"} bed •{" "}
                        {subjectProperty.bathroomsTotal || "-"} bath •{" "}
                        {subjectProperty.livingArea
                          ? `${Number(subjectProperty.livingArea).toLocaleString()} sqft`
                          : "N/A"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleGenerateBrochure}
                      disabled={isGenerating}
                      data-testid="button-generate-brochure"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Brochure
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!subjectProperty && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span>Select a subject property to enable auto-generation.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
