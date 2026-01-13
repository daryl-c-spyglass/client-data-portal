# CMA Feature Integration Prompts

Use these prompts in your other Replit app to integrate the CMA feature step by step.

---

## PROMPT 1: Database Schema

Copy this prompt to add the CMA database schema:

```
Add the CMA (Comparative Market Analysis) database schema to my project.

Create a new table called "cmas" with these columns:
- id: varchar primary key with auto-generated UUID
- userId: varchar foreign key to users table (nullable for unauthenticated users)
- name: text, not null (CMA report name)
- subjectPropertyId: text (the main property being analyzed)
- comparablePropertyIds: json array of strings (list of comparable property IDs)
- propertiesData: json array (stores actual property data from search results)
- searchCriteria: json (stores the search filters used)
- notes: text (agent notes for the CMA)
- publicLink: text, unique (share token for public access)
- expiresAt: timestamp (when the share link expires)
- createdAt: timestamp, default now
- updatedAt: timestamp, default now

Also add these types to shared/schema.ts:
- insertCmaSchema using createInsertSchema with id, createdAt, updatedAt omitted
- InsertCma type using z.infer
- Cma select type

Add PropertyStatistics interface with these metrics:
- price, pricePerSqFt, daysOnMarket, livingArea, lotSize, acres, bedrooms, bathrooms, yearBuilt
- Each with: range (min/max), average, median

Add TimelineDataPoint interface:
- date, price, status, propertyId, address, daysOnMarket, cumulativeDaysOnMarket
```

---

## PROMPT 2: Storage Interface

Copy this prompt to add CMA storage methods:

```
Add CMA storage methods to my storage interface.

Add these methods to IStorage:
- getCma(id: string): Promise<Cma | undefined>
- getCmaByShareToken(token: string): Promise<Cma | undefined>  
- getCmasByUser(userId: string): Promise<Cma[]>
- getAllCmas(): Promise<Cma[]>
- createCma(cma: InsertCma): Promise<Cma>
- updateCma(id: string, cma: Partial<Cma>): Promise<Cma | undefined>
- deleteCma(id: string): Promise<boolean>

Implement using Drizzle ORM with PostgreSQL:
- getCma: select from cmas where id matches
- getCmaByShareToken: select from cmas where publicLink matches
- getCmasByUser: select from cmas where userId matches
- getAllCmas: select all from cmas
- createCma: insert into cmas and return
- updateCma: update cmas set values and updatedAt where id matches
- deleteCma: delete from cmas where id matches, return true if deleted
```

---

## PROMPT 3: API Routes

Copy this prompt to add CMA API routes:

```
Add CMA API routes to server/routes.ts.

Create these endpoints:

GET /api/cmas - Get all CMAs
GET /api/cmas/:id - Get single CMA by ID
POST /api/cmas - Create new CMA (validate with insertCmaSchema, get userId from req.user)
PUT /api/cmas/:id - Full update CMA
PATCH /api/cmas/:id - Partial update CMA (for notes, etc)
DELETE /api/cmas/:id - Delete CMA

POST /api/cmas/:id/share - Generate share link:
  - Create random 16-byte hex token
  - Set expiresAt to 30 days from now
  - Update CMA with publicLink and expiresAt
  - Return { shareToken, shareUrl }

DELETE /api/cmas/:id/share - Remove share link:
  - Set publicLink and expiresAt to null

GET /api/share/cma/:token - Public CMA view:
  - Get CMA by share token
  - Check if expired
  - Return { cma: { id, name, notes, createdAt, expiresAt }, properties, statistics, timelineData }

GET /api/cmas/:id/statistics - Calculate and return PropertyStatistics from propertiesData
GET /api/cmas/:id/timeline - Calculate and return TimelineDataPoint[] from propertiesData

Include a calculateStatistics helper function that computes average, median, range for each metric.
```

---

## PROMPT 4: Frontend Routes

Copy this prompt to add CMA routes:

