import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FolderOpen, Star, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CmaReportTemplate } from "@shared/schema";

interface LoadTemplateDropdownProps {
  onApply: (template: CmaReportTemplate) => void;
  disabled?: boolean;
}

export function LoadTemplateDropdown({ onApply, disabled }: LoadTemplateDropdownProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: templates, isLoading, isError, refetch } = useQuery<CmaReportTemplate[]>({
    queryKey: ["/api/report-templates"],
  });

  const handleApply = (template: CmaReportTemplate) => {
    onApply(template);
  };

  const getEnabledSectionsCount = (template: CmaReportTemplate) => {
    return template.includedSections?.length ?? 0;
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          disabled={disabled}
          data-testid="button-load-template"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Load Template
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>My Templates</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <DropdownMenuItem disabled>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading...
          </DropdownMenuItem>
        ) : isError ? (
          <DropdownMenuItem 
            onClick={() => refetch()}
            className="text-destructive cursor-pointer"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Failed to load. Click to retry.
          </DropdownMenuItem>
        ) : !templates || templates.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No saved templates
          </DropdownMenuItem>
        ) : (
          templates.map((template) => (
            <DropdownMenuItem
              key={template.id}
              onClick={() => handleApply(template)}
              className="flex flex-col items-start py-2 cursor-pointer"
              data-testid={`menu-item-template-${template.id}`}
            >
              <div className="flex items-center gap-2">
                {template.isDefault && (
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                )}
                <span className="font-medium">{template.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {getEnabledSectionsCount(template)} sections enabled
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
