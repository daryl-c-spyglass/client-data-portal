import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, json, serial, jsonb } from "drizzle-orm/pg-core";
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
  countyOrParish: text("county_or_parish"),
  
  // Property Details
  bedroomsTotal: integer("bedrooms_total"),
  mainLevelBedrooms: integer("main_level_bedrooms"),
  bathroomsTotalInteger: integer("bathrooms_total_integer"),
  bathroomsFull: integer("bathrooms_full"),
  bathroomsHalf: integer("bathrooms_half"),
  livingArea: decimal("living_area", { precision: 10, scale: 2 }),
  lotSizeSquareFeet: decimal("lot_size_square_feet", { precision: 14, scale: 2 }),
  lotSizeAcres: decimal("lot_size_acres", { precision: 10, scale: 4 }),
  yearBuilt: integer("year_built"),
  storiesTotal: integer("stories_total"),
  propertyCondition: text("property_condition").array(),
  
  // Parking & Garage
  garageParkingSpaces: integer("garage_parking_spaces"),
  totalParkingSpaces: integer("total_parking_spaces"),
  parkingFeatures: text("parking_features").array(),
  
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
  privateRemarks: text("private_remarks"),
  
  // MLS Info
  mlsId: text("mls_id"),
  mlsAreaMajor: text("mls_area_major"),
  listAgentMlsId: text("list_agent_mls_id"),
  listOfficeMlsId: text("list_office_mls_id"),
  
  // Listing Conditions & Contingencies
  flexListingYN: boolean("flex_listing_yn"),
  propertySaleContingency: text("property_sale_contingency"),
  specialListingConditions: text("special_listing_conditions").array(),
  showingRequirements: text("showing_requirements").array(),
  occupantType: text("occupant_type"),
  possession: text("possession"),
  buyerFinancing: text("buyer_financing").array(),
  
  // Property Features & Amenities
  associationYN: boolean("association_yn"),
  ownershipType: text("ownership_type"),
  poolPrivateYN: boolean("pool_private_yn"),
  poolFeatures: text("pool_features").array(),
  spaFeatures: text("spa_features").array(),
  waterfrontYN: boolean("waterfront_yn"),
  waterfrontFeatures: text("waterfront_features").array(),
  viewYN: boolean("view_yn"),
  view: text("view").array(),
  horseYN: boolean("horse_yn"),
  horseAmenities: text("horse_amenities").array(),
  
  // Interior Features
  interiorFeatures: text("interior_features").array(),
  flooring: text("flooring").array(),
  fireplaceFeatures: text("fireplace_features").array(),
  windowFeatures: text("window_features").array(),
  accessibilityFeatures: text("accessibility_features").array(),
  securityFeatures: text("security_features").array(),
  
  // Exterior Features
  exteriorFeatures: text("exterior_features").array(),
  foundationDetails: text("foundation_details").array(),
  lotFeatures: text("lot_features").array(),
  fencing: text("fencing").array(),
  patioAndPorchFeatures: text("patio_and_porch_features").array(),
  
  // Community & Location Features
  communityFeatures: text("community_features").array(),
  
  // Utilities & Systems
  heating: text("heating").array(),
  cooling: text("cooling").array(),
  waterSource: text("water_source").array(),
  sewer: text("sewer").array(),
  utilities: text("utilities").array(),
  
  // Green/Sustainability
  greenEnergyEfficient: text("green_energy_efficient").array(),
  greenSustainability: text("green_sustainability").array(),
  greenBuildingVerificationType: text("green_building_verification_type").array(),
  greenVerificationMetric: text("green_verification_metric"),
  greenVerificationStatus: text("green_verification_status").array(),
  greenVerificationRating: text("green_verification_rating"),
  greenVerificationYear: integer("green_verification_year"),
  
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
  passwordHash: text("password_hash"), // Optional for Google OAuth users
  role: text("role").notNull().default("agent"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  company: text("company"),
  licenseNumber: text("license_number"),
  // Google OAuth fields
  googleId: text("google_id").unique(),
  picture: text("picture"),
  lastLoginAt: timestamp("last_login_at"),
  isActive: boolean("is_active").notNull().default(true),
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

// Admin Activity Logs Schema - Tracks all admin actions for audit purposes
export const adminActivityLogs = pgTable("admin_activity_logs", {
  id: serial("id").primaryKey(),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  targetUserId: varchar("target_user_id").references(() => users.id),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdminActivityLogSchema = createInsertSchema(adminActivityLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminActivityLog = z.infer<typeof insertAdminActivityLogSchema>;
export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;

// Saved Searches Schema
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Optional - null for anonymous saves, linked to user when logged in
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
  // Location criteria
  postalCode: text("postal_code"),
  city: text("city"),
  subdivision: text("subdivision"),
  // School criteria
  elementarySchool: text("elementary_school"),
  middleSchool: text("middle_school"),
  highSchool: text("high_school"),
  // Property criteria
  propertySubType: text("property_sub_type"),
  minBeds: text("min_beds"),
  maxBeds: text("max_beds"),
  minBaths: text("min_baths"),
  maxBaths: text("max_baths"),
  minSqft: text("min_sqft"),
  maxSqft: text("max_sqft"),
  minPrice: text("min_price"),
  maxPrice: text("max_price"),
  minYearBuilt: text("min_year_built"),
  maxYearBuilt: text("max_year_built"),
  // Search settings
  soldDays: text("sold_days"), // Limit to properties sold within X days
  emailFrequency: text("email_frequency").notNull(), // 'weekly', 'bimonthly', 'quarterly'
  lastSentAt: timestamp("last_sent_at"),
  nextSendAt: timestamp("next_send_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSellerUpdateSchema = createInsertSchema(sellerUpdates).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastSentAt: true,
  nextSendAt: true,
}).extend({
  emailFrequency: z.enum(['weekly', 'bimonthly', 'quarterly']),
  email: z.string().email(),
});

export const updateSellerUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  // Location criteria
  postalCode: z.string().optional(),
  city: z.string().optional(),
  subdivision: z.string().optional(),
  // School criteria
  elementarySchool: z.string().optional(),
  middleSchool: z.string().optional(),
  highSchool: z.string().optional(),
  // Property criteria
  propertySubType: z.string().optional(),
  minBeds: z.string().optional(),
  maxBeds: z.string().optional(),
  minBaths: z.string().optional(),
  maxBaths: z.string().optional(),
  minSqft: z.string().optional(),
  maxSqft: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  minYearBuilt: z.string().optional(),
  maxYearBuilt: z.string().optional(),
  // Search settings
  soldDays: z.string().optional(),
  emailFrequency: z.enum(['weekly', 'bimonthly', 'quarterly']).optional(),
  isActive: z.boolean().optional(),
});

export type InsertSellerUpdate = z.infer<typeof insertSellerUpdateSchema>;
export type UpdateSellerUpdate = z.infer<typeof updateSellerUpdateSchema>;
export type SellerUpdate = typeof sellerUpdates.$inferSelect;

// Seller Update Send History - Track email send logs
export const sellerUpdateSendHistory = pgTable("seller_update_send_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerUpdateId: varchar("seller_update_id").notNull().references(() => sellerUpdates.id, { onDelete: 'cascade' }),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  recipientEmail: text("recipient_email").notNull(),
  status: text("status").notNull(), // 'success', 'failed', 'bounced'
  propertyCount: integer("property_count").default(0),
  errorMessage: text("error_message"),
  sendgridMessageId: text("sendgrid_message_id"),
});

