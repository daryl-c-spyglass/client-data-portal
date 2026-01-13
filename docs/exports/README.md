# CMA Feature Export Bundle

This folder contains all the files needed to integrate the CMA (Comparative Market Analysis) feature into another Replit app.

## File Summary

| File | Lines | Size | Purpose |
|------|-------|------|---------|
| `CMAs.tsx` | 148 | 6KB | List/dashboard page |
| `CMANew.tsx` | 222 | 8KB | Create/modify CMA page |
| `CMADetailPage.tsx` | 923 | 32KB | View CMA with actions |
| `SharedCMAView.tsx` | 131 | 4KB | Public shareable view |
| `CMABuilder.tsx` | 2,738 | 130KB | Search form & property selection |
| `CMAReport.tsx` | 4,241 | 224KB | Report with stats, charts, map |
| `PolygonMapSearch.tsx` | 204 | 6KB | Map polygon drawing component |
| `VisualMatchPanel.tsx` | 376 | 12KB | AI visual match search |
| `StatusFilterTabs.tsx` | 57 | 2KB | Status filter tabs component |

**Total: ~9,040 lines of code**

## Integration Order

1. **Database Schema** - Add CMA table to your schema
2. **Storage Interface** - Add CMA CRUD methods
3. **API Routes** - Add CMA endpoints
4. **Dependencies** - Install recharts, react-leaflet, leaflet
5. **Components** - Copy components to your project
6. **Pages** - Copy pages and add routes
7. **Navigation** - Add CMA link to sidebar

## Quick Start

### Step 1: Install Dependencies
```bash
npm install recharts react-leaflet leaflet @types/leaflet
```

### Step 2: Add to App Routes
```tsx
import CMAs from "@/pages/CMAs";
import CMANew from "@/pages/CMANew";
import CMADetailPage from "@/pages/CMADetailPage";
import SharedCMAView from "@/pages/SharedCMAView";

<Route path="/cmas" component={CMAs} />
<Route path="/cmas/new" component={CMANew} />
<Route path="/cmas/:id" component={CMADetailPage} />
<Route path="/share/cma/:token" component={SharedCMAView} />
```

### Step 3: Add Navigation
```tsx
<Link href="/cmas">
  <FileText className="w-4 h-4" />
  CMAs
</Link>
```

## Required Property Fields

Your Repliers API integration must return these fields:
- `id`, `listingId`
- `standardStatus` (Active, Active Under Contract, Closed)
- `listPrice`, `closePrice`
- `livingArea`, `lotSizeSquareFeet`, `lotSizeAcres`
- `bedroomsTotal`, `bathroomsTotalInteger`
- `daysOnMarket`, `yearBuilt`
- `city`, `subdivisionName`, `unparsedAddress`
- `closeDate`, `listingContractDate`
- `photos` (array of image URLs)
- `latitude`, `longitude`

## Files to Copy

Copy files from `source_files/` to your project:
- Pages go to `client/src/pages/`
- Components go to `client/src/components/`

## Prompts

See `01_INTEGRATION_PROMPTS.md` for detailed prompts to use when integrating each piece.

## Notes

- CMABuilder uses autocomplete endpoints (`/api/autocomplete/cities`, etc.) - ensure these exist
- CMABuilder can optionally use polygon search and visual match AI - these can be disabled
- CMAReport uses Leaflet for maps - ensure CSS is imported
- Print styles are included in CMAReport for PDF export
