# CMA Schema and Routes Code

Copy these code snippets directly into your other app.

---

## 1. Database Schema (shared/schema.ts)

Add this to your schema file:

```typescript
// CMA Schema
export const cmas = pgTable("cmas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  subjectPropertyId: text("subject_property_id"),
  comparablePropertyIds: json("comparable_property_ids").$type<string[]>().notNull(),
  propertiesData: json("properties_data").$type<any[]>(),
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

// CMA Statistics Types
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

## 2. Storage Interface (server/storage.ts)

Add to IStorage interface:

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

Add implementations:

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

## 3. API Routes (server/routes.ts)

Add these routes:

```typescript
import { randomBytes } from "crypto";

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

// CMA CRUD routes
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

// CMA Share routes
app.post("/api/cmas/:id/share", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    const shareToken = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await storage.updateCma(req.params.id, {
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

// Public CMA view
app.get("/api/share/cma/:token", async (req, res) => {
  try {
    const cma = await storage.getCmaByShareToken(req.params.token);
    if (!cma) {
      res.status(404).json({ error: "CMA not found or link expired" });
      return;
    }

    if (cma.expiresAt && new Date(cma.expiresAt) < new Date()) {
      res.status(410).json({ error: "This CMA link has expired" });
      return;
    }

    const properties = (cma as any).propertiesData || [];
    const statistics = calculateStatistics(properties);
    
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

// CMA Statistics
app.get("/api/cmas/:id/statistics", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    const properties = (cma as any).propertiesData || [];
    res.json(calculateStatistics(properties));
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate statistics" });
  }
});

// CMA Timeline
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
```

---

## 4. SQL Migration

Run this to create the table:

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

CREATE INDEX idx_cmas_user_id ON cmas(user_id);
CREATE INDEX idx_cmas_public_link ON cmas(public_link);
```
