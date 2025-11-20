import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Property Schema - Based on MLS Grid RESO Data Dictionary
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey(),
  listingId: text("listing_id").notNull().unique(),
  mlgCanView: boolean("mlg_can_view").notNull().default(true),
  modificationTimestamp: timestamp("modification_timestamp").notNull(),
  originatingSystemModificationTimestamp: timestamp("originating_system_modification_timestamp"),
  
  // Basic Info
  listPrice: decimal("list_price", { precision: 14, scale: 2 }),
  closePrice: decimal("close_price", { precision: 14, scale: 2 }),
  standardStatus: text("standard_status"),
  propertyType: text("property_type"),
  propertySubType: text("property_sub_type"),
  
  // Address
  unparsedAddress: text("unparsed_address"),
  streetNumber: text("street_number"),
  streetName: text("street_name"),
  unitNumber: text("unit_number"),
  city: text("city"),
  stateOrProvince: text("state_or_province"),
  postalCode: text("postal_code"),
  
  // Location
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  subdivision: text("subdivision"),
  neighborhood: text("neighborhood"),
  
  // Property Details
  bedroomsTotal: integer("bedrooms_total"),
  bathroomsTotalInteger: integer("bathrooms_total_integer"),
  bathroomsFull: integer("bathrooms_full"),
  bathroomsHalf: integer("bathrooms_half"),
  livingArea: decimal("living_area", { precision: 10, scale: 2 }),
  lotSizeSquareFeet: decimal("lot_size_square_feet", { precision: 14, scale: 2 }),
  lotSizeAcres: decimal("lot_size_acres", { precision: 10, scale: 4 }),
  yearBuilt: integer("year_built"),
  
  // Listing Details
  daysOnMarket: integer("days_on_market"),
  listingContractDate: timestamp("listing_contract_date"),
  closeDate: timestamp("close_date"),
  priceChangeTimestamp: timestamp("price_change_timestamp"),
  
  // Schools
  elementarySchool: text("elementary_school"),
  middleOrJuniorSchool: text("middle_or_junior_school"),
  highSchool: text("high_school"),
  schoolDistrict: text("school_district"),
  
  // Descriptions
  publicRemarks: text("public_remarks"),
  
  // MLS Info
  mlsId: text("mls_id"),
  mlsAreaMajor: text("mls_area_major"),
  listAgentMlsId: text("list_agent_mls_id"),
  listOfficeMlsId: text("list_office_mls_id"),
  
  // Additional data as JSON for flexibility
  additionalData: json("additional_data"),
});

export const insertPropertySchema = createInsertSchema(properties);
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Media Schema - MLS Grid Media Resources
export const media = pgTable("media", {
  id: varchar("id").primaryKey(),
  mediaKey: text("media_key").notNull().unique(),
  resourceRecordKey: text("resource_record_key").notNull(),
  mediaURL: text("media_url").notNull(),
  mediaCategory: text("media_category"),
  mediaType: text("media_type"),
  order: integer("order"),
  caption: text("caption"),
  modificationTimestamp: timestamp("modification_timestamp").notNull(),
  localPath: text("local_path"),
});

export const insertMediaSchema = createInsertSchema(media).omit({ id: true });
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof media.$inferSelect;

// Users Schema
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("client"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  company: text("company"),
  licenseNumber: text("license_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Saved Searches Schema
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  criteria: json("criteria").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;

// Seller Updates Schema - Quick Seller Update feature for automated market updates
export const sellerUpdates = pgTable("seller_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(), // Property address for identification
  email: text("email").notNull(), // Email to send updates to
  postalCode: text("postal_code").notNull(),
  elementarySchool: text("elementary_school"),
  propertySubType: text("property_sub_type"),
  emailFrequency: text("email_frequency").notNull(), // 'daily', 'weekly', 'bi-weekly', 'monthly'
  lastSentAt: timestamp("last_sent_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSellerUpdateSchema = createInsertSchema(sellerUpdates).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastSentAt: true,
}).extend({
  emailFrequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly']),
  email: z.string().email(),
});

export const updateSellerUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  postalCode: z.string().optional(),
  elementarySchool: z.string().optional(),
  propertySubType: z.string().optional(),
  emailFrequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly']).optional(),
  isActive: z.boolean().optional(),
});

export type InsertSellerUpdate = z.infer<typeof insertSellerUpdateSchema>;
export type UpdateSellerUpdate = z.infer<typeof updateSellerUpdateSchema>;
export type SellerUpdate = typeof sellerUpdates.$inferSelect;

