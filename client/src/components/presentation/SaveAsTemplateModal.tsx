import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface SaveAsTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; isDefault: boolean }) => Promise<void>;
  isSaving?: boolean;
}

export function SaveAsTemplateModal({ 
  open, 
  onOpenChange, 
  onSave,
  isSaving = false
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave({ name: name.trim(), isDefault });
    setName("");
    setIsDefault(false);
  };

  const handleClose = (open: boolean) => {
    if (!isSaving && !open) {
      setName("");
      setIsDefault(false);
      onOpenChange(false);
    } else if (open) {
      onOpenChange(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save your current configuration as a reusable template for future CMAs.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Standard CMA"
              disabled={isSaving}
              data-testid="input-template-name"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
              disabled={isSaving}
              data-testid="checkbox-template-default"
            />
            <Label 
              htmlFor="is-default" 
              className="text-sm font-normal cursor-pointer"
            >
              Set as default for new CMAs
            </Label>
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => handleClose(false)}
            disabled={isSaving}
            data-testid="button-template-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            data-testid="button-template-save"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Template"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
