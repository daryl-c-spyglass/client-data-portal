# CMA Presentation Preview Implementation Reference

Complete documentation for replicating the CMA Presentation Builder feature in Contract Conduit / Mission Control.

---

## PART 1: File List

### Core Components
| File | Purpose |
|------|---------|
| `client/src/pages/CMAPresentationBuilder.tsx` | Main builder page with sections tab, content tab, layout tab, and live preview |
| `client/src/components/ExpandedPreviewModal.tsx` | Fullscreen preview modal with zoom controls |
| `client/src/components/AdjustmentsSection.tsx` | Adjustments configuration and preview table |
| `client/src/components/CMAPdfDocument.tsx` | PDF export using @react-pdf/renderer |
| `client/src/components/presentation/MapboxCMAMap.tsx` | Interactive Mapbox map with property markers |
| `client/src/components/presentation/CoverLetterEditor.tsx` | AI-powered cover letter editor |
| `client/src/components/presentation/CoverPageEditor.tsx` | Cover page customization |
| `client/src/components/presentation/ExpandableList.tsx` | Expandable list/table/grid components |
| `client/src/components/presentation/SaveAsTemplateModal.tsx` | Template save dialog |
| `client/src/components/presentation/LoadTemplateDropdown.tsx` | Template selection dropdown |
| `client/src/components/presentation/PhotoSelectionModal.tsx` | Photo picker with AI suggestions |

### Utilities
| File | Purpose |
|------|---------|
| `client/src/lib/adjustmentCalculations.ts` | Property adjustment calculation logic |
| `client/src/lib/statusColors.ts` | Centralized status color definitions |
| `client/src/lib/pdfStyles.ts` | PDF styling constants |

### Schema/Types
| File | Purpose |
|------|---------|
| `shared/schema.ts` | Section definitions, CMA types, adjustment types |

---

## PART 2: Component Architecture

### 2.1 Section Configuration (shared/schema.ts)

```typescript
export const CMA_REPORT_SECTIONS = [
  // Introduction
  { id: 'cover_page', name: 'Cover Page', category: 'introduction', defaultEnabled: true },
  { id: 'listing_brochure', name: 'Listing Brochure', category: 'introduction', defaultEnabled: false },
  { id: 'cover_letter', name: 'Cover Letter', category: 'introduction', defaultEnabled: true, editable: true },
  { id: 'agent_resume', name: 'Agent Resume', category: 'introduction', defaultEnabled: false, editable: true },
  { id: 'our_company', name: 'Our Company', category: 'introduction', defaultEnabled: false },
  { id: 'what_is_cma', name: 'What is a CMA?', category: 'introduction', defaultEnabled: false },
  { id: 'contact_me', name: 'Contact Me', category: 'introduction', defaultEnabled: true },
  // Listings
  { id: 'map_all_listings', name: 'Map of All Listings', category: 'listings', defaultEnabled: true },
  { id: 'summary_comparables', name: 'Summary of Comparable Properties', category: 'listings', defaultEnabled: true },
  { id: 'listings_header', name: 'Listings Chapter Header', category: 'listings', defaultEnabled: false },
  { id: 'property_details', name: 'Property Details', category: 'listings', defaultEnabled: true },
  { id: 'property_photos', name: 'Property Photos', category: 'listings', defaultEnabled: true },
  { id: 'adjustments', name: 'Adjustments', category: 'listings', defaultEnabled: false },
  // Analysis
  { id: 'analysis_header', name: 'Analysis Chapter Header', category: 'analysis', defaultEnabled: false },
  { id: 'online_valuation', name: 'Online Valuation Analysis', category: 'analysis', defaultEnabled: false },
  { id: 'price_per_sqft', name: 'Average Price Per Sq. Ft.', category: 'analysis', defaultEnabled: true },
  { id: 'comparable_stats', name: 'Comparable Property Statistics', category: 'analysis', defaultEnabled: true },
] as const;

export type CmaSectionId = typeof CMA_REPORT_SECTIONS[number]['id'];
```

### 2.2 Section Categories