// CMA Schema
export const cmas = pgTable("cmas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  subjectPropertyId: text("subject_property_id"),
  comparablePropertyIds: json("comparable_property_ids").$type<string[]>().notNull(),
  searchCriteria: json("search_criteria"),
  notes: text("notes"),
  publicLink: text("public_link").unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCmaSchema = createInsertSchema(cmas).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCma = z.infer<typeof insertCmaSchema>;
export type Cma = typeof cmas.$inferSelect;

// Sync Metadata Schema - Track MLS Grid sync state
export const syncMetadata = pgTable("sync_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncType: text("sync_type").notNull().unique(), // 'properties' or 'media'
  lastSyncTimestamp: timestamp("last_sync_timestamp"),
  lastSyncStatus: text("last_sync_status"), // 'success', 'error', 'in_progress'
  lastSyncMessage: text("last_sync_message"),
  propertiesSynced: integer("properties_synced").default(0),
  mediaSynced: integer("media_synced").default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSyncMetadataSchema = createInsertSchema(syncMetadata).omit({ 
  id: true, 
  updatedAt: true 
});
export type InsertSyncMetadata = z.infer<typeof insertSyncMetadataSchema>;
export type SyncMetadata = typeof syncMetadata.$inferSelect;

// Search Criteria Types (for validation) - All fields optional for flexible querying
// Handle both single string and array for multi-select filters from query params
const stringOrArray = z.union([z.string(), z.array(z.string())]).transform((val) => 
  typeof val === 'string' ? val.split(',').map(s => s.trim()) : val
);

export const searchCriteriaSchema = z.object({
  status: stringOrArray.pipe(z.array(z.enum(['Active', 'Under Contract', 'Closed', 'Pending']))).optional(),
  dateRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  propertySubType: z.string().optional(),
  contingency: z.enum(['NA', 'Yes', 'No']).optional(),
  priceDrop: z.enum(['NA', 'Yes', 'No']).optional(),
  priceDropDateRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  mlsAreas: z.array(z.string()).optional(),
  listPriceMin: z.coerce.number().optional(),
  listPriceMax: z.coerce.number().optional(),
  streetList: z.coerce.boolean().optional(),
  mlsNumbers: z.array(z.string()).optional(),
  neighborhood: z.array(z.string()).optional(),
  subdivisions: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  streetNumber: z.object({
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  }).optional(),
  streetName: z.string().optional(),
  unitNumber: z.string().optional(),
  zipCodes: z.array(z.string()).optional(),
  elementarySchools: z.array(z.string()).optional(),
  middleSchools: z.array(z.string()).optional(),
  highSchools: z.array(z.string()).optional(),
  schoolDistrict: z.array(z.string()).optional(),
  // Nested range filters - handle both object and flattened dot-notation formats
  yearBuilt: z.object({
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  }).optional(),
  'yearBuilt.min': z.coerce.number().optional(),
  'yearBuilt.max': z.coerce.number().optional(),
  livingArea: z.object({
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  }).optional(),
  'livingArea.min': z.coerce.number().optional(),
  'livingArea.max': z.coerce.number().optional(),
  lotSizeSquareFeet: z.object({
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  }).optional(),
  'lotSizeSquareFeet.min': z.coerce.number().optional(),
  'lotSizeSquareFeet.max': z.coerce.number().optional(),
  lotSizeAcres: z.object({
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  }).optional(),
  'lotSizeAcres.min': z.coerce.number().optional(),
  'lotSizeAcres.max': z.coerce.number().optional(),
  bedroomsMin: z.coerce.number().optional(),
  bedroomsMax: z.coerce.number().optional(),
  mainLevelBedroomsMin: z.coerce.number().optional(),
  mainLevelBedroomsMax: z.coerce.number().optional(),
  fullBathsMin: z.coerce.number().optional(),
  fullBathsMax: z.coerce.number().optional(),
  halfBathsMin: z.coerce.number().optional(),
  halfBathsMax: z.coerce.number().optional(),
  totalBathsMin: z.coerce.number().optional(),
  totalBathsMax: z.coerce.number().optional(),
  publicRemarks: z.string().optional(),
}).partial();

export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;

// CMA Statistics Types
export interface PropertyStatistics {
  price: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  pricePerSqFt: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  daysOnMarket: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  livingArea: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  lotSize: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  acres: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  bedrooms: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  bathrooms: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
  yearBuilt: {
    range: { min: number; max: number };
    average: number;
    median: number;
  };
}

export interface TimelineDataPoint {
  date: Date;
  price: number;
  status: 'Active' | 'Under Contract' | 'Closed';
  propertyId: string;
  address: string;
}