```
Add CMA page routes to my React app.

In App.tsx, add these routes:
<Route path="/cmas" component={CMAs} />
<Route path="/cmas/new" component={CMANew} />
<Route path="/cmas/:id" component={CMADetailPage} />
<Route path="/share/cma/:token" component={SharedCMAView} />

Add navigation link to sidebar:
- Link to "/cmas" with FileText icon and "CMAs" label
```

---

## PROMPT 5: CMA List Page

Copy this prompt to create the CMAs list page:

```
Create client/src/pages/CMAs.tsx - a list/dashboard page for CMAs.

Features:
- Query /api/cmas to get all CMAs
- Show sorting dropdown (newest, oldest, A-Z, Z-A)
- Display CMAs as cards in a grid (1/2/3 columns responsive)
- Each card shows:
  - CMA name (line-clamped)
  - FileText icon
  - Created date with Calendar icon
  - Modified date if different from created
  - Number of comparable properties
- Cards link to /cmas/:id
- Include "Create New CMA" button linking to /cmas/new
- Show empty state with "No CMAs yet" message and Get Started button
- Use hover-elevate on cards
- Add loading skeleton state
```

---

## PROMPT 6: CMA Create Page

Copy this prompt to create the CMA creation page:

```
Create client/src/pages/CMANew.tsx - page for creating/modifying CMAs.

Features:
- Parse URL params: "from" (CMA ID to copy), "fromProperties" (boolean)
- If fromProperties=true, read pre-selected properties from sessionStorage
- If from=ID, fetch that CMA and pre-fill form with "(Modified)" suffix on name
- Use CMABuilder component for the form
- On create:
  - POST to /api/cmas
  - Invalidate /api/cmas query
  - Show success toast
  - Navigate to /cmas/:newId
- Show back button to /cmas or /properties depending on source
- Dynamic page title: "Create New CMA" / "Modify CMA" / "Quick CMA"
```

---

## PROMPT 7: CMA Detail Page

Copy this prompt to create the CMA detail page:

```
Create client/src/pages/CMADetailPage.tsx - view and manage a CMA.

Features:
- Fetch CMA data, statistics, and timeline via separate queries
- Display CMA name and "Shared" badge if publicLink exists
- Action buttons:
  - Copy Email: Generate client email template with CMA data
  - Produce URL: Generate/copy share link
  - Print: window.print()
  - Share: Dialog to manage share link with copy button and social sharing

Share Dialog includes:
- Copy link button
- Social media buttons (Facebook, X, Instagram, TikTok)
- Remove share link button
- Email share form (sender name/email, recipient name/email, comments)

Email Share modal:
- Form fields for your name, email, friend's name, friend's email, comments
- POST to /api/cmas/:id/email-share

Additional buttons:
- Add Notes: Dialog to edit notes with PATCH
- Modify Search: Navigate to /cmas/new?from=:id
- Modify Stats: Dialog to toggle visible metrics

Render CMAReport component with:
- properties from propertiesData
- statistics
- timelineData
- notes
- subjectPropertyId
- Action handlers for save, share, print, modify
```

---

## PROMPT 8: Shared CMA View

Copy this prompt to create the public shared view:

```
Create client/src/pages/SharedCMAView.tsx - public view for shared CMAs.

Features:
- Get token from URL params
- Fetch /api/share/cma/:token
- Show loading spinner while fetching
- Show error card if CMA not found or expired
- Display branded header with logo, CMA name, expiration date
- Render CMAReport component with fetched data
- Display branded footer with creation date
- No action buttons (read-only view)
```

---

## PROMPT 9: CMA Builder Component