export const insertSellerUpdateSendHistorySchema = createInsertSchema(sellerUpdateSendHistory).omit({ 
  id: true,
});
export type InsertSellerUpdateSendHistory = z.infer<typeof insertSellerUpdateSendHistorySchema>;
export type SellerUpdateSendHistory = typeof sellerUpdateSendHistory.$inferSelect;

// CMA Schema
// Brochure structure for CMA listing brochure
export interface CmaBrochure {
  type: "pdf" | "image";
  url: string;
  thumbnail?: string;
  filename: string;
  generated: boolean;
  uploadedAt: string;
}

// Adjustment rates for CMA property value comparisons
export interface CmaAdjustmentRates {
  sqftPerUnit: number;        // $/sqft difference (default: 50)
  bedroomValue: number;       // $/bedroom (default: 10000)
  bathroomValue: number;      // $/bathroom (default: 7500)
  poolValue: number;          // Pool yes/no (default: 25000)
  garagePerSpace: number;     // $/garage space (default: 5000)
  yearBuiltPerYear: number;   // $/year newer/older (default: 1000)
  lotSizePerSqft: number;     // $/lot sqft (default: 2)
}

// Per-comparable adjustment overrides (null = use auto-calculated)
export interface CmaCompAdjustmentOverrides {
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  pool: number | null;
  garage: number | null;
  yearBuilt: number | null;
  lotSize: number | null;
  custom: { name: string; value: number }[];
}

