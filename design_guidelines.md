# MLS Grid IDX/CMA Platform Design Guidelines

## Design Approach

**Hybrid Reference Strategy:** Drawing from industry-leading real estate platforms (Zillow, Redfin, Realtor.com) for property browsing patterns, combined with modern productivity tools (Linear, Notion) for the agent dashboard interface. This creates a professional, data-rich experience that serves both real estate professionals and their clients.

**Core Principle:** Balance visual appeal for client engagement with functional efficiency for agent workflow. Property imagery takes center stage while maintaining clean data presentation and powerful comparison tools.

---

## Typography System

**Font Families:**
- Primary: Inter (via Google Fonts CDN)
- Headings: 600-700 weight
- Body text: 400 weight
- Data/Numbers: 500 weight (tabular-nums for alignment)

**Scale:**
- Hero headings: text-4xl to text-5xl
- Section headings: text-2xl to text-3xl
- Property titles: text-xl font-semibold
- Body text: text-base
- Labels/metadata: text-sm
- Micro-data: text-xs

---

## Layout & Spacing System

**Tailwind Units:** Consistently use 2, 4, 6, 8, 12, 16, 20, 24 for spacing
- Component padding: p-4, p-6, p-8
- Section spacing: py-12, py-16, py-20
- Card gaps: gap-4, gap-6
- Grid gutters: gap-6, gap-8

**Container Strategy:**
- Full-width sections: max-w-7xl mx-auto
- Dashboard content: max-w-6xl
- Forms/details: max-w-4xl
- Reading content: max-w-prose

---

## Core Components

### Property Cards
- Image-first design with 16:9 aspect ratio thumbnails
- Overlay gradient on images (bottom 40%) for text legibility
- Price prominent at top-left of image overlay
- Key stats below image: beds, baths, sqft in compact row
- Address as card title below stats
- Status badge (Active/Pending/Sold) top-right corner
- Hover state: subtle lift with shadow enhancement

### Search Interface
- Persistent filter bar with inline controls
- Location search with autocomplete
- Price range slider with manual inputs
- Quick filter pills: beds, baths, property type
- Advanced filters in expandable panel
- Results count and sort options in header
- Map/List view toggle

### Property Comparison Tool
- Side-by-side grid layout (2-3 columns on desktop)
- Sticky header with property images
- Aligned data rows for easy scanning
- Highlight differences with subtle visual treatment
- "Add to comparison" action from search results (max 6 properties)

### Property Detail View
- Full-width hero image gallery with thumbnails
- Two-column layout: left=images/description, right=key stats panel (sticky)
- Stats panel includes: price, beds/baths/sqft, property type, status, days on market
- Expandable sections: Full Description, Features & Amenities, Property History, Neighborhood Info
- Integrated map showing property location
- CTA buttons: Schedule Viewing, Save Property, Share, Add to CMA

### CMA Dashboard (Agent View)
- Sidebar navigation: Active CMAs, Drafts, Templates, Clients
- Main workspace with table/card view toggle
- Quick create CMA button (prominent, top-right)
- CMA cards show: client name, property address, comp count, created date, status
- Search and filter by client/property/date

### CMA Builder Interface
- Three-panel layout: Subject Property (left), Comparable Properties (center), Analysis Tools (right)
- Drag-and-drop comparable selection from search results
- Adjustable weight sliders for each comparable
- Real-time market analysis calculations
- Chart visualizations: price trends, DOM comparison, price per sqft
- Notes/adjustments section for agent annotations
- Generate Report button with preview

### Client Portal
- Clean, simplified view focused on shared CMAs
- Property showcase with professional presentation
- Agent contact card with photo and credentials
- Viewing history of shared properties
- Save favorites functionality
- Request more information form

### Embeddable Widgets

**Search Widget:**
- Compact search bar with location and quick filters
- Configurable size: small (search only), medium (+ filters), large (full interface)
- Seamless integration with responsive iframe
- Click-through to full property details on host site or modal

**Featured Listings Widget:**
- Horizontal scrolling carousel of properties
- 3-4 cards visible on desktop, responsive down to 1 on mobile
- Minimal chrome, image-focused
- Configurable: filter by agent, status, price range

**CMA Viewer Widget:**
- Shareable link generates embeddable comparison view
- Clean, print-friendly layout
- Includes branding customization options

---

## Data Visualization

**Charts & Graphs:**
- Use Chart.js or Recharts library
- Line charts for price trends over time
- Bar charts for comparable property metrics
- Donut charts for market composition (property types)
- Minimal styling: thin lines, subtle grid, clear labels

**Market Statistics Cards:**
- Grid of stat cards (2-4 columns)
- Large number display with label below
- Small trend indicator (up/down arrow with percentage)
- Examples: Avg Price, DOM, Price/SqFt, Active Listings

---

## Navigation & Structure

**Agent Dashboard Navigation:**
- Vertical sidebar (left): Dashboard, Properties, CMAs, Clients, Analytics, Settings
- Icons from Heroicons (outline style)
- Collapsible on smaller screens to icon-only

**Client Portal Navigation:**
- Horizontal top bar: Logo, My Properties, CMAs, Favorites, Contact Agent
- Minimal, clean design
- User account dropdown (top-right)

**Mobile Navigation:**
- Hamburger menu for vertical navigation
- Bottom tab bar for primary actions on property views

---

## Image Strategy

### Hero Sections
- Agent Dashboard: No hero - immediately show workspace
- Client Portal Landing: Large hero with beautiful property photography (50vh), centered welcome message overlay
- Public-Facing Landing (if applicable): Full-viewport hero (80vh) with luxury property image, value proposition headline

### Property Images
- High-quality MLS photos as primary content
- Image galleries with lightbox modal for full-screen viewing
- Thumbnail strips below main image
- Lazy loading for performance
- Fallback placeholder for missing images

### Supporting Imagery
- Agent headshots in portal and contact sections
- Neighborhood/location photos in property details
- Custom illustrations for empty states ("No CMAs yet", "Start your search")

---

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px (single column, stacked components)
- Tablet: 768px - 1024px (2-column grids)
- Desktop: > 1024px (3+ column grids, full feature set)

**Key Adaptations:**
- Property comparison: 2 properties on tablet, 3+ on desktop, 1 on mobile with swipe navigation
- Filter panels: slide-out drawer on mobile, inline on desktop
- Data tables: horizontal scroll or card view on mobile
- Maps: reduced height on mobile, full-featured on desktop

---

## Interaction Patterns

**Minimal Animations:**
- Hover states: subtle opacity/shadow changes (150ms ease)
- Card hover: translateY(-2px) with shadow
- Page transitions: simple fade (200ms)
- Loading states: skeleton screens (no spinners)
- Avoid: excessive motion, scroll-triggered animations, parallax

**Interactive Elements:**
- Favoriting: heart icon with filled/outline states
- Comparison: checkbox selection with visual confirmation
- Filters: immediate application (no "Apply" button)
- Sorting: dropdown or segmented control

---

## Accessibility & Best Practices

- ARIA labels for all interactive elements
- Keyboard navigation throughout
- Focus indicators on all focusable elements
- Alt text for all property images
- Form inputs with clear labels and error states
- Maintain 4.5:1 contrast ratios for text
- Touch targets minimum 44x44px on mobile

---

This design system creates a professional, efficient platform that serves both real estate agents and their clients while maintaining embeddability and scalability across different viewing contexts.