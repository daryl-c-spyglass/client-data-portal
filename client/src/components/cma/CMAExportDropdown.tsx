import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, Printer, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Cma, Property } from "@shared/schema";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { CMAPdfDocument } from "@/components/CMAPdfDocument";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface CMAExportDropdownProps {
  cma: Cma;
  agentProfile?: {
    bio?: string | null;
    title?: string | null;
    defaultCoverLetter?: string | null;
    headshotUrl?: string | null;
  } | null;
  companySettings?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
  } | null;
  currentUser?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    phone?: string | null;
  } | null;
  includedSections?: string[];
  coverLetterOverride?: string;
  includeAgentFooter?: boolean;
  brochure?: any;
  customPhotoSelections?: Record<string, string[]>;
}

export function CMAExportDropdown({ 
  cma, 
  agentProfile,
  companySettings,
  currentUser,
  includedSections = ['cover', 'subject', 'comparables', 'statistics', 'map'],
  coverLetterOverride,
  includeAgentFooter = true,
  brochure,
  customPhotoSelections
}: CMAExportDropdownProps) {
  const { toast } = useToast();
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const pdfFilename = `CMA-${cma.name?.replace(/[^a-zA-Z0-9]/g, '-') || cma.id}.pdf`;

  const pdfCma = {
    id: cma.id,
    name: cma.name,
    subjectPropertyId: cma.subjectPropertyId,
    propertiesData: (cma as any).propertiesData || [],
    createdAt: cma.createdAt,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="button-export-dropdown">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={handlePrint}
            data-testid="menu-item-print"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setPdfPreviewOpen(true)}
            data-testid="menu-item-preview-pdf"
          >
            <FileText className="w-4 h-4 mr-2" />
            Preview PDF
          </DropdownMenuItem>
          <PDFDownloadLink
            document={
              <CMAPdfDocument
                cma={pdfCma}
                agentProfile={agentProfile}
                companySettings={companySettings}
                currentUser={currentUser}
                includedSections={includedSections}
                coverLetterOverride={coverLetterOverride}
                includeAgentFooter={includeAgentFooter}
                brochure={brochure}
                customPhotoSelections={customPhotoSelections}
              />
            }
            fileName={pdfFilename}
          >
            {({ loading }) => (
              <DropdownMenuItem 
                disabled={loading}
                data-testid="menu-item-export-pdf"
                onSelect={(e) => e.preventDefault()}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Generating...' : 'Export PDF'}
              </DropdownMenuItem>
            )}
          </PDFDownloadLink>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* PDF Preview Dialog */}
      <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
            <VisuallyHidden>
              <DialogDescription>Preview of the CMA PDF document</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <div className="flex-1 min-h-0 h-full">
            <PDFViewer width="100%" height="100%" className="rounded-md">
              <CMAPdfDocument
                cma={pdfCma}
                agentProfile={agentProfile}
                companySettings={companySettings}
                currentUser={currentUser}
                includedSections={includedSections}
                coverLetterOverride={coverLetterOverride}
                includeAgentFooter={includeAgentFooter}
                brochure={brochure}
                customPhotoSelections={customPhotoSelections}
              />
            </PDFViewer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
