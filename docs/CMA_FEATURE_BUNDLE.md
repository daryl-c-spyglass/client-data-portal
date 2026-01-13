# CMA (Comparative Market Analysis) Feature Bundle

This document contains all the code and instructions needed to implement the CMA feature in another Replit app that already has Repliers API data.

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Storage Interface](#storage-interface)
4. [API Routes](#api-routes)
5. [Frontend Pages](#frontend-pages)
6. [Frontend Components](#frontend-components)
7. [Shared Types](#shared-types)
8. [Dependencies](#dependencies)
9. [Integration Steps](#integration-steps)

---

## Overview

The CMA feature allows agents to:
- Create Comparative Market Analyses with subject properties and comparables
- Search for comparable properties using Repliers API
- View statistics (price, price/sqft, DOM, etc.)
- Share CMAs via public links
- Email CMAs to clients
- Print/export CMA reports

---

## Database Schema

Add this to your `shared/schema.ts`:

```typescript
import { pgTable, varchar, text, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// CMA Schema
export const cmas = pgTable("cmas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Nullable for unauthenticated users
  name: text("name").notNull(),
  subjectPropertyId: text("subject_property_id"),
  comparablePropertyIds: json("comparable_property_ids").$type<string[]>().notNull(),
  propertiesData: json("properties_data").$type<any[]>(), // Store actual property data
  searchCriteria: json("search_criteria"),
  notes: text("notes"),
  publicLink: text("public_link").unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCmaSchema = createInsertSchema(cmas).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCma = z.infer<typeof insertCmaSchema>;
export type Cma = typeof cmas.$inferSelect;

// Property Statistics type for CMA reports
export interface PropertyStatistics {
  price: { range: { min: number; max: number }; average: number; median: number };
  pricePerSqFt: { range: { min: number; max: number }; average: number; median: number };
  daysOnMarket: { range: { min: number; max: number }; average: number; median: number };
  livingArea: { range: { min: number; max: number }; average: number; median: number };
  lotSize: { range: { min: number; max: number }; average: number; median: number };
  acres: { range: { min: number; max: number }; average: number; median: number };
  bedrooms: { range: { min: number; max: number }; average: number; median: number };
  bathrooms: { range: { min: number; max: number }; average: number; median: number };
  yearBuilt: { range: { min: number; max: number }; average: number; median: number };
}

// Timeline data for CMA charts
export interface TimelineDataPoint {
  date: string;
  price: number;
  status: string;
  propertyId: string;
  address: string;
  daysOnMarket: number | null;
  cumulativeDaysOnMarket: number | null;
}
```

---

## Storage Interface

Add these methods to your `IStorage` interface in `server/storage.ts`:

```typescript
// CMA operations
getCma(id: string): Promise<Cma | undefined>;
getCmaByShareToken(token: string): Promise<Cma | undefined>;
getCmasByUser(userId: string): Promise<Cma[]>;
getAllCmas(): Promise<Cma[]>;
createCma(cma: InsertCma): Promise<Cma>;
updateCma(id: string, cma: Partial<Cma>): Promise<Cma | undefined>;
deleteCma(id: string): Promise<boolean>;
```

### Implementation (PostgreSQL with Drizzle):

```typescript
async getCma(id: string): Promise<Cma | undefined> {
  const result = await this.db.select().from(cmas).where(eq(cmas.id, id)).limit(1);
  return result[0];
}

async getCmaByShareToken(token: string): Promise<Cma | undefined> {
  const result = await this.db.select().from(cmas).where(eq(cmas.publicLink, token)).limit(1);
  return result[0];
}

async getCmasByUser(userId: string): Promise<Cma[]> {
  return await this.db.select().from(cmas).where(eq(cmas.userId, userId));
}

async getAllCmas(): Promise<Cma[]> {
  return await this.db.select().from(cmas);
}

async createCma(cma: InsertCma): Promise<Cma> {
  const result = await this.db.insert(cmas).values(cma as any).returning();
  return result[0];
}

async updateCma(id: string, updates: Partial<Cma>): Promise<Cma | undefined> {
  const result = await this.db.update(cmas)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(cmas.id, id))
    .returning();
  return result[0];
}

async deleteCma(id: string): Promise<boolean> {
  const result = await this.db.delete(cmas).where(eq(cmas.id, id));
  return result.rowCount! > 0;
}
```

---

## API Routes

Add these routes to your `server/routes.ts`:

```typescript
import { randomBytes } from "crypto";
import { insertCmaSchema, type Cma } from "@shared/schema";

// CMA CRUD Routes
app.get("/api/cmas", async (req, res) => {
  try {
    const cmas = await storage.getAllCmas();
    res.json(cmas);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CMAs" });
  }
});

app.get("/api/cmas/:id", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json(cma);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CMA" });
  }
});

app.post("/api/cmas", async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user?.id || null;
    
    const cmaData = insertCmaSchema.parse({
      ...req.body,
      userId,
    });
    const cma = await storage.createCma(cmaData);
    res.status(201).json(cma);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid CMA data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create CMA" });
    }
  }
});

app.put("/api/cmas/:id", async (req, res) => {
  try {
    const cma = await storage.updateCma(req.params.id, req.body);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json(cma);
  } catch (error) {
    res.status(500).json({ error: "Failed to update CMA" });
  }
});

app.patch("/api/cmas/:id", async (req, res) => {
  try {
    const cma = await storage.updateCma(req.params.id, req.body);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json(cma);
  } catch (error) {
    res.status(500).json({ error: "Failed to update CMA" });
  }
});

app.delete("/api/cmas/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteCma(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete CMA" });
  }
});

// CMA Share Link Routes
app.post("/api/cmas/:id/share", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    // Generate unique share token
    const shareToken = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const updated = await storage.updateCma(req.params.id, {
      publicLink: shareToken,
      expiresAt,
    });

    res.json({
      shareToken,
      shareUrl: `${req.protocol}://${req.get('host')}/share/cma/${shareToken}`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate share link" });
  }
});

app.delete("/api/cmas/:id/share", async (req, res) => {
  try {
    const updated = await storage.updateCma(req.params.id, {
      publicLink: null,
      expiresAt: null,
    });
    if (!updated) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json({ message: "Share link removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove share link" });
  }
});

// Public CMA View (for shared links)
app.get("/api/share/cma/:token", async (req, res) => {
  try {
    const cma = await storage.getCmaByShareToken(req.params.token);
    if (!cma) {
      res.status(404).json({ error: "CMA not found or link expired" });
      return;
    }

    // Check expiration
    if (cma.expiresAt && new Date(cma.expiresAt) < new Date()) {
      res.status(410).json({ error: "This CMA link has expired" });
      return;
    }

    const properties = (cma as any).propertiesData || [];
    
    // Calculate statistics
    const statistics = calculateStatistics(properties);
    
    // Build timeline data
    const timelineData = properties
      .filter((p: any) => p.closeDate || p.listingContractDate)
      .map((p: any) => ({
        date: p.closeDate || p.listingContractDate,
        price: Number(p.closePrice || p.listPrice),
        status: p.standardStatus || 'Unknown',
        propertyId: p.id || p.listingId,
        address: p.unparsedAddress || 'Unknown',
        daysOnMarket: p.daysOnMarket ?? null,
        cumulativeDaysOnMarket: p.cumulativeDaysOnMarket ?? null,
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({
      cma: {
        id: cma.id,
        name: cma.name,
        notes: cma.notes,
        createdAt: cma.createdAt,
        expiresAt: cma.expiresAt,
        subjectPropertyId: cma.subjectPropertyId,
      },
      properties,
      statistics,
      timelineData,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load shared CMA" });
  }
});

// CMA Statistics endpoint
app.get("/api/cmas/:id/statistics", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    const properties = (cma as any).propertiesData || [];
    const statistics = calculateStatistics(properties);
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate statistics" });
  }
});

// CMA Timeline endpoint
app.get("/api/cmas/:id/timeline", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    const properties = (cma as any).propertiesData || [];
    const timelineData = properties
      .filter((p: any) => p.closeDate || p.listingContractDate)
      .map((p: any) => ({
        date: p.closeDate || p.listingContractDate,
        price: Number(p.closePrice || p.listPrice),
        status: p.standardStatus || 'Unknown',
        propertyId: p.id || p.listingId,
        address: p.unparsedAddress || 'Unknown',
        daysOnMarket: p.daysOnMarket ?? null,
        cumulativeDaysOnMarket: p.cumulativeDaysOnMarket ?? null,
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json(timelineData);
  } catch (error) {
    res.status(500).json({ error: "Failed to get timeline data" });
  }
});

// Helper function for statistics calculation
function calculateStatistics(properties: any[]) {
  const computeStats = (values: number[]) => {
    const filtered = values.filter(v => v > 0);
    if (filtered.length === 0) {
      return { average: 0, median: 0, range: { min: 0, max: 0 } };
    }
    const sorted = [...filtered].sort((a, b) => a - b);
    const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    return {
      average,
      median,
      range: { min: sorted[0], max: sorted[sorted.length - 1] }
    };
  };

  const prices = properties.map(p => {
    const isClosed = p.standardStatus === 'Closed';
    return isClosed 
      ? (p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0))
      : Number(p.listPrice || 0);
  });
  
  const pricesPerSqFt = properties
    .filter(p => p.livingArea && Number(p.livingArea) > 0)
    .map(p => {
      const isClosed = p.standardStatus === 'Closed';
      const price = isClosed 
        ? (p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0))
        : Number(p.listPrice || 0);
      return price / Number(p.livingArea);
    });

  return {
    price: computeStats(prices),
    pricePerSqFt: computeStats(pricesPerSqFt),
    daysOnMarket: computeStats(properties.map(p => p.daysOnMarket || 0)),
    livingArea: computeStats(properties.map(p => Number(p.livingArea || 0))),
    lotSize: computeStats(properties.map(p => Number(p.lotSizeSquareFeet || 0))),
    acres: computeStats(properties.map(p => Number(p.lotSizeAcres || 0))),
    bedrooms: computeStats(properties.map(p => p.bedroomsTotal || 0)),
    bathrooms: computeStats(properties.map(p => p.bathroomsTotalInteger || 0)),
    yearBuilt: computeStats(properties.map(p => p.yearBuilt || 0)),
  };
}
```

---

## Frontend Pages

You need to create these pages in `client/src/pages/`:

### 1. CMAs.tsx (List Page)
Copy from: `client/src/pages/CMAs.tsx`

### 2. CMANew.tsx (Create/Modify Page)  
Copy from: `client/src/pages/CMANew.tsx`

### 3. CMADetailPage.tsx (View CMA)
Copy from: `client/src/pages/CMADetailPage.tsx`

### 4. SharedCMAView.tsx (Public View)
Copy from: `client/src/pages/SharedCMAView.tsx`

---

## Frontend Components

Copy these components to `client/src/components/`:

### 1. CMABuilder.tsx
Copy from: `client/src/components/CMABuilder.tsx`
- Handles search criteria form
- Property selection
- Subject property designation
- Comparable property management

### 2. CMAReport.tsx  
Copy from: `client/src/components/CMAReport.tsx`
- Statistics display
- Property comparison table
- Charts (price timeline, price/sqft scatter)
- Map view with property markers
- Print/export functionality

---

## Dependencies

Make sure these packages are installed:

```bash
npm install recharts react-leaflet leaflet @types/leaflet
```

Also add Leaflet CSS import in your main CSS or component:
```css
@import "leaflet/dist/leaflet.css";
```

---

## Integration Steps

### Step 1: Add Database Table
Run this SQL migration:
```sql
CREATE TABLE cmas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  name TEXT NOT NULL,
  subject_property_id TEXT,
  comparable_property_ids JSON NOT NULL,
  properties_data JSON,
  search_criteria JSON,
  notes TEXT,
  public_link TEXT UNIQUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Step 2: Update Schema
Add the CMA schema types to your `shared/schema.ts`

### Step 3: Update Storage
Add CMA methods to your storage interface and implementation

### Step 4: Add Routes
Add CMA API routes to your `server/routes.ts`

### Step 5: Add Frontend Pages
1. Copy the page files to `client/src/pages/`
2. Add routes in `client/src/App.tsx`:

```tsx
import CMAs from "@/pages/CMAs";
import CMANew from "@/pages/CMANew";
import CMADetailPage from "@/pages/CMADetailPage";
import SharedCMAView from "@/pages/SharedCMAView";

// Inside your Router:
<Route path="/cmas" component={CMAs} />
<Route path="/cmas/new" component={CMANew} />
<Route path="/cmas/:id" component={CMADetailPage} />
<Route path="/share/cma/:token" component={SharedCMAView} />
```

### Step 6: Add Navigation
Add a CMA link to your sidebar/navigation:
```tsx
<Link href="/cmas">
  <FileText className="w-4 h-4" />
  CMAs
</Link>
```

### Step 7: Update Repliers Search
The CMABuilder uses your existing `/api/search` endpoint. Make sure it returns properties with these fields:
- `id` or `listingId`
- `standardStatus` (Active, Active Under Contract, Closed)
- `listPrice`, `closePrice`
- `livingArea`, `lotSizeSquareFeet`, `lotSizeAcres`
- `bedroomsTotal`, `bathroomsTotalInteger`
- `daysOnMarket`, `yearBuilt`
- `city`, `subdivisionName`, `unparsedAddress`
- `closeDate`, `listingContractDate`
- `photos` (array of image URLs)

---

## File Locations Summary

| File | Source Location |
|------|-----------------|
| Schema | `shared/schema.ts` (CMA section) |
| Storage | `server/storage.ts` (CMA methods) |
| Routes | `server/routes.ts` (CMA routes) |
| CMAs List | `client/src/pages/CMAs.tsx` |
| CMA New | `client/src/pages/CMANew.tsx` |
| CMA Detail | `client/src/pages/CMADetailPage.tsx` |
| Shared View | `client/src/pages/SharedCMAView.tsx` |
| CMA Builder | `client/src/components/CMABuilder.tsx` |
| CMA Report | `client/src/components/CMAReport.tsx` |

---

## Notes

1. The CMABuilder component is ~2700 lines and includes:
   - Autocomplete inputs for city/subdivision
   - Property type filter
   - Status filter (Active, Under Contract, Sold)
   - Price/beds/baths/sqft filters
   - Map polygon search
   - Visual match AI search (optional)
   - Property cards with selection

2. The CMAReport component is ~4200 lines and includes:
   - Statistics cards with range/average/median
   - Comparable properties table
   - Price timeline chart
   - Price per sqft scatter chart
   - Property map with markers
   - Pricing strategy section
   - Print styles

3. Both components have extensive styling that may need adjustment for your app's design system.
