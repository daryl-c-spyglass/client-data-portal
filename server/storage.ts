import { 
  type Property, 
  type InsertProperty,
  type Media,
  type InsertMedia,
  type SavedSearch,
  type InsertSavedSearch,
  type Cma,
  type InsertCma,
  type SellerUpdate,
  type InsertSellerUpdate,
  type SellerUpdateSendHistory,
  type InsertSellerUpdateSendHistory,
  type LeadGateSettings,
  type InsertLeadGateSettings,
  type UpdateLeadGateSettings,
  type DisplayPreferences,
  type UpdateDisplayPreferences,
  type SearchCriteria,
  type PropertyStatistics,
  type TimelineDataPoint,
  type User,
  type InsertUser,
  type WpFavorite,
  type InsertWpFavorite,
  type AgentProfile,
  type InsertAgentProfile,
  type UpdateAgentProfile,
  type CompanySettings,
  type UpdateCompanySettings,
  type CustomReportPage,
  type InsertCustomReportPage,
  type UpdateCustomReportPage,
  type CmaReportConfig,
  type InsertCmaReportConfig,
  type UpdateCmaReportConfig,
  properties,
  media,
  savedSearches,
  cmas,
  sellerUpdates,
  sellerUpdateSendHistory,
  leadGateSettings,
  displayPreferences,
  users,
  wpFavorites,
  agentProfiles,
  companySettings,
  customReportPages,
  cmaReportConfigs
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, gte, lte, inArray, ilike, or, sql as drizzleSql } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Property operations
  getProperty(id: string): Promise<Property | undefined>;
  getPropertyByListingId(listingId: string): Promise<Property | undefined>;
  getProperties(criteria: SearchCriteria, limit?: number, offset?: number): Promise<Property[]>;
  searchProperties(filters: {
    city?: string;
    postalCode?: string;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    maxBeds?: number;
    minBaths?: number;
    minSqft?: number;
    maxSqft?: number;
    subdivision?: string;
    status?: string;
    limit?: number;
    elementarySchools?: string[];
    middleSchools?: string[];
    highSchools?: string[];
    schoolDistrict?: string[];
    closeDateAfter?: string; // YYYY-MM-DD format for filtering closed properties by date
  }): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<Property>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;
  getAllProperties(): Promise<Property[]>;
  getPropertyCount(): Promise<number>;
  getClosedPropertyCount(): Promise<number>;
  getClosedPropertyCountsBySubtype(): Promise<Record<string, number>>;
  getPropertiesForAudit(limit: number): Promise<Array<{ id: number; listingId: string | null; standardStatus: string | null; propertySubType: string | null }>>;
  
  // Media operations
  getMedia(id: string): Promise<Media | undefined>;
  getMediaByKey(mediaKey: string): Promise<Media | undefined>;
  getMediaByResourceKey(resourceRecordKey: string): Promise<Media[]>;
  getMediaForListingIds(listingIds: string[]): Promise<Record<string, Media[]>>;
  createMedia(media: InsertMedia): Promise<Media>;
  updateMedia(id: string, media: Partial<Media>): Promise<Media | undefined>;
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
  getCmaByShareToken(token: string): Promise<Cma | undefined>;
  getCmasByUser(userId: string): Promise<Cma[]>;
  getAllCmas(): Promise<Cma[]>;
  createCma(cma: InsertCma): Promise<Cma>;
  updateCma(id: string, cma: Partial<Cma>): Promise<Cma | undefined>;
  deleteCma(id: string): Promise<boolean>;
  
  // Seller Update operations
  getSellerUpdate(id: string): Promise<SellerUpdate | undefined>;
  getSellerUpdatesByUser(userId: string): Promise<SellerUpdate[]>;
  getAllSellerUpdates(): Promise<SellerUpdate[]>;
  getActiveSellerUpdates(): Promise<SellerUpdate[]>;
  getDueSellerUpdates(): Promise<SellerUpdate[]>;
  createSellerUpdate(update: InsertSellerUpdate): Promise<SellerUpdate>;
  updateSellerUpdate(id: string, update: Partial<SellerUpdate>): Promise<SellerUpdate | undefined>;
  deleteSellerUpdate(id: string): Promise<boolean>;
  
  // Seller Update Send History operations
  getSendHistory(sellerUpdateId: string, limit?: number): Promise<SellerUpdateSendHistory[]>;
  createSendHistory(history: InsertSellerUpdateSendHistory): Promise<SellerUpdateSendHistory>;
  
  // Statistics calculation
  calculateStatistics(propertyIds: string[]): Promise<PropertyStatistics>;
  getTimelineData(propertyIds: string[]): Promise<TimelineDataPoint[]>;
  
  // Lead Gate Settings operations
  getLeadGateSettings(): Promise<LeadGateSettings | undefined>;
  updateLeadGateSettings(settings: UpdateLeadGateSettings): Promise<LeadGateSettings>;
  
  // Display Preferences operations
  getDisplayPreferences(): Promise<DisplayPreferences | undefined>;
  updateDisplayPreferences(preferences: UpdateDisplayPreferences): Promise<DisplayPreferences>;
  
  // Autocomplete operations (optimized)
  getAutocompleteCities(search: string, limit?: number): Promise<{ value: string; count: number }[]>;
  getAutocompleteZipCodes(search: string, limit?: number): Promise<{ value: string; count: number }[]>;
  getAutocompleteSubdivisions(search: string, limit?: number): Promise<{ value: string; count: number }[]>;
  getAutocompleteElementarySchools(search: string, limit?: number): Promise<{ value: string; count: number }[]>;
  getAutocompleteMiddleSchools(search: string, limit?: number): Promise<{ value: string; count: number }[]>;
  getAutocompleteHighSchools(search: string, limit?: number): Promise<{ value: string; count: number }[]>;
  getAutocompleteSchoolDistricts(search: string, limit?: number): Promise<{ value: string; count: number }[]>;
  
  // WordPress Favorites operations
  getWpFavoritesByUser(wpUserId: string): Promise<WpFavorite[]>;
  createWpFavorite(favorite: InsertWpFavorite): Promise<WpFavorite>;
  deleteWpFavorite(wpUserId: string, propertyId: string): Promise<boolean>;
  getWpFavorite(wpUserId: string, propertyId: string): Promise<WpFavorite | undefined>;
  
  // Agent Profile operations
  getAgentProfile(userId: string): Promise<AgentProfile | undefined>;
  createAgentProfile(profile: InsertAgentProfile): Promise<AgentProfile>;
  updateAgentProfile(userId: string, profile: UpdateAgentProfile): Promise<AgentProfile | undefined>;
  
  // Company Settings operations
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: UpdateCompanySettings): Promise<CompanySettings>;
  
  // Custom Report Pages operations
  getCustomReportPages(): Promise<CustomReportPage[]>;
  getCustomReportPage(id: string): Promise<CustomReportPage | undefined>;
  createCustomReportPage(page: InsertCustomReportPage): Promise<CustomReportPage>;
  updateCustomReportPage(id: string, page: UpdateCustomReportPage): Promise<CustomReportPage | undefined>;
  deleteCustomReportPage(id: string): Promise<boolean>;
  
  // CMA Report Config operations
  getCmaReportConfig(cmaId: string): Promise<CmaReportConfig | undefined>;
  createCmaReportConfig(config: InsertCmaReportConfig): Promise<CmaReportConfig>;
  updateCmaReportConfig(cmaId: string, config: UpdateCmaReportConfig): Promise<CmaReportConfig | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private properties: Map<string, Property>;
  private media: Map<string, Media>;
  private savedSearches: Map<string, SavedSearch>;
  private cmas: Map<string, Cma>;
  private sellerUpdates: Map<string, SellerUpdate>;
  private wpFavoritesMap: Map<string, WpFavorite>;

  constructor() {
    this.users = new Map();
    this.properties = new Map();
    this.media = new Map();
    this.savedSearches = new Map();
    this.cmas = new Map();
    this.sellerUpdates = new Map();
    this.wpFavoritesMap = new Map();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
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

  async getProperties(criteria: SearchCriteria, limit?: number, offset?: number): Promise<Property[]> {
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

    // Apply pagination
    const start = offset || 0;
    const end = limit !== undefined ? start + limit : properties.length;
    
    return properties.slice(start, end);
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

  async getPropertyCount(): Promise<number> {
    return Array.from(this.properties.values()).filter(p => p.mlgCanView).length;
  }

  async getClosedPropertyCount(): Promise<number> {
    return Array.from(this.properties.values()).filter(p => 
      p.mlgCanView && p.standardStatus === 'Closed'
    ).length;
  }

  async getClosedPropertyCountsBySubtype(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {
      'Single Family Residence': 0,
      'Condominium': 0,
      'Townhouse': 0,
      'Multi-Family': 0,
      'Land/Ranch': 0,
      'Other': 0,
    };
    
    const closedProperties = Array.from(this.properties.values()).filter(p => 
      p.mlgCanView && p.standardStatus === 'Closed'
    );
    
    closedProperties.forEach(p => {
      const subtype = (p.propertySubType || p.propertyType || '').toLowerCase();
      if (subtype.includes('single') || subtype.includes('detached') || subtype.includes('residential')) {
        counts['Single Family Residence']++;
      } else if (subtype.includes('condo')) {
        counts['Condominium']++;
      } else if (subtype.includes('town')) {
        counts['Townhouse']++;
      } else if (subtype.includes('multi') || subtype.includes('duplex') || subtype.includes('triplex')) {
        counts['Multi-Family']++;
      } else if (subtype.includes('land') || subtype.includes('ranch') || subtype.includes('lot') || subtype.includes('farm')) {
        counts['Land/Ranch']++;
      } else {
        counts['Other']++;
      }
    });
    
    return counts;
  }

  async getPropertiesForAudit(limit: number): Promise<Array<{ id: number; listingId: string | null; standardStatus: string | null; propertySubType: string | null }>> {
    return Array.from(this.properties.values())
      .slice(0, limit)
      .map(p => ({
        id: typeof p.id === 'string' ? parseInt(p.id, 10) : p.id,
        listingId: p.listingId || null,
        standardStatus: p.standardStatus || null,
        propertySubType: p.propertySubType || null,
      }));
  }

  async searchProperties(filters: {
    city?: string;
    postalCode?: string;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    maxBeds?: number;
    minBaths?: number;
    minSqft?: number;
    maxSqft?: number;
    subdivision?: string;
    status?: string;
    limit?: number;
    elementarySchools?: string[];
    middleSchools?: string[];
    highSchools?: string[];
    schoolDistrict?: string[];
    closeDateAfter?: string; // YYYY-MM-DD format for filtering closed properties by date
  }): Promise<Property[]> {
    let props = Array.from(this.properties.values()).filter(p => p.mlgCanView);

    if (filters.city) {
      props = props.filter(p => p.city?.toLowerCase().includes(filters.city!.toLowerCase()));
    }
    if (filters.postalCode) {
      props = props.filter(p => p.postalCode === filters.postalCode);
    }
    if (filters.minPrice !== undefined) {
      props = props.filter(p => p.listPrice && Number(p.listPrice) >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      props = props.filter(p => p.listPrice && Number(p.listPrice) <= filters.maxPrice!);
    }
    if (filters.minBeds !== undefined) {
      props = props.filter(p => p.bedroomsTotal && p.bedroomsTotal >= filters.minBeds!);
    }
    if (filters.maxBeds !== undefined) {
      props = props.filter(p => p.bedroomsTotal && p.bedroomsTotal <= filters.maxBeds!);
    }
    if (filters.minBaths !== undefined) {
      props = props.filter(p => p.bathroomsTotalInteger && p.bathroomsTotalInteger >= filters.minBaths!);
    }
    if (filters.minSqft !== undefined) {
      props = props.filter(p => p.livingArea && Number(p.livingArea) >= filters.minSqft!);
    }
    if (filters.maxSqft !== undefined) {
      props = props.filter(p => p.livingArea && Number(p.livingArea) <= filters.maxSqft!);
    }
    if (filters.subdivision) {
      props = props.filter(p => p.subdivision?.toLowerCase().includes(filters.subdivision!.toLowerCase()));
    }
    if (filters.status) {
      props = props.filter(p => p.standardStatus === filters.status);
    }
    // Close date filter for Closed/Sold properties
    if (filters.closeDateAfter) {
      const cutoffDate = new Date(filters.closeDateAfter);
      props = props.filter(p => p.closeDate && new Date(p.closeDate) >= cutoffDate);
    }
    // School filters (case-insensitive partial match)
    if (filters.elementarySchools && filters.elementarySchools.length > 0) {
      props = props.filter(p => {
        const school = p.elementarySchool?.toLowerCase() || '';
        return filters.elementarySchools!.some(s => school.includes(s.toLowerCase()));
      });
    }
    if (filters.middleSchools && filters.middleSchools.length > 0) {
      props = props.filter(p => {
        const school = p.middleOrJuniorSchool?.toLowerCase() || '';
        return filters.middleSchools!.some(s => school.includes(s.toLowerCase()));
      });
    }
    if (filters.highSchools && filters.highSchools.length > 0) {
      props = props.filter(p => {
        const school = p.highSchool?.toLowerCase() || '';
        return filters.highSchools!.some(s => school.includes(s.toLowerCase()));
      });
    }
    if (filters.schoolDistrict && filters.schoolDistrict.length > 0) {
      props = props.filter(p => {
        const district = p.schoolDistrict?.toLowerCase() || '';
        return filters.schoolDistrict!.some(s => district.includes(s.toLowerCase()));
      });
    }

    const effectiveLimit = filters.limit ?? 100;
    return props.slice(0, effectiveLimit);
  }

  // Media operations
  async getMedia(id: string): Promise<Media | undefined> {
    return this.media.get(id);
  }

  async getMediaByKey(mediaKey: string): Promise<Media | undefined> {
    return Array.from(this.media.values()).find(m => m.mediaKey === mediaKey);
  }

  async getMediaByResourceKey(resourceRecordKey: string): Promise<Media[]> {
    return Array.from(this.media.values()).filter(
      (m) => m.resourceRecordKey === resourceRecordKey
    );
  }

  async getMediaForListingIds(listingIds: string[]): Promise<Record<string, Media[]>> {
    const result: Record<string, Media[]> = {};
    if (listingIds.length === 0) return result;
    
    const allMedia = Array.from(this.media.values()).filter(
      (m) => m.resourceRecordKey && listingIds.includes(m.resourceRecordKey)
    );
    
    for (const m of allMedia) {
      const key = m.resourceRecordKey!;
      if (!result[key]) result[key] = [];
      result[key].push(m);
    }
    
    // Sort each array by order
    for (const key in result) {
      result[key].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    
    return result;
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

  async updateMedia(id: string, updates: Partial<Media>): Promise<Media | undefined> {
    const mediaItem = this.media.get(id);
    if (!mediaItem) return undefined;

    const updated = { ...mediaItem, ...updates };
    this.media.set(id, updated);
    return updated;
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

  async getCmaByShareToken(token: string): Promise<Cma | undefined> {
    return Array.from(this.cmas.values()).find(c => c.publicLink === token);
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

  // Seller Update operations
  async getSellerUpdate(id: string): Promise<SellerUpdate | undefined> {
    return this.sellerUpdates.get(id);
  }

  async getSellerUpdatesByUser(userId: string): Promise<SellerUpdate[]> {
    return Array.from(this.sellerUpdates.values()).filter(u => u.userId === userId);
  }

  async getAllSellerUpdates(): Promise<SellerUpdate[]> {
    return Array.from(this.sellerUpdates.values());
  }

  async getActiveSellerUpdates(): Promise<SellerUpdate[]> {
    return Array.from(this.sellerUpdates.values()).filter(u => u.isActive);
  }

  async createSellerUpdate(update: InsertSellerUpdate): Promise<SellerUpdate> {
    const id = randomUUID();
    const sellerUpdate: SellerUpdate = {
      ...update as any,
      id,
      lastSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sellerUpdates.set(id, sellerUpdate);
    return sellerUpdate;
  }

  async updateSellerUpdate(id: string, updates: Partial<SellerUpdate>): Promise<SellerUpdate | undefined> {
    const update = this.sellerUpdates.get(id);
    if (!update) return undefined;

    const updatedSellerUpdate = { ...update, ...updates, updatedAt: new Date() };
    this.sellerUpdates.set(id, updatedSellerUpdate);
    return updatedSellerUpdate;
  }

  async deleteSellerUpdate(id: string): Promise<boolean> {
    return this.sellerUpdates.delete(id);
  }

  async getDueSellerUpdates(): Promise<SellerUpdate[]> {
    const now = new Date();
    return Array.from(this.sellerUpdates.values()).filter(u => 
      u.isActive && u.nextSendAt && u.nextSendAt <= now
    );
  }

  // Send History operations (in-memory just stores in array)
  private sendHistory: Map<string, SellerUpdateSendHistory> = new Map();

  async getSendHistory(sellerUpdateId: string, limit: number = 20): Promise<SellerUpdateSendHistory[]> {
    return Array.from(this.sendHistory.values())
      .filter(h => h.sellerUpdateId === sellerUpdateId)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, limit);
  }

  async createSendHistory(history: InsertSellerUpdateSendHistory): Promise<SellerUpdateSendHistory> {
    const id = randomUUID();
    const newHistory: SellerUpdateSendHistory = {
      ...history,
      id,
      sentAt: history.sentAt || new Date(),
      propertyCount: history.propertyCount ?? null,
      errorMessage: history.errorMessage ?? null,
      sendgridMessageId: history.sendgridMessageId ?? null,
    };
    this.sendHistory.set(id, newHistory);
    return newHistory;
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

    // Correct median calculation for both odd and even length arrays
    const calculateMedian = (sorted: number[]): number => {
      const mid = sorted.length / 2;
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      return sorted[Math.floor(mid)];
    };

    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
      
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const median = calculateMedian(sorted);
      
      return { range: { min, max }, average, median };
    };

    // Use closePrice for closed listings, fallback to listPrice
    const prices = properties.map(p => Number(p.closePrice || p.listPrice)).filter(v => !isNaN(v) && v > 0);
    const livingAreas = getNumericValues('livingArea');
    const pricesPerSqFt = properties
      .map(p => {
        const price = Number(p.closePrice || p.listPrice);
        const area = Number(p.livingArea);
        return area > 0 ? price / area : 0;
      })
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
        status: p.standardStatus as 'Active' | 'Active Under Contract' | 'Closed',
        propertyId: p.id,
        address: p.unparsedAddress!,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Lead Gate Settings operations (in-memory implementation)
  private leadGateSettings: LeadGateSettings | undefined = undefined;

  async getLeadGateSettings(): Promise<LeadGateSettings | undefined> {
    return this.leadGateSettings;
  }

  async updateLeadGateSettings(settings: UpdateLeadGateSettings): Promise<LeadGateSettings> {
    if (!this.leadGateSettings) {
      this.leadGateSettings = {
        id: randomUUID(),
        enabled: settings.enabled ?? false,
        freeViewsAllowed: settings.freeViewsAllowed ?? 3,
        countPropertyDetails: settings.countPropertyDetails ?? true,
        countListViews: settings.countListViews ?? false,
        updatedAt: new Date(),
      };
    } else {
      this.leadGateSettings = {
        ...this.leadGateSettings,
        ...settings,
        updatedAt: new Date(),
      };
    }
    return this.leadGateSettings;
  }
  
  // Display Preferences operations (in-memory implementation)
  private displayPrefs: DisplayPreferences | undefined = undefined;

  async getDisplayPreferences(): Promise<DisplayPreferences | undefined> {
    return this.displayPrefs;
  }

  async updateDisplayPreferences(prefs: UpdateDisplayPreferences): Promise<DisplayPreferences> {
    if (!this.displayPrefs) {
      this.displayPrefs = {
        id: randomUUID(),
        priceFormat: prefs.priceFormat ?? 'commas',
        areaUnit: prefs.areaUnit ?? 'sqft',
        dateFormat: prefs.dateFormat ?? 'MM/DD/YYYY',
        includeAgentBranding: prefs.includeAgentBranding ?? true,
        includeMarketStats: prefs.includeMarketStats ?? true,
        updatedAt: new Date(),
      };
    } else {
      this.displayPrefs = {
        ...this.displayPrefs,
        ...prefs,
        updatedAt: new Date(),
      };
    }
    return this.displayPrefs;
  }
  
  // Autocomplete operations (in-memory implementation)
  async getAutocompleteCities(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    const cityMap = new Map<string, number>();
    const allProps = Array.from(this.properties.values());
    
    allProps.forEach(p => {
      if (p.city && p.city.trim() !== '') {
        const city = p.city.trim();
        if (search === '' || city.toLowerCase().includes(search.toLowerCase())) {
          cityMap.set(city, (cityMap.get(city) || 0) + 1);
        }
      }
    });
    
    return Array.from(cityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }
  
  async getAutocompleteZipCodes(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    const zipMap = new Map<string, number>();
    const allProps = Array.from(this.properties.values());
    
    allProps.forEach(p => {
      if (p.postalCode && p.postalCode.trim() !== '') {
        const zip = p.postalCode.trim();
        if (search === '' || zip.includes(search)) {
          zipMap.set(zip, (zipMap.get(zip) || 0) + 1);
        }
      }
    });
    
    return Array.from(zipMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }
  
  async getAutocompleteSubdivisions(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    const invalidNames = new Set(['none', 'n/a', 'na', '0', 'no', 'see legal', 'tbd', 'unknown', '-', '.']);
    const subMap = new Map<string, number>();
    const allProps = Array.from(this.properties.values());
    
    allProps.forEach(p => {
      if (p.subdivision && p.subdivision.trim() !== '') {
        const subdivision = p.subdivision.trim();
        if (invalidNames.has(subdivision.toLowerCase())) return;
        if (search === '' || subdivision.toLowerCase().includes(search.toLowerCase())) {
          subMap.set(subdivision, (subMap.get(subdivision) || 0) + 1);
        }
      }
    });
    
    return Array.from(subMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }
  
  async getAutocompleteElementarySchools(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('elementarySchool', search, limit);
  }
  
  async getAutocompleteMiddleSchools(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('middleOrJuniorSchool', search, limit);
  }
  
  async getAutocompleteHighSchools(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('highSchool', search, limit);
  }
  
  async getAutocompleteSchoolDistricts(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('schoolDistrict', search, limit);
  }
  
  private getSchoolAutocomplete(field: keyof Property, search: string, limit: number): { value: string; count: number }[] {
    const invalidNames = new Set(['none', 'n/a', 'na', '0', 'no', 'tbd', 'unknown', '-', '.', '']);
    const schoolMap = new Map<string, number>();
    const allProps = Array.from(this.properties.values());
    
    allProps.forEach(p => {
      const value = p[field] as string | null | undefined;
      if (value && value.trim() !== '') {
        const school = value.trim();
        if (invalidNames.has(school.toLowerCase())) return;
        if (search === '' || school.toLowerCase().includes(search.toLowerCase())) {
          schoolMap.set(school, (schoolMap.get(school) || 0) + 1);
        }
      }
    });
    
    return Array.from(schoolMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }

  // WordPress Favorites operations
  async getWpFavoritesByUser(wpUserId: string): Promise<WpFavorite[]> {
    return Array.from(this.wpFavoritesMap.values()).filter(f => f.wpUserId === wpUserId);
  }

  async createWpFavorite(favorite: InsertWpFavorite): Promise<WpFavorite> {
    const id = randomUUID();
    const wpFavorite: WpFavorite = {
      ...favorite,
      id,
      createdAt: new Date(),
    };
    this.wpFavoritesMap.set(id, wpFavorite);
    return wpFavorite;
  }

  async deleteWpFavorite(wpUserId: string, propertyId: string): Promise<boolean> {
    const entry = Array.from(this.wpFavoritesMap.entries()).find(
      ([_, f]) => f.wpUserId === wpUserId && f.propertyId === propertyId
    );
    if (entry) {
      return this.wpFavoritesMap.delete(entry[0]);
    }
    return false;
  }

  async getWpFavorite(wpUserId: string, propertyId: string): Promise<WpFavorite | undefined> {
    return Array.from(this.wpFavoritesMap.values()).find(
      f => f.wpUserId === wpUserId && f.propertyId === propertyId
    );
  }

  // Agent Profile operations (stub for MemStorage)
  async getAgentProfile(_userId: string): Promise<AgentProfile | undefined> {
    return undefined;
  }
  async createAgentProfile(_profile: InsertAgentProfile): Promise<AgentProfile> {
    throw new Error('MemStorage: createAgentProfile not implemented');
  }
  async updateAgentProfile(_userId: string, _profile: UpdateAgentProfile): Promise<AgentProfile | undefined> {
    return undefined;
  }

  // Company Settings operations (stub for MemStorage)
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    return undefined;
  }
  async updateCompanySettings(_settings: UpdateCompanySettings): Promise<CompanySettings> {
    throw new Error('MemStorage: updateCompanySettings not implemented');
  }

  // Custom Report Pages operations (stub for MemStorage)
  async getCustomReportPages(): Promise<CustomReportPage[]> {
    return [];
  }
  async getCustomReportPage(_id: string): Promise<CustomReportPage | undefined> {
    return undefined;
  }
  async createCustomReportPage(_page: InsertCustomReportPage): Promise<CustomReportPage> {
    throw new Error('MemStorage: createCustomReportPage not implemented');
  }
  async updateCustomReportPage(_id: string, _page: UpdateCustomReportPage): Promise<CustomReportPage | undefined> {
    return undefined;
  }
  async deleteCustomReportPage(_id: string): Promise<boolean> {
    return false;
  }

  // CMA Report Config operations (stub for MemStorage)
  async getCmaReportConfig(_cmaId: string): Promise<CmaReportConfig | undefined> {
    return undefined;
  }
  async createCmaReportConfig(_config: InsertCmaReportConfig): Promise<CmaReportConfig> {
    throw new Error('MemStorage: createCmaReportConfig not implemented');
  }
  async updateCmaReportConfig(_cmaId: string, _config: UpdateCmaReportConfig): Promise<CmaReportConfig | undefined> {
    return undefined;
  }
}

export class DbStorage implements IStorage {
  private db;

  constructor(connectionString: string) {
    const pool = new Pool({ 
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
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

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
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

  async getProperties(criteria: SearchCriteria, limit?: number, offset?: number): Promise<Property[]> {
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

    if (criteria.mainLevelBedroomsMin !== undefined) {
      conditions.push(gte(properties.mainLevelBedrooms, criteria.mainLevelBedroomsMin));
    }
    if (criteria.mainLevelBedroomsMax !== undefined) {
      conditions.push(lte(properties.mainLevelBedrooms, criteria.mainLevelBedroomsMax));
    }

    if (criteria.fullBathsMin !== undefined) {
      conditions.push(gte(properties.bathroomsFull, criteria.fullBathsMin));
    }
    if (criteria.fullBathsMax !== undefined) {
      conditions.push(lte(properties.bathroomsFull, criteria.fullBathsMax));
    }

    if (criteria.halfBathsMin !== undefined) {
      conditions.push(gte(properties.bathroomsHalf, criteria.halfBathsMin));
    }
    if (criteria.halfBathsMax !== undefined) {
      conditions.push(lte(properties.bathroomsHalf, criteria.halfBathsMax));
    }

    if (criteria.totalBathsMin !== undefined) {
      conditions.push(gte(properties.bathroomsTotalInteger, criteria.totalBathsMin));
    }
    if (criteria.totalBathsMax !== undefined) {
      conditions.push(lte(properties.bathroomsTotalInteger, criteria.totalBathsMax));
    }

    if (criteria.garageSpacesMin !== undefined) {
      conditions.push(gte(properties.garageParkingSpaces, criteria.garageSpacesMin));
    }
    if (criteria.garageSpacesMax !== undefined) {
      conditions.push(lte(properties.garageParkingSpaces, criteria.garageSpacesMax));
    }

    if (criteria.totalParkingSpacesMin !== undefined) {
      conditions.push(gte(properties.totalParkingSpaces, criteria.totalParkingSpacesMin));
    }
    if (criteria.totalParkingSpacesMax !== undefined) {
      conditions.push(lte(properties.totalParkingSpaces, criteria.totalParkingSpacesMax));
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

    if (criteria.subdivisions && criteria.subdivisions.length > 0) {
      // Use partial matching (ILIKE) for subdivision searches
      const subdivisionConditions = criteria.subdivisions.map(sub => 
        ilike(properties.subdivision, `%${sub}%`)
      );
      conditions.push(or(...subdivisionConditions)!);
    }

    // Note: neighborhood filtering not yet supported in SearchCriteria schema
    // if (criteria.neighborhood && criteria.neighborhood.length > 0) {
    //   conditions.push(inArray(properties.neighborhood, criteria.neighborhood));
    // }

    if (criteria.elementarySchools && criteria.elementarySchools.length > 0) {
      conditions.push(inArray(properties.elementarySchool, criteria.elementarySchools));
    }

    if (criteria.middleSchools && criteria.middleSchools.length > 0) {
      conditions.push(inArray(properties.middleOrJuniorSchool, criteria.middleSchools));
    }

    if (criteria.highSchools && criteria.highSchools.length > 0) {
      conditions.push(inArray(properties.highSchool, criteria.highSchools));
    }

    if (criteria.schoolDistrict && criteria.schoolDistrict.length > 0) {
      conditions.push(inArray(properties.schoolDistrict, criteria.schoolDistrict));
    }

    if (criteria.lotSizeAcres?.min !== undefined) {
      conditions.push(gte(properties.lotSizeAcres, String(criteria.lotSizeAcres.min)));
    }
    if (criteria.lotSizeAcres?.max !== undefined) {
      conditions.push(lte(properties.lotSizeAcres, String(criteria.lotSizeAcres.max)));
    }

    if (criteria.lotSizeSquareFeet?.min !== undefined) {
      conditions.push(gte(properties.lotSizeSquareFeet, String(criteria.lotSizeSquareFeet.min)));
    }
    if (criteria.lotSizeSquareFeet?.max !== undefined) {
      conditions.push(lte(properties.lotSizeSquareFeet, String(criteria.lotSizeSquareFeet.max)));
    }

    if (criteria.countyOrParish && criteria.countyOrParish.length > 0) {
      conditions.push(inArray(properties.countyOrParish, criteria.countyOrParish));
    }

    // Boolean filters
    if (criteria.flexListingYN !== undefined) {
      conditions.push(eq(properties.flexListingYN, criteria.flexListingYN));
    }

    if (criteria.poolPrivateYN !== undefined) {
      conditions.push(eq(properties.poolPrivateYN, criteria.poolPrivateYN));
    }

    if (criteria.waterfrontYN !== undefined) {
      conditions.push(eq(properties.waterfrontYN, criteria.waterfrontYN));
    }

    if (criteria.viewYN !== undefined) {
      conditions.push(eq(properties.viewYN, criteria.viewYN));
    }

    if (criteria.horseYN !== undefined) {
      conditions.push(eq(properties.horseYN, criteria.horseYN));
    }

    if (criteria.associationYN !== undefined) {
      conditions.push(eq(properties.associationYN, criteria.associationYN));
    }

    // Text/Enum filters
    if (criteria.propertySaleContingency) {
      conditions.push(eq(properties.propertySaleContingency, criteria.propertySaleContingency));
    }

    if (criteria.occupantType) {
      conditions.push(eq(properties.occupantType, criteria.occupantType));
    }

    if (criteria.possession) {
      conditions.push(eq(properties.possession, criteria.possession));
    }

    // Note: Array field filters are basic OR matching for now
    // Future enhancement: Implement And/Not logic operators from searchCriteria
    
    const effectiveLimit = limit ?? 500;
    const effectiveOffset = offset ?? 0;
    
    return await this.db
      .select()
      .from(properties)
      .where(and(...conditions))
      .limit(effectiveLimit)
      .offset(effectiveOffset);
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

  async getPropertyCount(): Promise<number> {
    const result = await this.db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.mlgCanView, true));
    return result[0]?.count || 0;
  }

  async getClosedPropertyCount(): Promise<number> {
    const result = await this.db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(properties)
      .where(and(
        eq(properties.mlgCanView, true),
        eq(properties.standardStatus, 'Closed')
      ));
    return result[0]?.count || 0;
  }

  async getClosedPropertyCountsBySubtype(): Promise<Record<string, number>> {
    // Get all closed properties with their subtypes
    const closedProperties = await this.db
      .select({ 
        propertySubType: properties.propertySubType,
        propertyType: properties.propertyType,
      })
      .from(properties)
      .where(and(
        eq(properties.mlgCanView, true),
        eq(properties.standardStatus, 'Closed')
      ));
    
    const counts: Record<string, number> = {
      'Single Family Residence': 0,
      'Condominium': 0,
      'Townhouse': 0,
      'Multi-Family': 0,
      'Land/Ranch': 0,
      'Other': 0,
    };
    
    closedProperties.forEach(p => {
      const subtype = (p.propertySubType || p.propertyType || '').toLowerCase();
      if (subtype.includes('single') || subtype.includes('detached') || subtype.includes('residential')) {
        counts['Single Family Residence']++;
      } else if (subtype.includes('condo')) {
        counts['Condominium']++;
      } else if (subtype.includes('town')) {
        counts['Townhouse']++;
      } else if (subtype.includes('multi') || subtype.includes('duplex') || subtype.includes('triplex')) {
        counts['Multi-Family']++;
      } else if (subtype.includes('land') || subtype.includes('ranch') || subtype.includes('lot') || subtype.includes('farm')) {
        counts['Land/Ranch']++;
      } else {
        counts['Other']++;
      }
    });
    
    return counts;
  }

  async getPropertiesForAudit(limit: number): Promise<Array<{ id: number; listingId: string | null; standardStatus: string | null; propertySubType: string | null }>> {
    const result = await this.db
      .select({
        id: properties.id,
        listingId: properties.listingId,
        standardStatus: properties.standardStatus,
        propertySubType: properties.propertySubType,
      })
      .from(properties)
      .where(eq(properties.mlgCanView, true))
      .limit(limit);
    
    return result.map(p => ({
      id: parseInt(p.id, 10) || 0,
      listingId: p.listingId,
      standardStatus: p.standardStatus,
      propertySubType: p.propertySubType,
    }));
  }

  async searchProperties(filters: {
    city?: string;
    postalCode?: string;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    maxBeds?: number;
    minBaths?: number;
    minSqft?: number;
    maxSqft?: number;
    subdivision?: string;
    status?: string;
    limit?: number;
    elementarySchools?: string[];
    middleSchools?: string[];
    highSchools?: string[];
    schoolDistrict?: string[];
    closeDateAfter?: string; // YYYY-MM-DD format for filtering closed properties by date
  }): Promise<Property[]> {
    const conditions = [eq(properties.mlgCanView, true)];

    if (filters.city) {
      conditions.push(ilike(properties.city, `%${filters.city}%`));
    }
    if (filters.postalCode) {
      conditions.push(eq(properties.postalCode, filters.postalCode));
    }
    if (filters.minPrice !== undefined) {
      conditions.push(gte(properties.listPrice, String(filters.minPrice)));
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(lte(properties.listPrice, String(filters.maxPrice)));
    }
    if (filters.minBeds !== undefined) {
      conditions.push(gte(properties.bedroomsTotal, filters.minBeds));
    }
    if (filters.maxBeds !== undefined) {
      conditions.push(lte(properties.bedroomsTotal, filters.maxBeds));
    }
    if (filters.minBaths !== undefined) {
      conditions.push(gte(properties.bathroomsTotalInteger, filters.minBaths));
    }
    if (filters.minSqft !== undefined) {
      conditions.push(gte(properties.livingArea, String(filters.minSqft)));
    }
    if (filters.maxSqft !== undefined) {
      conditions.push(lte(properties.livingArea, String(filters.maxSqft)));
    }
    if (filters.subdivision) {
      conditions.push(ilike(properties.subdivision, `%${filters.subdivision}%`));
    }
    if (filters.status) {
      conditions.push(eq(properties.standardStatus, filters.status));
    }
    // Close date filter for Closed/Sold properties
    if (filters.closeDateAfter) {
      // Convert string to Date object for Drizzle timestamp comparison
      conditions.push(gte(properties.closeDate, new Date(filters.closeDateAfter)));
    }
    // School filters - case-insensitive partial match using ILIKE with OR conditions
    if (filters.elementarySchools && filters.elementarySchools.length > 0) {
      const schoolConditions = filters.elementarySchools.map(s => 
        ilike(properties.elementarySchool, `%${s}%`)
      );
      conditions.push(or(...schoolConditions)!);
    }
    if (filters.middleSchools && filters.middleSchools.length > 0) {
      const schoolConditions = filters.middleSchools.map(s => 
        ilike(properties.middleOrJuniorSchool, `%${s}%`)
      );
      conditions.push(or(...schoolConditions)!);
    }
    if (filters.highSchools && filters.highSchools.length > 0) {
      const schoolConditions = filters.highSchools.map(s => 
        ilike(properties.highSchool, `%${s}%`)
      );
      conditions.push(or(...schoolConditions)!);
    }
    if (filters.schoolDistrict && filters.schoolDistrict.length > 0) {
      const districtConditions = filters.schoolDistrict.map(s => 
        ilike(properties.schoolDistrict, `%${s}%`)
      );
      conditions.push(or(...districtConditions)!);
    }

    const effectiveLimit = filters.limit ?? 100;

    return await this.db
      .select()
      .from(properties)
      .where(and(...conditions))
      .limit(effectiveLimit);
  }

  async getMedia(id: string): Promise<Media | undefined> {
    const result = await this.db.select().from(media).where(eq(media.id, id)).limit(1);
    return result[0];
  }

  async getMediaByKey(mediaKey: string): Promise<Media | undefined> {
    const result = await this.db.select().from(media).where(eq(media.mediaKey, mediaKey)).limit(1);
    return result[0];
  }

  async getMediaByResourceKey(resourceRecordKey: string): Promise<Media[]> {
    return await this.db.select().from(media).where(eq(media.resourceRecordKey, resourceRecordKey));
  }

  async getMediaForListingIds(listingIds: string[]): Promise<Record<string, Media[]>> {
    const result: Record<string, Media[]> = {};
    if (listingIds.length === 0) return result;
    
    const allMedia = await this.db
      .select()
      .from(media)
      .where(inArray(media.resourceRecordKey, listingIds));
    
    for (const m of allMedia) {
      const key = m.resourceRecordKey!;
      if (!result[key]) result[key] = [];
      result[key].push(m);
    }
    
    // Sort each array by order
    for (const key in result) {
      result[key].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    
    return result;
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const id = randomUUID();
    const result = await this.db.insert(media).values({ ...insertMedia, id }).returning();
    return result[0];
  }

  async updateMedia(id: string, updates: Partial<Media>): Promise<Media | undefined> {
    const result = await this.db.update(media).set(updates).where(eq(media.id, id)).returning();
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
    const result = await this.db.update(cmas).set({ ...updates, updatedAt: new Date() }).where(eq(cmas.id, id)).returning();
    return result[0];
  }

  async deleteCma(id: string): Promise<boolean> {
    const result = await this.db.delete(cmas).where(eq(cmas.id, id));
    return result.rowCount! > 0;
  }

  // Seller Update operations
  async getSellerUpdate(id: string): Promise<SellerUpdate | undefined> {
    const result = await this.db.select().from(sellerUpdates).where(eq(sellerUpdates.id, id)).limit(1);
    return result[0];
  }

  async getSellerUpdatesByUser(userId: string): Promise<SellerUpdate[]> {
    return await this.db.select().from(sellerUpdates).where(eq(sellerUpdates.userId, userId));
  }

  async getAllSellerUpdates(): Promise<SellerUpdate[]> {
    return await this.db.select().from(sellerUpdates);
  }

  async getActiveSellerUpdates(): Promise<SellerUpdate[]> {
    return await this.db.select().from(sellerUpdates).where(eq(sellerUpdates.isActive, true));
  }

  async createSellerUpdate(update: InsertSellerUpdate): Promise<SellerUpdate> {
    const result = await this.db.insert(sellerUpdates).values(update).returning();
    return result[0];
  }

  async updateSellerUpdate(id: string, updates: Partial<SellerUpdate>): Promise<SellerUpdate | undefined> {
    const result = await this.db.update(sellerUpdates).set({ ...updates, updatedAt: new Date() }).where(eq(sellerUpdates.id, id)).returning();
    return result[0];
  }

  async deleteSellerUpdate(id: string): Promise<boolean> {
    const result = await this.db.delete(sellerUpdates).where(eq(sellerUpdates.id, id));
    return result.rowCount! > 0;
  }

  async getDueSellerUpdates(): Promise<SellerUpdate[]> {
    const now = new Date();
    return await this.db.select().from(sellerUpdates).where(
      and(
        eq(sellerUpdates.isActive, true),
        lte(sellerUpdates.nextSendAt, now)
      )
    );
  }

  // Seller Update Send History operations
  async getSendHistory(sellerUpdateId: string, limit: number = 20): Promise<SellerUpdateSendHistory[]> {
    return await this.db.select()
      .from(sellerUpdateSendHistory)
      .where(eq(sellerUpdateSendHistory.sellerUpdateId, sellerUpdateId))
      .orderBy(drizzleSql`${sellerUpdateSendHistory.sentAt} DESC`)
      .limit(limit);
  }

  async createSendHistory(history: InsertSellerUpdateSendHistory): Promise<SellerUpdateSendHistory> {
    const result = await this.db.insert(sellerUpdateSendHistory).values(history).returning();
    return result[0];
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

    // Correct median calculation for both odd and even length arrays
    const calculateMedian = (sorted: number[]): number => {
      const mid = sorted.length / 2;
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      return sorted[Math.floor(mid)];
    };

    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
      
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const median = calculateMedian(sorted);
      
      return { range: { min, max }, average, median };
    };

    // Use closePrice for closed listings, fallback to listPrice
    const prices = props.map(p => Number(p.closePrice || p.listPrice)).filter(v => !isNaN(v) && v > 0);
    const livingAreas = getNumericValues('livingArea');
    const pricesPerSqFt = props
      .map(p => {
        const price = Number(p.closePrice || p.listPrice);
        const area = Number(p.livingArea);
        return area > 0 ? price / area : 0;
      })
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
        status: p.standardStatus as 'Active' | 'Active Under Contract' | 'Closed',
        propertyId: p.id,
        address: p.unparsedAddress!,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Lead Gate Settings operations
  async getLeadGateSettings(): Promise<LeadGateSettings | undefined> {
    const result = await this.db.select().from(leadGateSettings).limit(1);
    return result[0];
  }

  async updateLeadGateSettings(settings: UpdateLeadGateSettings): Promise<LeadGateSettings> {
    const existing = await this.getLeadGateSettings();
    
    if (!existing) {
      // Create new settings
      const result = await this.db.insert(leadGateSettings).values({
        enabled: settings.enabled ?? false,
        freeViewsAllowed: settings.freeViewsAllowed ?? 3,
        countPropertyDetails: settings.countPropertyDetails ?? true,
        countListViews: settings.countListViews ?? false,
      }).returning();
      return result[0];
    } else {
      // Update existing settings
      const result = await this.db.update(leadGateSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(leadGateSettings.id, existing.id))
        .returning();
      return result[0];
    }
  }
  
  // Display Preferences operations
  async getDisplayPreferences(): Promise<DisplayPreferences | undefined> {
    const result = await this.db.select().from(displayPreferences).limit(1);
    return result[0];
  }

  async updateDisplayPreferences(prefs: UpdateDisplayPreferences): Promise<DisplayPreferences> {
    const existing = await this.getDisplayPreferences();
    
    if (!existing) {
      // Create new preferences with defaults
      const result = await this.db.insert(displayPreferences).values({
        priceFormat: prefs.priceFormat ?? 'commas',
        areaUnit: prefs.areaUnit ?? 'sqft',
        dateFormat: prefs.dateFormat ?? 'MM/DD/YYYY',
        includeAgentBranding: prefs.includeAgentBranding ?? true,
        includeMarketStats: prefs.includeMarketStats ?? true,
      }).returning();
      return result[0];
    } else {
      // Update existing preferences
      const result = await this.db.update(displayPreferences)
        .set({ ...prefs, updatedAt: new Date() })
        .where(eq(displayPreferences.id, existing.id))
        .returning();
      return result[0];
    }
  }
  
  // Autocomplete operations (optimized database queries)
  async getAutocompleteCities(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    const result = await this.db.execute(drizzleSql`
      SELECT city as value, COUNT(*)::int as count 
      FROM properties 
      WHERE city IS NOT NULL AND city != ''
      ${search ? drizzleSql`AND LOWER(city) LIKE ${`%${search.toLowerCase()}%`}` : drizzleSql``}
      GROUP BY city 
      ORDER BY count DESC 
      LIMIT ${limit}
    `);
    return result.rows as { value: string; count: number }[];
  }
  
  async getAutocompleteZipCodes(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    const result = await this.db.execute(drizzleSql`
      SELECT postal_code as value, COUNT(*)::int as count 
      FROM properties 
      WHERE postal_code IS NOT NULL AND postal_code != ''
      ${search ? drizzleSql`AND postal_code LIKE ${`%${search}%`}` : drizzleSql``}
      GROUP BY postal_code 
      ORDER BY count DESC 
      LIMIT ${limit}
    `);
    return result.rows as { value: string; count: number }[];
  }
  
  async getAutocompleteSubdivisions(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    const invalidNames = ['none', 'n/a', 'na', '0', 'no', 'see legal', 'tbd', 'unknown', '-', '.'];
    const result = await this.db.execute(drizzleSql`
      SELECT subdivision as value, COUNT(*)::int as count 
      FROM properties 
      WHERE subdivision IS NOT NULL AND subdivision != ''
      AND LOWER(subdivision) NOT IN (${drizzleSql.join(invalidNames.map(n => drizzleSql`${n}`), drizzleSql`, `)})
      ${search ? drizzleSql`AND LOWER(subdivision) LIKE ${`%${search.toLowerCase()}%`}` : drizzleSql``}
      GROUP BY subdivision 
      ORDER BY count DESC 
      LIMIT ${limit}
    `);
    return result.rows as { value: string; count: number }[];
  }
  
  async getAutocompleteElementarySchools(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('elementary_school', search, limit);
  }
  
  async getAutocompleteMiddleSchools(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('middle_or_junior_school', search, limit);
  }
  
  async getAutocompleteHighSchools(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('high_school', search, limit);
  }
  
  async getAutocompleteSchoolDistricts(search: string, limit: number = 50): Promise<{ value: string; count: number }[]> {
    return this.getSchoolAutocomplete('school_district', search, limit);
  }
  
  private async getSchoolAutocomplete(column: string, search: string, limit: number): Promise<{ value: string; count: number }[]> {
    const invalidNames = ['none', 'n/a', 'na', '0', 'no', 'tbd', 'unknown', '-', '.'];
    const result = await this.db.execute(drizzleSql`
      SELECT ${drizzleSql.raw(column)} as value, COUNT(*)::int as count 
      FROM properties 
      WHERE ${drizzleSql.raw(column)} IS NOT NULL AND ${drizzleSql.raw(column)} != ''
      AND LOWER(${drizzleSql.raw(column)}) NOT IN (${drizzleSql.join(invalidNames.map(n => drizzleSql`${n}`), drizzleSql`, `)})
      ${search ? drizzleSql`AND LOWER(${drizzleSql.raw(column)}) LIKE ${`%${search.toLowerCase()}%`}` : drizzleSql``}
      GROUP BY ${drizzleSql.raw(column)} 
      ORDER BY count DESC 
      LIMIT ${limit}
    `);
    return result.rows as { value: string; count: number }[];
  }

  // WordPress Favorites operations
  async getWpFavoritesByUser(wpUserId: string): Promise<WpFavorite[]> {
    const result = await this.db.select().from(wpFavorites).where(eq(wpFavorites.wpUserId, wpUserId));
    return result;
  }

  async createWpFavorite(favorite: InsertWpFavorite): Promise<WpFavorite> {
    const result = await this.db.insert(wpFavorites).values(favorite).returning();
    return result[0];
  }

  async deleteWpFavorite(wpUserId: string, propertyId: string): Promise<boolean> {
    const result = await this.db.delete(wpFavorites).where(
      and(eq(wpFavorites.wpUserId, wpUserId), eq(wpFavorites.propertyId, propertyId))
    );
    return result.rowCount! > 0;
  }

  async getWpFavorite(wpUserId: string, propertyId: string): Promise<WpFavorite | undefined> {
    const result = await this.db.select().from(wpFavorites).where(
      and(eq(wpFavorites.wpUserId, wpUserId), eq(wpFavorites.propertyId, propertyId))
    ).limit(1);
    return result[0];
  }

  // Agent Profile operations
  async getAgentProfile(userId: string): Promise<AgentProfile | undefined> {
    const result = await this.db.select().from(agentProfiles).where(eq(agentProfiles.userId, userId)).limit(1);
    return result[0];
  }

  async createAgentProfile(profile: InsertAgentProfile): Promise<AgentProfile> {
    const result = await this.db.insert(agentProfiles).values(profile).returning();
    return result[0];
  }

  async updateAgentProfile(userId: string, profile: UpdateAgentProfile): Promise<AgentProfile | undefined> {
    const existing = await this.getAgentProfile(userId);
    if (!existing) {
      // Create new profile if doesn't exist
      const result = await this.db.insert(agentProfiles).values({ userId, ...profile }).returning();
      return result[0];
    }
    const result = await this.db.update(agentProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(agentProfiles.userId, userId))
      .returning();
    return result[0];
  }

  // Company Settings operations
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const result = await this.db.select().from(companySettings).limit(1);
    return result[0];
  }

  async updateCompanySettings(settings: UpdateCompanySettings): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    if (!existing) {
      // Create default settings if none exist
      const result = await this.db.insert(companySettings).values(settings).returning();
      return result[0];
    }
    const result = await this.db.update(companySettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(companySettings.id, existing.id))
      .returning();
    return result[0];
  }

  // Custom Report Pages operations
  async getCustomReportPages(): Promise<CustomReportPage[]> {
    const result = await this.db.select().from(customReportPages)
      .orderBy(customReportPages.displayOrder);
    return result;
  }

  async getCustomReportPage(id: string): Promise<CustomReportPage | undefined> {
    const result = await this.db.select().from(customReportPages)
      .where(eq(customReportPages.id, id))
      .limit(1);
    return result[0];
  }

  async createCustomReportPage(page: InsertCustomReportPage): Promise<CustomReportPage> {
    const result = await this.db.insert(customReportPages).values(page).returning();
    return result[0];
  }

  async updateCustomReportPage(id: string, page: UpdateCustomReportPage): Promise<CustomReportPage | undefined> {
    const result = await this.db.update(customReportPages)
      .set({ ...page, updatedAt: new Date() })
      .where(eq(customReportPages.id, id))
      .returning();
    return result[0];
  }

  async deleteCustomReportPage(id: string): Promise<boolean> {
    const result = await this.db.delete(customReportPages).where(eq(customReportPages.id, id));
    return result.rowCount! > 0;
  }

  // CMA Report Config operations
  async getCmaReportConfig(cmaId: string): Promise<CmaReportConfig | undefined> {
    const result = await this.db.select().from(cmaReportConfigs)
      .where(eq(cmaReportConfigs.cmaId, cmaId))
      .limit(1);
    return result[0];
  }

  async createCmaReportConfig(config: InsertCmaReportConfig): Promise<CmaReportConfig> {
    const result = await this.db.insert(cmaReportConfigs).values(config).returning();
    return result[0];
  }

  async updateCmaReportConfig(cmaId: string, config: UpdateCmaReportConfig): Promise<CmaReportConfig | undefined> {
    const existing = await this.getCmaReportConfig(cmaId);
    if (!existing) {
      // Create new config if doesn't exist
      const result = await this.db.insert(cmaReportConfigs).values({ cmaId, ...config }).returning();
      return result[0];
    }
    const result = await this.db.update(cmaReportConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(cmaReportConfigs.cmaId, cmaId))
      .returning();
    return result[0];
  }
}

export const storage = process.env.DATABASE_URL 
  ? new DbStorage(process.env.DATABASE_URL)
  : new MemStorage();
