import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Hash, X, Loader2 } from "lucide-react";

interface Suggestion {
  id: string;
  type: "address" | "mls";
  label: string;
  sublabel: string;
  mlsNumber: string;
  address: string;
  city: string;
  price: number;
  status: string;
  beds?: number;
  baths?: number;
  sqft?: number;
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  placeholder?: string;
  className?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Address, MLS#, or keywords...",
  className = "",
}: SearchAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (value.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      setHighlightIndex(-1);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `/api/properties/autocomplete?q=${encodeURIComponent(value)}`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
          setShowDropdown(true);
          setHighlightIndex(-1);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Autocomplete fetch error:", error);
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [value]);

  const selectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      onChange(suggestion.address || suggestion.mlsNumber);
      setShowDropdown(false);
      setSuggestions([]);
      setHighlightIndex(-1);
      onSelect?.(suggestion);
    },
    [onChange, onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          e.preventDefault();
          selectSuggestion(suggestions[highlightIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setHighlightIndex(-1);
        break;
    }
  };

  const formatPrice = (price: number) => {
    if (!price) return "";
    return `$${price.toLocaleString()}`;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value.length >= 3) {
              setShowDropdown(true);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0 && value.length >= 3) {
              setShowDropdown(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pr-16"
          data-testid="input-keyword-search"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {isLoading && (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground mr-1"
              data-testid="autocomplete-loading"
            />
          )}
          {value && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onChange("");
                setSuggestions([]);
                setShowDropdown(false);
                inputRef.current?.focus();
              }}
              data-testid="button-clear-keyword-search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {showDropdown && value.length >= 3 && (
        <div
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[350px] overflow-y-auto"
          data-testid="autocomplete-dropdown"
        >
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                role="option"
                aria-selected={index === highlightIndex}
                className={`w-full px-3 py-2.5 text-left flex items-start gap-2.5 border-b border-border last:border-b-0 cursor-pointer ${
                  index === highlightIndex ? "bg-accent" : ""
                }`}
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setHighlightIndex(index)}
                data-testid={`autocomplete-suggestion-${index}`}
              >
                <div className="mt-0.5 shrink-0">
                  {suggestion.type === "mls" ? (
                    <Hash className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-medium text-sm truncate"
                    data-testid={`text-suggestion-label-${index}`}
                  >
                    {suggestion.label}
                  </div>
                  <div
                    className="text-xs text-muted-foreground truncate"
                    data-testid={`text-suggestion-sublabel-${index}`}
                  >
                    {suggestion.sublabel}
                  </div>
                  {(suggestion.price || suggestion.beds || suggestion.sqft) && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      {suggestion.price > 0 && (
                        <span
                          className="font-medium text-foreground"
                          data-testid={`text-suggestion-price-${index}`}
                        >
                          {formatPrice(suggestion.price)}
                        </span>
                      )}
                      {suggestion.beds != null && (
                        <span data-testid={`text-suggestion-beds-${index}`}>
                          {suggestion.beds} bd
                        </span>
                      )}
                      {suggestion.baths != null && (
                        <span data-testid={`text-suggestion-baths-${index}`}>
                          {suggestion.baths} ba
                        </span>
                      )}
                      {suggestion.sqft != null && suggestion.sqft > 0 && (
                        <span data-testid={`text-suggestion-sqft-${index}`}>
                          {suggestion.sqft.toLocaleString()} sqft
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : !isLoading ? (
            <div
              className="px-3 py-4 text-center text-sm text-muted-foreground"
              data-testid="autocomplete-no-results"
            >
              <Search className="h-4 w-4 mx-auto mb-1 opacity-50" />
              No matching properties found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