// Complete adjustments data structure
export interface CmaAdjustmentsData {
  rates: CmaAdjustmentRates;
  compAdjustments: Record<string, CmaCompAdjustmentOverrides>;
  enabled: boolean;
}

export const cmas = pgTable("cmas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Nullable for unauthenticated users
  name: text("name").notNull(),
  subjectPropertyId: text("subject_property_id"),
  comparablePropertyIds: json("comparable_property_ids").$type<string[]>().notNull(),
  propertiesData: json("properties_data").$type<any[]>(), // Store actual property data from HomeReview
  searchCriteria: json("search_criteria"),
  notes: text("notes"),
  publicLink: text("public_link").unique(),
  brochure: json("brochure").$type<CmaBrochure>(), // Listing brochure for CMA presentation
  adjustments: json("adjustments").$type<CmaAdjustmentsData>(), // Property value adjustments for CMA comparisons
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

// Display Preferences Schema - User preferences for formatting data display
export const displayPreferences = pgTable("display_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  priceFormat: text("price_format").notNull().default("commas"), // 'commas' ($1,234,567), 'abbreviated' ($1.23M), 'suffix' (1,234,567 USD)
  areaUnit: text("area_unit").notNull().default("sqft"), // 'sqft', 'sqm', 'acres'
  dateFormat: text("date_format").notNull().default("MM/DD/YYYY"), // 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'
  includeAgentBranding: boolean("include_agent_branding").notNull().default(true),
  includeMarketStats: boolean("include_market_stats").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDisplayPreferencesSchema = createInsertSchema(displayPreferences).omit({ 
  id: true, 
  updatedAt: true 
});
export const updateDisplayPreferencesSchema = z.object({
  priceFormat: z.enum(['commas', 'abbreviated', 'suffix']).optional(),
  areaUnit: z.enum(['sqft', 'sqm', 'acres']).optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  includeAgentBranding: z.boolean().optional(),
  includeMarketStats: z.boolean().optional(),
});
export type InsertDisplayPreferences = z.infer<typeof insertDisplayPreferencesSchema>;
export type UpdateDisplayPreferences = z.infer<typeof updateDisplayPreferencesSchema>;
export type DisplayPreferences = typeof displayPreferences.$inferSelect;

// Lead Gate Settings Schema - Configure registration wall for property viewing
export const leadGateSettings = pgTable("lead_gate_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").notNull().default(false),
  freeViewsAllowed: integer("free_views_allowed").notNull().default(3), // Number of listings before requiring registration
  countPropertyDetails: boolean("count_property_details").notNull().default(true), // Count detail page views
  countListViews: boolean("count_list_views").notNull().default(false), // Count search result impressions
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadGateSettingsSchema = createInsertSchema(leadGateSettings).omit({ 
  id: true, 
  updatedAt: true 
});
export const updateLeadGateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  freeViewsAllowed: z.number().int().min(0).max(100).optional(),
  countPropertyDetails: z.boolean().optional(),
  countListViews: z.boolean().optional(),
});
export type InsertLeadGateSettings = z.infer<typeof insertLeadGateSettingsSchema>;
export type UpdateLeadGateSettings = z.infer<typeof updateLeadGateSettingsSchema>;
export type LeadGateSettings = typeof leadGateSettings.$inferSelect;

// WordPress Favorites Schema - Favorited properties from WordPress integration
export const wpFavorites = pgTable("wp_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wpUserId: text("wp_user_id").notNull(), // WordPress user ID (external)
  propertyId: text("property_id").notNull(), // MLS listing ID
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWpFavoriteSchema = createInsertSchema(wpFavorites).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertWpFavorite = z.infer<typeof insertWpFavoriteSchema>;
export type WpFavorite = typeof wpFavorites.$inferSelect;

// Neighborhood Boundaries Cache - Store fetched boundaries from Repliers API
// This is SEPARATE from the subdivision field used for CMA comps
export const neighborhoodBoundaries = pgTable("neighborhood_boundaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Neighborhood name from Repliers
  city: text("city"), // City for scoping lookups
  area: text("area"), // Area/region
  boundary: json("boundary").$type<number[][][]>(), // GeoJSON polygon coordinates [[lng, lat], ...]
  centerLatitude: decimal("center_latitude", { precision: 10, scale: 7 }),
  centerLongitude: decimal("center_longitude", { precision: 10, scale: 7 }),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional TTL for cache invalidation
});