```typescript
const SECTION_CATEGORIES = {
  introduction: { label: "Introduction", icon: FileText },
  listings: { label: "Listings", icon: Home },
  analysis: { label: "Analysis", icon: BarChart3 },
} as const;
```

### 2.3 PreviewSection Component

```tsx
function PreviewSection({
  title,
  icon: Icon,
  children,
  sectionId,
  onClick,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  sectionId?: string;
  onClick?: (sectionId: string) => void;
}) {
  const handleClick = () => {
    if (sectionId && onClick) {
      onClick(sectionId);
    }
  };

  return (
    <div 
      className={`p-4 border rounded-md space-y-3 transition-colors ${onClick ? "cursor-pointer hover:border-primary/50 hover:bg-muted/30" : ""}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
```

### 2.4 Expanded Preview Modal

```tsx
interface ExpandedPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sectionsEnabled: number;
}

export function ExpandedPreviewModal({
  isOpen,
  onClose,
  children,
  sectionsEnabled,
}: ExpandedPreviewModalProps) {
  const [zoom, setZoom] = useState(100);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>CMA Presentation Preview</DialogTitle>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
              {sectionsEnabled} sections enabled
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-muted/30">
          <div className="p-6">
            <div
              className="max-w-2xl mx-auto bg-background shadow-lg rounded-lg transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              {children}
            </div>
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 flex justify-center gap-2 px-6 py-4 border-t bg-background">
          <Button variant={zoom === 50 ? "secondary" : "outline"} size="sm" onClick={() => setZoom(50)}>50%</Button>
          <Button variant={zoom === 100 ? "secondary" : "outline"} size="sm" onClick={() => setZoom(100)}>100%</Button>
          <Button variant={zoom === 150 ? "secondary" : "outline"} size="sm" onClick={() => setZoom(150)}>150%</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## PART 3: Data Flow

### 3.1 State Management (Main Builder)

```typescript
// Section configuration state
const [includedSections, setIncludedSections] = useState<CmaSectionId[]>([]);
const [sectionOrder, setSectionOrder] = useState<CmaSectionId[]>([]);

// Content state
const [coverLetterOverride, setCoverLetterOverride] = useState<string>("");
const [coverPageConfig, setCoverPageConfig] = useState<CoverPageConfig>(getDefaultCoverPageConfig());

// Layout state
const [layout, setLayout] = useState<string>("two_photos");
const [photoLayout, setPhotoLayout] = useState<string>("first_dozen");
const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
const [showMapPolygon, setShowMapPolygon] = useState<boolean>(true);
const [includeAgentFooter, setIncludeAgentFooter] = useState<boolean>(true);

// UI state
const [hasChanges, setHasChanges] = useState(false);
const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
const [activeTab, setActiveTab] = useState("sections");
```

### 3.2 Section Toggle Logic

```typescript
const toggleSection = (sectionId: CmaSectionId) => {
  setIncludedSections(prev => 
    prev.includes(sectionId)
      ? prev.filter(id => id !== sectionId)
      : [...prev, sectionId]
  );
  setHasChanges(true);
};

const moveSection = (sectionId: CmaSectionId, direction: "up" | "down") => {
  setSectionOrder(prev => {
    const currentIndex = prev.indexOf(sectionId);
    if (currentIndex === -1) return prev;
    
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= prev.length) return prev;
    
    const newOrder = [...prev];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    return newOrder;
  });
  setHasChanges(true);
};
```

### 3.3 Data Sources

```typescript
// CMA data (properties, comparables, subject)
const { data: cma } = useQuery({
  queryKey: ["/api/cmas", cmaId],
});

// Agent profile
const { data: agentProfile } = useQuery({
  queryKey: ["/api/agent-profile"],
});

// Company settings (logo, branding)
const { data: companySettings } = useQuery({
  queryKey: ["/api/company-settings"],
});

// Report configuration (sections, layout)
const { data: config } = useQuery({
  queryKey: ["/api/report-config", cmaId],
});

// Current user
const { data: currentUser } = useQuery({
  queryKey: ["/api/auth/me"],
});
```

---

## PART 4: Status Colors (Single Source of Truth)

```typescript
// client/src/lib/statusColors.ts
export const STATUS_COLORS = {
  subject: {
    name: 'Subject Property',
    hex: '#3b82f6',        // Blue
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-100',
    text: 'text-blue-500',
    border: 'border-blue-500',
  },
  active: {
    name: 'Active',
    hex: '#22c55e',        // Green
    bg: 'bg-green-500',
    bgLight: 'bg-green-100',
    text: 'text-green-500',
  },
  underContract: {
    name: 'Under Contract',
    hex: '#f97316',        // Orange
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-100',
    text: 'text-orange-500',
  },
  closed: {
    name: 'Closed',
    hex: '#ef4444',        // Red
    bg: 'bg-red-500',
    bgLight: 'bg-red-100',
    text: 'text-red-500',
  },
  pending: {
    name: 'Pending',
    hex: '#6b7280',        // Gray
    bg: 'bg-gray-500',
    bgLight: 'bg-gray-100',
    text: 'text-gray-500',
  },
} as const;

export function getStatusFromMLS(mlsStatus: string, isSubject: boolean = false): StatusKey {
  if (isSubject) return 'subject';
  const normalized = mlsStatus?.toLowerCase().trim();
  switch (normalized) {
    case 'active': return 'active';
    case 'active under contract':
    case 'under contract': return 'underContract';
    case 'closed':
    case 'sold': return 'closed';
    case 'pending': return 'pending';
    default: return 'active';
  }
}

export function getStatusHexFromMLS(status: string, isSubject?: boolean): string {
  const key = getStatusFromMLS(status, isSubject);
  return STATUS_COLORS[key].hex;
}
```

---

## PART 5: Adjustments Implementation

### 5.1 Default Adjustment Rates

```typescript
export const DEFAULT_ADJUSTMENT_RATES: CmaAdjustmentRates = {
  sqftPerUnit: 50,      // $/sqft difference
  bedroomValue: 10000,  // $ per bedroom
  bathroomValue: 7500,  // $ per bathroom
  poolValue: 25000,     // $ if has pool
  garagePerSpace: 5000, // $ per garage space
  yearBuiltPerYear: 1000, // $ per year newer/older
  lotSizePerSqft: 2,    // $ per sqft of lot
};
```

### 5.2 Adjustment Calculation

```typescript
export function calculateAdjustments(
  subject: PropertyForAdjustment,
  comp: PropertyForAdjustment,
  rates: CmaAdjustmentRates,
  overrides?: Partial<CmaCompAdjustmentOverrides> | null
): CompAdjustmentResult {
  const adjustments: AdjustmentLine[] = [];
  
  // Square Feet adjustment
  const subjectSqft = getSqft(subject);
  const compSqft = getSqft(comp);
  const sqftDiff = subjectSqft - compSqft;
  const sqftAdj = overrides?.sqft ?? (sqftDiff * rates.sqftPerUnit);
  if (sqftAdj !== 0) {
    adjustments.push({
      feature: 'Square Feet',
      subjectValue: subjectSqft,
      compValue: compSqft,
      adjustment: sqftAdj,
    });
  }
  
  // Similar pattern for bedrooms, bathrooms, pool, garage, year built, lot size...
  
  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.adjustment, 0);
  const salePrice = getSalePrice(comp);
  
  return {
    compId: getPropertyId(comp),
    compAddress: getPropertyAddress(comp),
    salePrice,
    adjustments,
    totalAdjustment,
    adjustedPrice: salePrice + totalAdjustment,
  };
}
```

### 5.3 Color-Coded Adjustment Display

```tsx
// Green for positive (adds value), Red for negative (reduces value)
<td className={`text-right p-1.5 ${result.totalAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
  {formatAdjustment(result.totalAdjustment)}
</td>

export function formatAdjustment(value: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    signDisplay: "always",
  }).format(value);
  return formatted;
}
```

---

## PART 6: Bar Chart (Price Per Sq Ft)

Using **Recharts** library:

```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";

