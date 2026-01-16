import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableListProps<T> {
  items: T[];
  initialCount: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemLabel?: string;
  className?: string;
}

export function ExpandableList<T>({ 
  items, 
  initialCount, 
  renderItem, 
  itemLabel = "items",
  className
}: ExpandableListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  
  const visibleItems = expanded ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - initialCount;
  const hasMore = hiddenCount > 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        expanded ? "max-h-[2000px]" : ""
      )}>
        {visibleItems.map((item, index) => renderItem(item, index))}
      </div>
      
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-primary hover:text-primary/80 
                     hover:bg-muted rounded-lg transition-colors
                     flex items-center justify-center gap-1 cursor-pointer"
          data-testid={`button-expand-${itemLabel.replace(/\s+/g, '-')}`}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              +{hiddenCount} more {itemLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}

interface ExpandableTableProps<T> {
  items: T[];
  initialCount: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  itemLabel?: string;
  header: React.ReactNode;
  className?: string;
}

export function ExpandableTable<T>({ 
  items, 
  initialCount, 
  renderRow, 
  itemLabel = "items",
  header,
  className
}: ExpandableTableProps<T>) {
  const [expanded, setExpanded] = useState(false);
  
  const visibleItems = expanded ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - initialCount;
  const hasMore = hiddenCount > 0;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-xs">
        <thead>
          {header}
        </thead>
        <tbody>
          {visibleItems.map((item, index) => renderRow(item, index))}
        </tbody>
      </table>
      
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-primary hover:text-primary/80 
                     hover:bg-muted rounded-lg transition-colors
                     flex items-center justify-center gap-1 cursor-pointer mt-2"
          data-testid={`button-expand-${itemLabel.replace(/\s+/g, '-')}`}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              +{hiddenCount} more {itemLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}

interface ExpandableGridProps<T> {
  items: T[];
  initialCount: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemLabel?: string;
  columns?: number;
  className?: string;
}

export function ExpandableGrid<T>({ 
  items, 
  initialCount, 
  renderItem, 
  itemLabel = "items",
  columns = 3,
  className
}: ExpandableGridProps<T>) {
  const [expanded, setExpanded] = useState(false);
  
  const visibleItems = expanded ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - initialCount;
  const hasMore = hiddenCount > 0;

  const gridClass = columns === 3 ? "grid-cols-3" : columns === 4 ? "grid-cols-4" : "grid-cols-2";

  return (
    <div className={className}>
      <div className={cn("grid gap-1", gridClass)}>
        {visibleItems.map((item, index) => renderItem(item, index))}
      </div>
      
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-primary hover:text-primary/80 
                     hover:bg-muted rounded-lg transition-colors
                     flex items-center justify-center gap-1 cursor-pointer mt-2"
          data-testid={`button-expand-${itemLabel.replace(/\s+/g, '-')}`}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              +{hiddenCount} more {itemLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}