export const insertNeighborhoodBoundarySchema = createInsertSchema(neighborhoodBoundaries).omit({ 
  id: true, 
  fetchedAt: true 
});
export type InsertNeighborhoodBoundary = z.infer<typeof insertNeighborhoodBoundarySchema>;
export type NeighborhoodBoundary = typeof neighborhoodBoundaries.$inferSelect;

// Search Criteria Types (for validation) - All fields optional for flexible querying
// Handle both single string and array for multi-select filters from query params
const stringOrArray = z.union([z.string(), z.array(z.string())]).transform((val) => 
  typeof val === 'string' ? val.split(',').map(s => s.trim()) : val
);

export const searchCriteriaSchema = z.object({
  status: stringOrArray.pipe(z.array(z.enum(['Active', 'Active Under Contract', 'Closed', 'Pending']))).optional(),
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
  mlsAreas: stringOrArray.optional(),
  listPriceMin: z.coerce.number().optional(),
  listPriceMax: z.coerce.number().optional(),
  streetList: z.coerce.boolean().optional(),
  mlsNumbers: stringOrArray.optional(),
  subdivisions: stringOrArray.optional(),
  cities: stringOrArray.optional(),
  streetNumber: z.coerce.number().optional(),
  streetName: z.string().optional(),
  unitNumber: z.string().optional(),
  zipCodes: stringOrArray.optional(),
  elementarySchools: stringOrArray.optional(),
  middleSchools: stringOrArray.optional(),
  highSchools: stringOrArray.optional(),
  schoolDistrict: stringOrArray.optional(),
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
  garageSpacesMin: z.coerce.number().optional(),
  garageSpacesMax: z.coerce.number().optional(),
  totalParkingSpacesMin: z.coerce.number().optional(),
  totalParkingSpacesMax: z.coerce.number().optional(),
  
  // Location filters
  countyOrParish: stringOrArray.optional(),
  
  // Property features with logical operators (And/Or/Not)
  propertyCondition: stringOrArray.optional(),
  propertyConditionLogic: z.enum(['And', 'Or', 'Not']).optional(),
  levels: stringOrArray.optional(),
  flexListingYN: z.coerce.boolean().optional(),
  propertySaleContingency: z.string().optional(),
  ownershipType: stringOrArray.optional(),
  ownershipTypeLogic: z.enum(['And', 'Or', 'Not']).optional(),
  
  // Amenities
  poolPrivateYN: z.coerce.boolean().optional(),
  poolFeatures: stringOrArray.optional(),
  poolFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  waterfrontYN: z.coerce.boolean().optional(),
  waterfrontFeatures: stringOrArray.optional(),
  waterfrontFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  viewYN: z.coerce.boolean().optional(),
  view: stringOrArray.optional(),
  viewLogic: z.enum(['And', 'Or', 'Not']).optional(),
  horseYN: z.coerce.boolean().optional(),
  horseAmenities: stringOrArray.optional(),
  horseAmenitiesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  associationYN: z.coerce.boolean().optional(),
  
  // Interior features
  interiorFeatures: stringOrArray.optional(),
  interiorFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  flooring: stringOrArray.optional(),
  flooringLogic: z.enum(['And', 'Or', 'Not']).optional(),
  fireplaceFeatures: stringOrArray.optional(),
  fireplaceLogic: z.enum(['And', 'Or', 'Not']).optional(),
  windowFeatures: stringOrArray.optional(),
  windowFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  accessibilityFeatures: stringOrArray.optional(),
  accessibilityFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  securityFeatures: stringOrArray.optional(),
  securityFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  
  // Exterior features
  exteriorFeatures: stringOrArray.optional(),
  exteriorFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  foundationDetails: stringOrArray.optional(),
  foundationLogic: z.enum(['And', 'Or', 'Not']).optional(),
  lotFeatures: stringOrArray.optional(),
  lotFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  fencing: stringOrArray.optional(),
  fencingLogic: z.enum(['And', 'Or', 'Not']).optional(),
  patioAndPorchFeatures: stringOrArray.optional(),
  patioAndPorchFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  spaFeatures: stringOrArray.optional(),
  spaFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  
  // Community & location
  communityFeatures: stringOrArray.optional(),
  communityFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  
  // Utilities
  heating: stringOrArray.optional(),
  heatingLogic: z.enum(['And', 'Or', 'Not']).optional(),
  cooling: stringOrArray.optional(),
  coolingLogic: z.enum(['And', 'Or', 'Not']).optional(),
  waterSource: stringOrArray.optional(),
  waterSourceLogic: z.enum(['And', 'Or', 'Not']).optional(),
  sewer: stringOrArray.optional(),
  sewerLogic: z.enum(['And', 'Or', 'Not']).optional(),
  utilities: stringOrArray.optional(),
  utilitiesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  
  // Green/Sustainability
  greenEnergyEfficient: stringOrArray.optional(),
  greenEnergyEfficientLogic: z.enum(['And', 'Or', 'Not']).optional(),
  greenSustainability: stringOrArray.optional(),
  greenSustainabilityLogic: z.enum(['And', 'Or', 'Not']).optional(),
  greenBuildingVerificationType: stringOrArray.optional(),
  greenVerificationStatus: stringOrArray.optional(),
  greenVerificationRating: z.string().optional(),
  greenVerificationYear: z.coerce.number().optional(),
  
  // Listing conditions
  specialListingConditions: stringOrArray.optional(),
  showingRequirements: stringOrArray.optional(),
  showingRequirementsLogic: z.enum(['And', 'Or', 'Not']).optional(),
  occupantType: z.string().optional(),
  possession: z.string().optional(),
  buyerFinancing: stringOrArray.optional(),
  buyerFinancingLogic: z.enum(['And', 'Or', 'Not']).optional(),
  
  // Parking
  parkingFeatures: stringOrArray.optional(),
  parkingFeaturesLogic: z.enum(['And', 'Or', 'Not']).optional(),
  
  // Remarks
  publicRemarks: z.string().optional(),
  privateRemarks: z.string().optional(),
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
  status: 'Active' | 'Active Under Contract' | 'Closed';
  propertyId: string;
  address: string;
  daysOnMarket?: number | null;
  daysActive?: number | null;
  daysUnderContract?: number | null;
  cumulativeDaysOnMarket?: number | null;
}

// ============================================================================
// RENTAL DETECTION LOGIC (shared between server and client)
// ============================================================================
// These thresholds help identify rental listings that are incorrectly marked 
// as "Closed" sales. In the MLS, closePrice for rentals represents monthly rent,
// not sale price.
// ============================================================================

/**
 * Minimum expected sale price for a residential property.
 * Properties with closePrice below this are likely rental listings.
 * Note: This may incorrectly filter some edge cases like manufactured homes,
 * rural land, or distressed properties. Those cases are rare in typical CMA usage.
 */
export const MIN_SALE_PRICE_THRESHOLD = 20000;

/**
 * Minimum price per square foot to be considered a legitimate sale.
 * Rental listings typically have $/sqft in the $1-5 range (monthly rent / sqft).
 * Legitimate sales are typically $50-500+/sqft depending on the market.
 */
export const MIN_PRICE_PER_SQFT_THRESHOLD = 10;

/**
 * Property types that are typically NOT subject to rental detection.
 * These types often have legitimate low sale prices.
 */
export const EXCLUDED_PROPERTY_TYPES = [
  'Unimproved Land',
  'Land',
  'Lot',
  'Ranch', // Often large acreage with low $/sqft
];

/**
 * Detect if a property is likely a rental listing (not a for-sale listing).
 * Returns true if the property appears to be a rental, false if it's a legitimate sale.
 * 
 * This works for ALL statuses:
 * - Closed/Sold: checks closePrice
 * - Active/Under Contract: checks listPrice
 * 
 * @param property - Property object with closePrice, listPrice, livingArea, standardStatus, propertySubType
 * @returns true if likely a rental, false if likely a legitimate sale
 */
export function isLikelyRentalProperty(property: {
  closePrice?: number | string | null;
  listPrice?: number | string | null;
  livingArea?: number | string | null;
  standardStatus?: string | null;
  status?: string | null;
  propertySubType?: string | null;
  propertyType?: string | null;
}): boolean {
  const closePrice = Number(property.closePrice || 0);
  const listPrice = Number(property.listPrice || 0);
  const livingArea = Number(property.livingArea || 0);
  const status = (property.standardStatus || property.status || '').toLowerCase();
  const propType = property.propertySubType || property.propertyType || '';
  
  // Skip detection for property types that commonly have low sale prices
  if (EXCLUDED_PROPERTY_TYPES.some(t => propType.toLowerCase().includes(t.toLowerCase()))) {
    return false;
  }
  
  // Determine which price to check based on status
  // For Closed/Sold properties, use closePrice
  // For Active/Under Contract properties, use listPrice
  let priceToCheck = 0;
  if (status === 'closed' || status === 'sold') {
    priceToCheck = closePrice;
  } else if (status === 'active' || status === 'under contract' || status === 'pending') {
    priceToCheck = listPrice;
  } else {
    // For unknown statuses, check both prices
    priceToCheck = closePrice > 0 ? closePrice : listPrice;
  }
  
  // If price is zero or not set, can't determine if rental
  if (priceToCheck <= 0) {
    return false;
  }
  
  // If price is very low (< threshold), it's likely monthly rent
  if (priceToCheck < MIN_SALE_PRICE_THRESHOLD) {
    return true;
  }
  
  // If we have both price and livingArea, check price per sqft
  // Rental listings have extremely low $/sqft (typically $1-5/sqft for monthly rent)
  // Real sales are typically $50-500+/sqft depending on market
  if (livingArea > 0) {
    const pricePerSqft = priceToCheck / livingArea;
    if (pricePerSqft < MIN_PRICE_PER_SQFT_THRESHOLD) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter out rental properties from an array of properties.
 * Use this when preparing property data for CMA analysis.
 * 
 * @param properties - Array of property objects
 * @returns Filtered array with rental properties removed
 */
export function filterOutRentalProperties<T extends {
  closePrice?: number | string | null;
  listPrice?: number | string | null;
  livingArea?: number | string | null;
  standardStatus?: string | null;
  status?: string | null;
  propertySubType?: string | null;
  propertyType?: string | null;
}>(properties: T[]): T[] {
  return properties.filter(p => !isLikelyRentalProperty(p));
}

// ==========================================
// CMA PRESENTATION BUILDER SCHEMA
// ==========================================

// Agent Profiles - Extended profile info for CMA reports
export const agentProfiles = pgTable("agent_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  title: text("title"), // e.g., "Broker/Owner", "Realtor"
  headshotUrl: text("headshot_url"),
  bio: text("bio"),
  defaultCoverLetter: text("default_cover_letter"),
  // Social links
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  twitterUrl: text("twitter_url"),
  websiteUrl: text("website_url"),
  // External integrations
  zillowProfileUrl: text("zillow_profile_url"),
  realSatisfiedId: text("real_satisfied_id"),
  ratedAgentId: text("rated_agent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateAgentProfileSchema = z.object({
  title: z.string().optional(),
  headshotUrl: z.string().refine(
    (val) => !val || val === '' || val.startsWith('/objects/') || val.startsWith('http://') || val.startsWith('https://'),
    { message: 'Must be a valid URL or object storage path' }
  ).optional().or(z.literal('')),
  bio: z.string().optional(),
  defaultCoverLetter: z.string().optional(),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  zillowProfileUrl: z.string().url().optional().or(z.literal('')),
  realSatisfiedId: z.string().optional(),
  ratedAgentId: z.string().optional(),
});
export type InsertAgentProfile = z.infer<typeof insertAgentProfileSchema>;
export type UpdateAgentProfile = z.infer<typeof updateAgentProfileSchema>;
export type AgentProfile = typeof agentProfiles.$inferSelect;

// Company Settings - Global company branding for reports
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").default("Spyglass Realty"),
  logoUrl: text("logo_url"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  description: text("description"),
  whatIsCmaContent: text("what_is_cma_content"),
  ourCompanyContent: text("our_company_content"),
  primaryColor: varchar("primary_color", { length: 7 }).default("#F97316"),
  secondaryColor: varchar("secondary_color", { length: 7 }).default("#1E3A5F"),
  accentColor: varchar("accent_color", { length: 7 }).default("#FFFFFF"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateCompanySettingsSchema = z.object({
  companyName: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  whatIsCmaContent: z.string().optional(),
  ourCompanyContent: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type UpdateCompanySettings = z.infer<typeof updateCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

// Custom Report Pages - Admin-uploaded pages for CMA reports
export const customReportPages = pgTable("custom_report_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content"), // HTML/Markdown content
  pdfUrl: text("pdf_url"), // URL to uploaded PDF
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomReportPageSchema = createInsertSchema(customReportPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateCustomReportPageSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  pdfUrl: z.string().url().optional().or(z.literal('')),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type InsertCustomReportPage = z.infer<typeof insertCustomReportPageSchema>;
export type UpdateCustomReportPage = z.infer<typeof updateCustomReportPageSchema>;
export type CustomReportPage = typeof customReportPages.$inferSelect;

// CMA Report Sections - Available sections for the presentation builder
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

// Cover Page Config type for CMA presentations
export interface CoverPageConfig {
  title: string;
  subtitle: string;
  showDate: boolean;
  showAgentPhoto: boolean;
  background: "none" | "gradient" | "property";
}

// CMA Report Configs - Per-CMA presentation configuration
export const cmaReportConfigs = pgTable("cma_report_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cmaId: varchar("cma_id").notNull().references(() => cmas.id, { onDelete: 'cascade' }).unique(),
  includedSections: json("included_sections").$type<string[]>(), // Array of section IDs
  sectionOrder: json("section_order").$type<string[]>(), // Ordered array for custom ordering
  coverLetterOverride: text("cover_letter_override"),
  layout: text("layout").default("two_photos"), // 'two_photos', 'single_photo', 'no_photos'
  template: text("template").default("default"),
  theme: text("theme").default("spyglass"), // Theme name
  photoLayout: text("photo_layout").default("first_dozen"), // 'first_dozen', 'all', 'ai_suggested', 'custom'
  mapStyle: text("map_style").default("streets"), // 'streets', 'satellite', 'dark'
  showMapPolygon: boolean("show_map_polygon").default(true),
  includeAgentFooter: boolean("include_agent_footer").default(true),
  coverPageConfig: json("cover_page_config").$type<CoverPageConfig>(), // Cover page customization
  customPhotoSelections: json("custom_photo_selections").$type<Record<string, string[]>>(), // MLS number -> selected photo URLs
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// CMA Report Templates - Reusable presentation configurations
export const cmaReportTemplates = pgTable("cma_report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  includedSections: json("included_sections").$type<string[]>(),
  sectionOrder: json("section_order").$type<string[]>(),
  coverLetterOverride: text("cover_letter_override"),
  layout: text("layout").default("two_photos"),
  theme: text("theme").default("spyglass"),
  photoLayout: text("photo_layout").default("first_dozen"),
  mapStyle: text("map_style").default("streets"),
  showMapPolygon: boolean("show_map_polygon").default(true),
  includeAgentFooter: boolean("include_agent_footer").default(true),
  coverPageConfig: json("cover_page_config").$type<CoverPageConfig>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCmaReportConfigSchema = createInsertSchema(cmaReportConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const coverPageConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  showDate: z.boolean(),
  showAgentPhoto: z.boolean(),
  background: z.enum(['none', 'gradient', 'property']),
});

export const updateCmaReportConfigSchema = z.object({
  includedSections: z.array(z.string()).optional(),
  sectionOrder: z.array(z.string()).optional(),
  coverLetterOverride: z.string().optional(),
  layout: z.enum(['two_photos', 'single_photo', 'no_photos']).optional(),
  template: z.string().optional(),
  theme: z.string().optional(),
  photoLayout: z.enum(['first_dozen', 'all', 'ai_suggested', 'custom']).optional(),
  mapStyle: z.enum(['streets', 'satellite', 'dark']).optional(),
  showMapPolygon: z.boolean().optional(),
  includeAgentFooter: z.boolean().optional(),
  coverPageConfig: coverPageConfigSchema.optional(),
  customPhotoSelections: z.record(z.string(), z.array(z.string())).optional(),
});
export type InsertCmaReportConfig = z.infer<typeof insertCmaReportConfigSchema>;
export type UpdateCmaReportConfig = z.infer<typeof updateCmaReportConfigSchema>;
export type CmaReportConfig = typeof cmaReportConfigs.$inferSelect;

// Template schemas
export const insertCmaReportTemplateSchema = createInsertSchema(cmaReportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCmaReportTemplate = z.infer<typeof insertCmaReportTemplateSchema>;
export type CmaReportTemplate = typeof cmaReportTemplates.$inferSelect;