// Data preparation
const pricePerSqftData = properties
  .filter(p => Number(p.livingArea) > 0 && Number(p.listPrice || p.closePrice) > 0)
  .map(p => ({
    name: truncateAddress(p.streetAddress || p.address || ""),
    fullAddress: p.streetAddress || p.address || "",
    value: Math.round(Number(p.listPrice || p.closePrice) / Number(p.livingArea)),
    isSubject: p.id === subjectProperty?.id,
  }));

// Chart component
<ResponsiveContainer width="100%" height="100%">
  <BarChart data={pricePerSqftData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
    <XAxis 
      dataKey="name" 
      tick={{ fontSize: 9 }} 
      angle={-45} 
      textAnchor="end" 
      height={50}
      interval={0}
    />
    <YAxis 
      tick={{ fontSize: 10 }} 
      tickFormatter={(value) => `$${value}`}
      width={50}
    />
    <Tooltip 
      formatter={(value: number) => [`$${value}/sqft`, "Price/SqFt"]}
      labelFormatter={(label) => pricePerSqftData.find(d => d.name === label)?.fullAddress || label}
    />
    <ReferenceLine 
      y={statistics.avgPricePerSqft} 
      stroke="hsl(var(--primary))" 
      strokeDasharray="5 5"
      label={{ value: 'Avg', position: 'right', fontSize: 10 }}
    />
    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
      {pricePerSqftData.map((entry, index) => (
        <Cell 
          key={`cell-${index}`} 
          fill={entry.isSubject ? STATUS_COLORS.subject.hex : 'hsl(var(--primary))'}
        />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

---

## PART 7: Mapbox Map Implementation

```tsx
interface MapboxCMAMapProps {
  properties: PropertyLocation[];
  subjectProperty?: PropertyLocation | null;
  style?: 'streets' | 'satellite';
  showPolygon?: boolean;
  onStyleChange?: (style: 'streets' | 'satellite') => void;
  onPolygonChange?: (show: boolean) => void;
  height?: string;
  interactive?: boolean;
}

export function MapboxCMAMap({ 
  properties, 
  subjectProperty,
  style = 'streets',
  showPolygon = true,
  height = '400px',
  interactive = true
}: MapboxCMAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    
    mapboxgl.accessToken = token;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[style],
      center: getCenterPoint(),
      zoom: 12,
      interactive
    });
    
    map.current.on('load', () => {
      // Add markers for each property
      properties.forEach(property => {
        const el = createMarkerElement(false, property.status);
        const popup = createPopup(property, false);
        const marker = new mapboxgl.Marker(el)
          .setLngLat([property.lng, property.lat])
          .setPopup(popup)
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
      
      // Add subject marker (special styling)
      if (subjectProperty) {
        const el = createMarkerElement(true, 'Subject');
        const marker = new mapboxgl.Marker(el)
          .setLngLat([subjectProperty.lng, subjectProperty.lat])
          .addTo(map.current!);
        markersRef.current.push(marker);
      }
      
      // Add polygon if enabled
      if (showPolygon) {
        addPolygonLayer(map.current, [...properties, subjectProperty].filter(Boolean));
      }
      
      // Fit bounds
      fitBoundsToMarkers(map.current, properties, subjectProperty);
    });
    
    return () => {
      markersRef.current.forEach(m => m.remove());
      map.current?.remove();
    };
  }, []);
  
  return <div ref={mapContainer} className="w-full rounded-lg" style={{ height }} />;
}
```

---

## PART 8: PDF Export

Using **@react-pdf/renderer**:

```tsx
import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer";

// Generate and download PDF
const handleExportPdf = async () => {
  const pdfDoc = (
    <CMAPdfDocument
      cma={cma}
      agentProfile={agentProfile}
      companySettings={companySettings}
      currentUser={currentUser}
      includedSections={includedSections}
      coverLetterOverride={coverLetterOverride}
      includeAgentFooter={includeAgentFooter}
    />
  );
  
  const blob = await pdf(pdfDoc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CMA_Report_${cma.name}_${new Date().toISOString().split("T")[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
```

---

## PART 9: Template System

### Database Schema

```typescript
export const cmaReportTemplates = pgTable("cma_report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  includedSections: json("included_sections").$type<string[]>(),
  sectionOrder: json("section_order").$type<string[]>(),
  coverLetterOverride: text("cover_letter_override"),
  layout: text("layout").default("two_photos"),
  photoLayout: text("photo_layout").default("first_dozen"),
  mapStyle: text("map_style").default("streets"),
  showMapPolygon: boolean("show_map_polygon").default(true),
  includeAgentFooter: boolean("include_agent_footer").default(true),
  coverPageConfig: json("cover_page_config").$type<CoverPageConfig>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/report-templates` | GET | List user's templates |
| `/api/report-templates` | POST | Save new template |
| `/api/report-templates/:id` | DELETE | Delete template |
| `/api/report-config/:cmaId` | GET | Get CMA-specific config |
| `/api/report-config/:cmaId` | PUT | Save CMA-specific config |

---

## PART 10: Dependencies

```json
{
  "recharts": "^2.x",
  "@react-pdf/renderer": "^3.x",
  "mapbox-gl": "^3.x",
  "@tanstack/react-query": "^5.x",
  "wouter": "^3.x",
  "@radix-ui/react-dialog": "^1.x",
  "@radix-ui/react-switch": "^1.x",
  "@radix-ui/react-tabs": "^1.x"
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   CMAPresentationBuilder                         │
├─────────────────────────┬───────────────────────────────────────┤
│                         │                                       │
│  ┌──────────────────┐   │   ┌─────────────────────────────┐     │
│  │   Tabs Panel     │   │   │     Preview Panel           │     │
│  │                  │   │   │                             │     │
│  │  ┌────────────┐  │   │   │  ┌───────────────────────┐  │     │
│  │  │ Sections   │  │   │   │  │ Cover Page Preview    │  │     │
│  │  │ - Toggle   │  │───┼──▶│  ├───────────────────────┤  │     │
│  │  │ - Reorder  │  │   │   │  │ Cover Letter Preview  │  │     │
│  │  └────────────┘  │   │   │  ├───────────────────────┤  │     │
│  │                  │   │   │  │ Map Preview           │  │     │
│  │  ┌────────────┐  │   │   │  │ (MapboxCMAMap)        │  │     │
│  │  │ Content    │  │   │   │  ├───────────────────────┤  │     │
│  │  │ - Cover    │  │───┼──▶│  │ Adjustments Table     │  │     │
│  │  │ - Letter   │  │   │   │  ├───────────────────────┤  │     │
│  │  └────────────┘  │   │   │  │ Price Chart           │  │     │
│  │                  │   │   │  │ (Recharts)            │  │     │
│  │  ┌────────────┐  │   │   │  └───────────────────────┘  │     │
│  │  │ Layout     │  │   │   │                             │     │
│  │  │ - Photos   │  │   │   │  [Expand] → ExpandedPreview │     │
│  │  │ - Map      │  │   │   │  [Export] → CMAPdfDocument  │     │
│  │  └────────────┘  │   │   └─────────────────────────────┘     │
│  └──────────────────┘   │                                       │
│                         │                                       │
└─────────────────────────┴───────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Data Sources (Hooks) │
                    │  - cma data           │
                    │  - agentProfile       │
                    │  - companySettings    │
                    │  - reportConfig       │
                    └───────────────────────┘
```

---

## Key Implementation Notes

1. **Real-time Preview**: All changes to sections/content/layout immediately reflect in the preview panel (no save required)

2. **Section Rendering**: Use `includedSections.includes(sectionId)` to conditionally render each section

3. **Click-to-Navigate**: PreviewSection onClick scrolls the left panel to the corresponding config section

4. **Expandable Lists**: ExpandableList, ExpandableTable, ExpandableGrid show initial items with "Show X more" button

5. **Map Integration**: Mapbox requires `VITE_MAPBOX_TOKEN` environment variable

6. **PDF Generation**: @react-pdf/renderer runs client-side, generates blob for download

7. **Template System**: Users can save current configuration as reusable template

---

*This document provides complete implementation reference for replicating in Contract Conduit.*
