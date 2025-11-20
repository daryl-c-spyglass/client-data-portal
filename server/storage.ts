import { 
  type Property, 
  type InsertProperty,
  type Media,
  type InsertMedia,
  type SavedSearch,
  type InsertSavedSearch,
  type Cma,
  type InsertCma,
  type SearchCriteria,
  type PropertyStatistics,
  type TimelineDataPoint,
  type User,
  type InsertUser,
  properties,
  media,
  savedSearches,
  cmas,
  users
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, gte, lte, inArray, sql as drizzleSql } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Property operations
  getProperty(id: string): Promise<Property | undefined>;
  getPropertyByListingId(listingId: string): Promise<Property | undefined>;
  getProperties(criteria: SearchCriteria): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<Property>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;
  getAllProperties(): Promise<Property[]>;
  
  // Media operations
  getMedia(id: string): Promise<Media | undefined>;
  getMediaByResourceKey(resourceRecordKey: string): Promise<Media[]>;
  createMedia(media: InsertMedia): Promise<Media>;
  deleteMedia(id: string): Promise<boolean>;
  
  // Saved search operations
  getSavedSearch(id: string): Promise<SavedSearch | undefined>;
  getSavedSearchesByUser(userId: string): Promise<SavedSearch[]>;
  getAllSavedSearches(): Promise<SavedSearch[]>;
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  updateSavedSearch(id: string, search: Partial<SavedSearch>): Promise<SavedSearch | undefined>;
  deleteSavedSearch(id: string): Promise<boolean>;
  
  // CMA operations
  getCma(id: string): Promise<Cma | undefined>;
  getCmasByUser(userId: string): Promise<Cma[]>;
  getAllCmas(): Promise<Cma[]>;
  createCma(cma: InsertCma): Promise<Cma>;
  updateCma(id: string, cma: Partial<Cma>): Promise<Cma | undefined>;
  deleteCma(id: string): Promise<boolean>;
  
  // Statistics calculation
  calculateStatistics(propertyIds: string[]): Promise<PropertyStatistics>;
  getTimelineData(propertyIds: string[]): Promise<TimelineDataPoint[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private properties: Map<string, Property>;
  private media: Map<string, Media>;
  private savedSearches: Map<string, SavedSearch>;
  private cmas: Map<string, Cma>;

  constructor() {
    this.users = new Map();
    this.properties = new Map();
    this.media = new Map();
    this.savedSearches = new Map();
    this.cmas = new Map();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser as any,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Property operations
  async getProperty(id: string): Promise<Property | undefined> {
    return this.properties.get(id);
  }

  async getPropertyByListingId(listingId: string): Promise<Property | undefined> {
    return Array.from(this.properties.values()).find(
      (property) => property.listingId === listingId
    );
  }

  async getProperties(criteria: SearchCriteria): Promise<Property[]> {
    let properties = Array.from(this.properties.values()).filter(p => p.mlgCanView);

    // Apply status filter
    if (criteria.status && criteria.status.length > 0) {
      properties = properties.filter(p => 
        criteria.status!.includes(p.standardStatus as any)
      );
    }

    // Apply price range filter
    if (criteria.listPriceMin !== undefined) {
      properties = properties.filter(p => 
        p.listPrice && Number(p.listPrice) >= criteria.listPriceMin!
      );
    }
    if (criteria.listPriceMax !== undefined) {
      properties = properties.filter(p => 
        p.listPrice && Number(p.listPrice) <= criteria.listPriceMax!
      );
    }

    // Apply bedroom filter
    if (criteria.bedroomsMin !== undefined) {
      properties = properties.filter(p => 
        p.bedroomsTotal && p.bedroomsTotal >= criteria.bedroomsMin!
      );
    }
    if (criteria.bedroomsMax !== undefined) {
      properties = properties.filter(p => 
        p.bedroomsTotal && p.bedroomsTotal <= criteria.bedroomsMax!
      );
    }

    // Apply bathroom filter
    if (criteria.fullBathsMin !== undefined) {
      properties = properties.filter(p => 
        p.bathroomsFull && p.bathroomsFull >= criteria.fullBathsMin!
      );
    }

    // Apply living area filter
    if (criteria.livingArea) {
      if (criteria.livingArea.min !== undefined) {
        properties = properties.filter(p => 
          p.livingArea && Number(p.livingArea) >= criteria.livingArea!.min!
        );
      }
      if (criteria.livingArea.max !== undefined) {
        properties = properties.filter(p => 
          p.livingArea && Number(p.livingArea) <= criteria.livingArea!.max!
        );
      }
    }

    // Apply year built filter
    if (criteria.yearBuilt) {
      if (criteria.yearBuilt.min !== undefined) {
        properties = properties.filter(p => 
          p.yearBuilt && p.yearBuilt >= criteria.yearBuilt!.min!
        );
      }
      if (criteria.yearBuilt.max !== undefined) {
        properties = properties.filter(p => 
          p.yearBuilt && p.yearBuilt <= criteria.yearBuilt!.max!
        );
      }
    }

    // Apply city filter
    if (criteria.cities && criteria.cities.length > 0) {
      properties = properties.filter(p => 
        p.city && criteria.cities!.some(city => 
          p.city!.toLowerCase().includes(city.toLowerCase())
        )
      );
    }

    // Apply zip code filter
    if (criteria.zipCodes && criteria.zipCodes.length > 0) {
      properties = properties.filter(p => 
        p.postalCode && criteria.zipCodes!.includes(p.postalCode)
      );
    }

    return properties;
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const id = randomUUID();
    const property: Property = { 
      ...insertProperty as Property, 
      id 
    };
    this.properties.set(id, property);
    return property;
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<Property | undefined> {
    const property = this.properties.get(id);
    if (!property) return undefined;

    const updated = { ...property, ...updates };
    this.properties.set(id, updated);
    return updated;
  }

  async deleteProperty(id: string): Promise<boolean> {
    return this.properties.delete(id);
  }

  async getAllProperties(): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(p => p.mlgCanView);
  }

  // Media operations
  async getMedia(id: string): Promise<Media | undefined> {
    return this.media.get(id);
  }

  async getMediaByResourceKey(resourceRecordKey: string): Promise<Media[]> {
    return Array.from(this.media.values()).filter(
      (m) => m.resourceRecordKey === resourceRecordKey
    );
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const id = randomUUID();
    const mediaItem: Media = { 
      ...insertMedia as Media, 
      id 
    };
    this.media.set(id, mediaItem);
    return mediaItem;
  }

  async deleteMedia(id: string): Promise<boolean> {
    return this.media.delete(id);
  }

  // Saved search operations
  async getSavedSearch(id: string): Promise<SavedSearch | undefined> {
    return this.savedSearches.get(id);
  }

  async getSavedSearchesByUser(userId: string): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values()).filter(s => s.userId === userId);
  }

  async getAllSavedSearches(): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values());
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const id = randomUUID();
    const savedSearch: SavedSearch = {
      ...search as any,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.savedSearches.set(id, savedSearch);
    return savedSearch;
  }

  async updateSavedSearch(id: string, updates: Partial<SavedSearch>): Promise<SavedSearch | undefined> {
    const search = this.savedSearches.get(id);
    if (!search) return undefined;

    const updated = { ...search, ...updates, updatedAt: new Date() };
    this.savedSearches.set(id, updated);
    return updated;
  }

  async deleteSavedSearch(id: string): Promise<boolean> {
    return this.savedSearches.delete(id);
  }

  // CMA operations
  async getCma(id: string): Promise<Cma | undefined> {
    return this.cmas.get(id);
  }

  async getCmasByUser(userId: string): Promise<Cma[]> {
    return Array.from(this.cmas.values()).filter(c => c.userId === userId);
  }

  async getAllCmas(): Promise<Cma[]> {
    return Array.from(this.cmas.values());
  }

  async createCma(cma: InsertCma): Promise<Cma> {
    const id = randomUUID();
    const newCma: Cma = {
      ...cma as any,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.cmas.set(id, newCma);
    return newCma;
  }

  async updateCma(id: string, updates: Partial<Cma>): Promise<Cma | undefined> {
    const cma = this.cmas.get(id);
    if (!cma) return undefined;

    const updated = { ...cma, ...updates, updatedAt: new Date() };
    this.cmas.set(id, updated);
    return updated;
  }

  async deleteCma(id: string): Promise<boolean> {
    return this.cmas.delete(id);
  }

  // Statistics calculation
  async calculateStatistics(propertyIds: string[]): Promise<PropertyStatistics> {
    const properties = propertyIds
      .map(id => this.properties.get(id))
      .filter((p): p is Property => p !== undefined && p.mlgCanView);

    if (properties.length === 0) {
      throw new Error("No properties found for statistics calculation");
    }

    const getNumericValues = (field: keyof Property) => 
      properties
        .map(p => Number(p[field]))
        .filter(v => !isNaN(v) && v > 0);

    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
      
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      
      return { range: { min, max }, average, median };
    };

    const prices = getNumericValues('listPrice');
    const livingAreas = getNumericValues('livingArea');
    const pricesPerSqFt = properties
      .map(p => Number(p.listPrice) / Number(p.livingArea))
      .filter(v => !isNaN(v) && v > 0);

    return {
      price: calculateStats(prices),
      pricePerSqFt: calculateStats(pricesPerSqFt),
      daysOnMarket: calculateStats(getNumericValues('daysOnMarket')),
      livingArea: calculateStats(livingAreas),
      lotSize: calculateStats(getNumericValues('lotSizeSquareFeet')),
      acres: calculateStats(getNumericValues('lotSizeAcres')),
      bedrooms: calculateStats(getNumericValues('bedroomsTotal')),
      bathrooms: calculateStats(getNumericValues('bathroomsTotalInteger')),
      yearBuilt: calculateStats(getNumericValues('yearBuilt')),
    };
  }

  async getTimelineData(propertyIds: string[]): Promise<TimelineDataPoint[]> {
    const properties = propertyIds
      .map(id => this.properties.get(id))
      .filter((p): p is Property => p !== undefined && p.mlgCanView);

    return properties
      .filter(p => p.listingContractDate && p.listPrice && p.unparsedAddress)
      .map(p => ({
        date: new Date(p.listingContractDate!),
        price: Number(p.listPrice),
        status: p.standardStatus as 'Active' | 'Under Contract' | 'Closed',
        propertyId: p.id,
        address: p.unparsedAddress!,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

export class DbStorage implements IStorage {
  private db;

  constructor(connectionString: string) {
    const pool = new Pool({ connectionString });
    this.db = drizzle(pool, { schema: { users, properties, media, savedSearches, cmas } });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await this.db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id));
    return result.rowCount! > 0;
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const result = await this.db.select().from(properties).where(eq(properties.id, id)).limit(1);
    return result[0];
  }

  async getPropertyByListingId(listingId: string): Promise<Property | undefined> {
    const result = await this.db.select().from(properties).where(eq(properties.listingId, listingId)).limit(1);
    return result[0];
  }

  async getProperties(criteria: SearchCriteria): Promise<Property[]> {
    const conditions = [eq(properties.mlgCanView, true)];

    if (criteria.status && criteria.status.length > 0) {
      conditions.push(inArray(properties.standardStatus, criteria.status));
    }

    if (criteria.listPriceMin !== undefined) {
      conditions.push(gte(properties.listPrice, String(criteria.listPriceMin)));
    }
    if (criteria.listPriceMax !== undefined) {
      conditions.push(lte(properties.listPrice, String(criteria.listPriceMax)));
    }

    if (criteria.bedroomsMin !== undefined) {
      conditions.push(gte(properties.bedroomsTotal, criteria.bedroomsMin));
    }
    if (criteria.bedroomsMax !== undefined) {
      conditions.push(lte(properties.bedroomsTotal, criteria.bedroomsMax));
    }

    if (criteria.fullBathsMin !== undefined) {
      conditions.push(gte(properties.bathroomsFull, criteria.fullBathsMin));
    }

    if (criteria.livingArea?.min !== undefined) {
      conditions.push(gte(properties.livingArea, String(criteria.livingArea.min)));
    }
    if (criteria.livingArea?.max !== undefined) {
      conditions.push(lte(properties.livingArea, String(criteria.livingArea.max)));
    }

    if (criteria.yearBuilt?.min !== undefined) {
      conditions.push(gte(properties.yearBuilt, criteria.yearBuilt.min));
    }
    if (criteria.yearBuilt?.max !== undefined) {
      conditions.push(lte(properties.yearBuilt, criteria.yearBuilt.max));
    }

    if (criteria.cities && criteria.cities.length > 0) {
      conditions.push(inArray(properties.city, criteria.cities));
    }

    if (criteria.zipCodes && criteria.zipCodes.length > 0) {
      conditions.push(inArray(properties.postalCode, criteria.zipCodes));
    }

    return await this.db.select().from(properties).where(and(...conditions));
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const id = randomUUID();
    const result = await this.db.insert(properties).values({ ...insertProperty, id } as any).returning();
    return result[0];
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<Property | undefined> {
    const result = await this.db.update(properties).set(updates).where(eq(properties.id, id)).returning();
    return result[0];
  }

  async deleteProperty(id: string): Promise<boolean> {
    const result = await this.db.delete(properties).where(eq(properties.id, id));
    return result.rowCount! > 0;
  }

  async getAllProperties(): Promise<Property[]> {
    return await this.db.select().from(properties).where(eq(properties.mlgCanView, true));
  }

  async getMedia(id: string): Promise<Media | undefined> {
    const result = await this.db.select().from(media).where(eq(media.id, id)).limit(1);
    return result[0];
  }

  async getMediaByResourceKey(resourceRecordKey: string): Promise<Media[]> {
    return await this.db.select().from(media).where(eq(media.resourceRecordKey, resourceRecordKey));
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const id = randomUUID();
    const result = await this.db.insert(media).values({ ...insertMedia, id }).returning();
    return result[0];
  }

  async deleteMedia(id: string): Promise<boolean> {
    const result = await this.db.delete(media).where(eq(media.id, id));
    return result.rowCount! > 0;
  }

  async getSavedSearch(id: string): Promise<SavedSearch | undefined> {
    const result = await this.db.select().from(savedSearches).where(eq(savedSearches.id, id)).limit(1);
    return result[0];
  }

  async getSavedSearchesByUser(userId: string): Promise<SavedSearch[]> {
    return await this.db.select().from(savedSearches).where(eq(savedSearches.userId, userId));
  }

  async getAllSavedSearches(): Promise<SavedSearch[]> {
    return await this.db.select().from(savedSearches);
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const result = await this.db.insert(savedSearches).values(search).returning();
    return result[0];
  }

  async updateSavedSearch(id: string, updates: Partial<SavedSearch>): Promise<SavedSearch | undefined> {
    const result = await this.db.update(savedSearches).set({ ...updates, updatedAt: new Date() }).where(eq(savedSearches.id, id)).returning();
    return result[0];
  }

  async deleteSavedSearch(id: string): Promise<boolean> {
    const result = await this.db.delete(savedSearches).where(eq(savedSearches.id, id));
    return result.rowCount! > 0;
  }

  async getCma(id: string): Promise<Cma | undefined> {
    const result = await this.db.select().from(cmas).where(eq(cmas.id, id)).limit(1);
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
    const result = await this.db.update(cmas).set({ ...updates, updatedAt: new Date() }).where(eq(cmas.id, id)).returning();
    return result[0];
  }

  async deleteCma(id: string): Promise<boolean> {
    const result = await this.db.delete(cmas).where(eq(cmas.id, id));
    return result.rowCount! > 0;
  }

  async calculateStatistics(propertyIds: string[]): Promise<PropertyStatistics> {
    const props = await this.db.select().from(properties).where(
      and(
        inArray(properties.id, propertyIds),
        eq(properties.mlgCanView, true)
      )
    );

    if (props.length === 0) {
      throw new Error("No properties found for statistics calculation");
    }

    const getNumericValues = (field: keyof Property) => 
      props
        .map(p => Number(p[field]))
        .filter(v => !isNaN(v) && v > 0);

    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
      
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      
      return { range: { min, max }, average, median };
    };

    const prices = getNumericValues('listPrice');
    const livingAreas = getNumericValues('livingArea');
    const pricesPerSqFt = props
      .map(p => Number(p.listPrice) / Number(p.livingArea))
      .filter(v => !isNaN(v) && v > 0);

    return {
      price: calculateStats(prices),
      pricePerSqFt: calculateStats(pricesPerSqFt),
      daysOnMarket: calculateStats(getNumericValues('daysOnMarket')),
      livingArea: calculateStats(livingAreas),
      lotSize: calculateStats(getNumericValues('lotSizeSquareFeet')),
      acres: calculateStats(getNumericValues('lotSizeAcres')),
      bedrooms: calculateStats(getNumericValues('bedroomsTotal')),
      bathrooms: calculateStats(getNumericValues('bathroomsTotalInteger')),
      yearBuilt: calculateStats(getNumericValues('yearBuilt')),
    };
  }

  async getTimelineData(propertyIds: string[]): Promise<TimelineDataPoint[]> {
    const props = await this.db.select().from(properties).where(
      and(
        inArray(properties.id, propertyIds),
        eq(properties.mlgCanView, true)
      )
    );

    return props
      .filter(p => p.listingContractDate && p.listPrice && p.unparsedAddress)
      .map(p => ({
        date: new Date(p.listingContractDate!),
        price: Number(p.listPrice),
        status: p.standardStatus as 'Active' | 'Under Contract' | 'Closed',
        propertyId: p.id,
        address: p.unparsedAddress!,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

export const storage = process.env.DATABASE_URL 
  ? new DbStorage(process.env.DATABASE_URL)
  : new MemStorage();
