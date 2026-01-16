import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Check, Image as ImageIcon, Star, X, Loader2 } from "lucide-react";

export interface Photo {
  url: string;
  thumbnailUrl?: string;
  classification?: string;
  qualityScore?: number;
  isAISuggested?: boolean;
}

interface PhotoSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Photo[];
  selectedPhotos: string[];
  onSelectionChange: (urls: string[]) => void;
  maxPhotos?: number;
  propertyAddress: string;
  isLoading?: boolean;
}

const PHOTO_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "exterior", label: "Exterior" },
  { id: "kitchen", label: "Kitchen" },
  { id: "living", label: "Living" },
  { id: "bedroom", label: "Bedroom" },
  { id: "bathroom", label: "Bathroom" },
  { id: "other", label: "Other" },
];

export function PhotoSelectionModal({
  isOpen,
  onClose,
  photos,
  selectedPhotos,
  onSelectionChange,
  maxPhotos = 12,
  propertyAddress,
  isLoading = false,
}: PhotoSelectionModalProps) {
  const [selected, setSelected] = useState<string[]>(selectedPhotos);
  const [category, setCategory] = useState("all");
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelected(selectedPhotos);
      setShowAISuggestions(false); // Reset AI suggestion flag on open
      setCategory("all"); // Reset category filter on open
    }
  }, [selectedPhotos, isOpen]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (category === "all") return true;
      const classification = photo.classification?.toLowerCase() || "";
      if (category === "living") {
        return classification.includes("living") || classification.includes("family") || classification.includes("great");
      }
      if (category === "other") {
        const knownCategories = ["exterior", "kitchen", "living", "family", "great", "bedroom", "bathroom"];
        return !knownCategories.some(c => classification.includes(c));
      }
      return classification.includes(category);
    });
  }, [photos, category]);

  const aiSuggestedPhotos = useMemo(() => {
    return [...photos]
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, maxPhotos)
      .map((p) => p.url);
  }, [photos, maxPhotos]);

  const togglePhoto = (url: string) => {
    if (selected.includes(url)) {
      setSelected(selected.filter((u) => u !== url));
    } else if (selected.length < maxPhotos) {
      setSelected([...selected, url]);
    }
  };

  const handleAISuggest = () => {
    setSelected(aiSuggestedPhotos);
    setShowAISuggestions(true);
  };

  const handleSave = () => {
    onSelectionChange(selected);
    onClose();
  };

  const handleClear = () => {
    setSelected([]);
    setShowAISuggestions(false);
  };

  const hasQualityScores = photos.some((p) => p.qualityScore !== undefined);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Select Photos for {propertyAddress}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {PHOTO_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                variant={category === cat.id ? "default" : "secondary"}
                size="sm"
                className="whitespace-nowrap"
                data-testid={`button-category-${cat.id}`}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {hasQualityScores && (
            <Button
              onClick={handleAISuggest}
              variant="default"
              size="sm"
              className="bg-purple-500 hover:bg-purple-600 flex-shrink-0"
              data-testid="button-ai-suggest"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Suggest Best {maxPhotos}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">
            {selected.length} of {maxPhotos} photos selected
          </span>
          {selected.length > 0 && (
            <Button
              onClick={handleClear}
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              data-testid="button-clear-selection"
            >
              <X className="w-4 h-4 mr-1" />
              Clear selection
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
              <p>No photos in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-2">
              {filteredPhotos.map((photo, index) => {
                const isSelected = selected.includes(photo.url);
                const isAISuggested = showAISuggestions && aiSuggestedPhotos.includes(photo.url);
                const selectionIndex = selected.indexOf(photo.url);

                return (
                  <div
                    key={photo.url}
                    onClick={() => togglePhoto(photo.url)}
                    className={`
                      relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer
                      border-2 transition-all
                      ${isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent hover:border-muted-foreground/50"
                      }
                    `}
                    data-testid={`photo-item-${index}`}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {isSelected && (
                      <div className="absolute top-2 left-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold">
                        {selectionIndex + 1}
                      </div>
                    )}

                    {isAISuggested && (
                      <Badge
                        className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-1.5 py-0.5"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI
                      </Badge>
                    )}

                    {photo.qualityScore !== undefined && (
                      <Badge
                        variant="secondary"
                        className="absolute bottom-2 right-2 bg-black/70 text-white text-xs"
                      >
                        <Star className="w-3 h-3 mr-1" />
                        {photo.qualityScore}
                      </Badge>
                    )}

                    {photo.classification && (
                      <Badge
                        variant="secondary"
                        className="absolute bottom-2 left-2 bg-black/70 text-white text-xs capitalize"
                      >
                        {photo.classification}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-photos">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-photos">
            <Check className="w-4 h-4 mr-2" />
            Save Selection ({selected.length} photos)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