```
Create client/src/components/CMABuilder.tsx - the main CMA creation form (~2700 lines).

This is a complex component with:

1. Search Form (Tabs: Criteria / Map):
   - Autocomplete inputs for City, Subdivision using /api/autocomplete/* endpoints
   - Zip code input
   - School district/school inputs (elementary, middle, high)
   - Min/Max beds, baths selects
   - Min/Max price selects
   - Property type select (Single Family, Condo, Townhouse, etc.)
   - Status checkboxes (Active, Under Contract, Closed)
   - Close Date select (shown only for Closed status)
   - Min/Max sqft inputs
   - Min/Max lot acres inputs
   - Stories select
   - Min/Max year built inputs
   - Search button that queries /api/search

2. Map Search Tab:
   - PolygonMapSearch component for drawing areas
   - Same filters as criteria tab
   - Polygon search via /api/properties/search/polygon

3. Visual Match AI (optional):
   - VisualMatchPanel component
   - Upload reference images
   - Rank results by visual similarity via /api/repliers/image-search

4. Results Display:
   - View mode toggle (Grid, List, Table)
   - Status filter tabs (All, Active, Under Contract, Sold)
   - Property cards with:
     - Photo carousel
     - Price badge
     - Address, beds/baths/sqft
     - Status, DOM, year built
     - Click to select/deselect
     - Click star to set as subject

5. Selected Properties Panel:
   - Subject Property card with remove button
   - Comparables list with count
   - Remove individual comps

6. CMA Name Input:
   - Auto-generated from subdivision + status + date
   - User can override

7. Create CMA Button:
   - Validate: need at least 1 property, need name
   - Call onCreateCMA with { name, subjectPropertyId, comparablePropertyIds, propertiesData, searchCriteria }

Props:
- onCreateCMA: callback function
- initialData: optional { name, searchCriteria, comparables, subjectProperty }
```

---

## PROMPT 10: CMA Report Component

```
Create client/src/components/CMAReport.tsx - the CMA report display (~4200 lines).

This is a complex component with:

1. Statistics Section:
   - Horizontal scrollable cards for each metric
   - Each card shows: metric name, range (min-max), average, median
   - Metrics: Price, Price/SqFt, Days on Market, Living SqFt, Lot SqFt, Acres, Beds, Baths, Year Built

2. Compare Tab (Main View):
   - Horizontal scrollable property cards
   - Each card shows:
     - Large photo with carousel dots
     - Price badge with status color
     - Address
     - Beds/baths/sqft/lot/year
     - Status and DOM
     - Days on market bar
     - Include/Exclude checkbox

3. List Tab:
   - Detailed table view
   - Columns: Photo, Address, Price, Beds, Baths, SqFt, Lot, Year, DOM, Status
   - Sortable columns
   - Include/Exclude toggles

4. Map Tab:
   - Leaflet map with property markers
   - Price label markers (CloudCMA style)
   - Color coding: Blue=Subject, Green=Active, Orange=Under Contract, Gray/Red=Sold
   - Click marker for popup with property details

5. Charts Tab:
   - Price Timeline line chart (Recharts)
   - Price per SqFt scatter chart
   - Status filter checkboxes
   - Click data point to view property details

6. Pricing Strategy Section:
   - Dynamic pricing suggestion based on market analysis
   - Suggested price range
   - Market trend indicator
   - List-to-sale ratio
   - DOM analysis
   - Confidence score

7. Subject Property Integration:
   - Subject property highlighted with different color
   - Shown on charts and maps
   - Referenced in pricing suggestions

8. Print Styles:
   - Optimized for printing
   - Hide interactive elements in print mode
   - Page break handling

Props:
- properties: Property[]
- statistics: PropertyStatistics
- timelineData: TimelineDataPoint[]
- isPreview: boolean
- expiresAt: Date
- visibleMetrics: StatMetricKey[]
- notes: string
- reportTitle: string
- subjectPropertyId: string
- onSave, onShareCMA, onPublicLink, onModifySearch, onModifyStats, onAddNotes, onPrint
```

---

## Dependencies to Install

```
npm install recharts react-leaflet leaflet @types/leaflet
```

Add to your CSS:
```css
@import "leaflet/dist/leaflet.css";
```

---

## Property Fields Required from Repliers API

Your /api/search endpoint should return properties with these fields:
- id, listingId
- standardStatus (Active, Active Under Contract, Closed)
- listPrice, closePrice
- livingArea, lotSizeSquareFeet, lotSizeAcres
- bedroomsTotal, bathroomsTotalInteger
- daysOnMarket, yearBuilt
- city, subdivisionName, unparsedAddress
- closeDate, listingContractDate
- photos (array of URLs)
- latitude, longitude (for map)
