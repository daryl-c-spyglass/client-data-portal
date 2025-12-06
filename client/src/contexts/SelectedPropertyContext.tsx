import { createContext, useContext, useState, type ReactNode } from "react";
import type { Property, Media } from "@shared/schema";

interface PropertyWithMedia {
  property: any;
  media: Media[];
}

interface SearchState {
  properties: any[];
  totalCount: number;
  filters: any;
  searchTriggered: boolean;
}

interface SelectedPropertyContextType {
  selectedProperty: PropertyWithMedia | null;
  setSelectedProperty: (property: PropertyWithMedia | null) => void;
  searchState: SearchState | null;
  setSearchState: (state: SearchState | null) => void;
}

const SelectedPropertyContext = createContext<SelectedPropertyContextType | null>(null);

export function SelectedPropertyProvider({ children }: { children: ReactNode }) {
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithMedia | null>(null);
  const [searchState, setSearchState] = useState<SearchState | null>(null);

  return (
    <SelectedPropertyContext.Provider value={{ 
      selectedProperty, 
      setSelectedProperty,
      searchState,
      setSearchState
    }}>
      {children}
    </SelectedPropertyContext.Provider>
  );
}

export function useSelectedProperty() {
  const context = useContext(SelectedPropertyContext);
  if (!context) {
    throw new Error("useSelectedProperty must be used within a SelectedPropertyProvider");
  }
  return context;
}
