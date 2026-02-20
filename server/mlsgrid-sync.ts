import { MLSGridClient } from './mlsgrid-client';
import { storage } from './storage';
import type { InsertProperty, InsertMedia, SyncMetadata } from '@shared/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from "pg";
const { Pool: PgPool } = pg;
import { eq } from "drizzle-orm";
import { syncMetadata } from '@shared/schema';

const pool = process.env.DATABASE_URL ? new PgPool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const db = pool ? drizzle(pool) : null;

export class MLSGridSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private useScheduledSync: boolean = false;
  private scheduledHour: number = 0; // 12 AM
  private scheduledMinute: number = 0;
  private timezone: string = 'America/Chicago'; // CST/CDT

  constructor(
    private mlsGridClient: MLSGridClient,
    private intervalMinutes: number = 60
  ) {}

  /**
   * Calculate milliseconds until next scheduled sync time (12 AM CST)
   */
  private getMillisecondsUntilNextSync(): number {
    const now = new Date();
    
    // Get current time in CST
    const cstFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    
    const cstParts = cstFormatter.formatToParts(now);
    const currentHour = parseInt(cstParts.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(cstParts.find(p => p.type === 'minute')?.value || '0');
    
    // Convert current time to total minutes since midnight
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const targetTotalMinutes = this.scheduledHour * 60 + this.scheduledMinute;
    
    // Calculate minutes until target time
    let minutesUntilSync = targetTotalMinutes - currentTotalMinutes;
    
    if (minutesUntilSync <= 0) {
      // Target time already passed today, schedule for tomorrow
      minutesUntilSync += 24 * 60; // Add 24 hours in minutes
    }
    
    const hoursUntil = Math.floor(minutesUntilSync / 60);
    const minsUntil = minutesUntilSync % 60;
    const milliseconds = minutesUntilSync * 60 * 1000;
    
    console.log(`⏰ Next MLS Grid sync scheduled in ${hoursUntil}h ${minsUntil}m (12:00 AM CST)`);
    
    return milliseconds;
  }

  /**
   * Start scheduled sync at 12 AM CST daily
   */
  startScheduled() {
    if (this.scheduledTimeout) {
      console.log('⚠️ MLS Grid scheduled sync already running');
      return;
    }

    this.useScheduledSync = true;
    console.log('🕛 Starting MLS Grid scheduled sync (daily at 12:00 AM CST)');
    
    this.scheduleNextSync();
  }

  /**
   * Schedule the next sync
   */
  private scheduleNextSync() {
    const msUntilSync = this.getMillisecondsUntilNextSync();
    
    this.scheduledTimeout = setTimeout(async () => {
      try {
        console.log('🔄 Running scheduled MLS Grid sync (12:00 AM CST)...');
        await this.syncAll();
      } catch (error) {
        console.error('❌ Scheduled MLS Grid sync failed:', error);
      }
      
      // Schedule next day's sync
      if (this.useScheduledSync) {
        this.scheduleNextSync();
      }
    }, msUntilSync);
  }

  /**
   * Start automatic background sync (interval-based)
   */
  start() {
    if (this.syncInterval) {
      console.log('⚠️ MLS Grid sync already running');
      return;
    }

    console.log(`🔄 Starting MLS Grid auto-sync (every ${this.intervalMinutes} minutes)`);
    
    // Run initial sync
    this.syncAll().catch(error => {
      console.error('❌ Initial MLS Grid sync failed:', error);
    });

    // Schedule periodic syncs
    this.syncInterval = setInterval(() => {
      this.syncAll().catch(error => {
        console.error('❌ Scheduled MLS Grid sync failed:', error);
      });
    }, this.intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automatic background sync
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 MLS Grid interval sync stopped');
    }
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
      this.useScheduledSync = false;
      console.log('🛑 MLS Grid scheduled sync stopped');
    }
  }

  /**
   * Sync all data (properties and media)
   */
  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      console.log('⏩ Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting MLS Grid sync...');

    try {
      // Sync properties (critical)
      await this.syncProperties();
      
      // Sync media (optional - log errors but don't fail)
      try {
        await this.syncMedia();
      } catch (mediaError) {
        console.warn('⚠️  Media sync failed (non-critical):', mediaError instanceof Error ? mediaError.message : mediaError);
      }
      
      console.log('✅ MLS Grid sync completed successfully');
    } catch (error) {
      console.error('❌ MLS Grid sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync properties from MLS Grid
   */
  async syncProperties(): Promise<void> {
    try {
      // Get last sync metadata
      const metadata = await this.getSyncMetadata('properties');
      const lastSyncTime = metadata?.lastSyncTimestamp;

      // Update status to in_progress
      await this.updateSyncMetadata('properties', {
        lastSyncStatus: 'in_progress',
        lastSyncMessage: 'Fetching properties from MLS Grid...',
      });

      let totalSynced = 0;
      let hasMore = true;
      let skip = 0;
      const limit = 100;

      console.log(`📥 Syncing properties (last sync: ${lastSyncTime || 'never'})`);

      while (hasMore) {
        const response = await this.mlsGridClient.getProperties({
          modificationTimestamp: lastSyncTime?.toISOString(),
          limit,
          skip,
        });

        if (response.value && response.value.length > 0) {
          const properties = response.value.map((item: any) => 
            this.transformPropertyData(item)
          );

          // Upsert properties
          for (const property of properties) {
            try {
              const existing = await storage.getPropertyByListingId(property.listingId);
              if (existing) {
                await storage.updateProperty(existing.id, property);
              } else {
                await storage.createProperty(property);
              }
              totalSynced++;
            } catch (error) {
              console.error(`Failed to upsert property ${property.listingId}:`, error);
            }
          }

          skip += response.value.length;
          hasMore = response.value.length === limit;
          
          console.log(`📊 Synced ${totalSynced} properties so far...`);
        } else {
          hasMore = false;
        }
      }

      // Update success status
      await this.updateSyncMetadata('properties', {
        lastSyncTimestamp: new Date(),
        lastSyncStatus: 'success',
        lastSyncMessage: `Successfully synced ${totalSynced} properties`,
        propertiesSynced: totalSynced,
      });

      console.log(`✅ Properties sync complete: ${totalSynced} properties`);
    } catch (error) {
      await this.updateSyncMetadata('properties', {
        lastSyncStatus: 'error',
        lastSyncMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Sync media from MLS Grid
   */
  async syncMedia(): Promise<void> {
    try {
      const metadata = await this.getSyncMetadata('media');
      const lastSyncTime = metadata?.lastSyncTimestamp;

      await this.updateSyncMetadata('media', {
        lastSyncStatus: 'in_progress',
        lastSyncMessage: 'Fetching media from MLS Grid...',
      });

      let totalSynced = 0;
      let hasMore = true;
      let skip = 0;
      const limit = 100;

      console.log(`📥 Syncing media (last sync: ${lastSyncTime || 'never'})`);

      while (hasMore) {
        const response = await this.mlsGridClient.getMedia({
          modificationTimestamp: lastSyncTime?.toISOString(),
          limit,
          skip,
        });

        if (response.value && response.value.length > 0) {
          const mediaItems = response.value.map((item: any) => 
            this.transformMediaData(item)
          );

          // Upsert media
          for (const mediaItem of mediaItems) {
            try {
              const existing = await storage.getMediaByKey(mediaItem.mediaKey);
              if (existing) {
                await storage.updateMedia(existing.id, mediaItem);
              } else {
                await storage.createMedia(mediaItem);
              }
              totalSynced++;
            } catch (error) {
              console.error(`Failed to upsert media ${mediaItem.mediaKey}:`, error);
            }
          }

          skip += response.value.length;
          hasMore = response.value.length === limit;
          
          console.log(`📊 Synced ${totalSynced} media items so far...`);
        } else {
          hasMore = false;
        }
      }

      await this.updateSyncMetadata('media', {
        lastSyncTimestamp: new Date(),
        lastSyncStatus: 'success',
        lastSyncMessage: `Successfully synced ${totalSynced} media items`,
        mediaSynced: totalSynced,
      });

      console.log(`✅ Media sync complete: ${totalSynced} items`);
    } catch (error) {
      await this.updateSyncMetadata('media', {
        lastSyncStatus: 'error',
        lastSyncMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Helper function to ensure array fields are always arrays
   */
  private ensureArray(value: any): string[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value;
    return [value];
  }

  /**
   * Transform MLS Grid RESO property data to our schema
   */
  private transformPropertyData(mlsData: any): InsertProperty {
    return {
      id: mlsData.ListingKey || mlsData.ListingId,
      listingId: mlsData.ListingId,
      mlgCanView: mlsData.MLGCanView ?? true,
      modificationTimestamp: new Date(mlsData.ModificationTimestamp),
      originatingSystemModificationTimestamp: mlsData.OriginatingSystemModificationTimestamp 
        ? new Date(mlsData.OriginatingSystemModificationTimestamp)
        : undefined,
      
      // Basic Info
      listPrice: mlsData.ListPrice?.toString(),
      closePrice: mlsData.ClosePrice?.toString(),
      standardStatus: mlsData.StandardStatus,
      propertyType: mlsData.PropertyType,
      propertySubType: mlsData.PropertySubType,
      
      // Address
      unparsedAddress: mlsData.UnparsedAddress,
      streetNumber: mlsData.StreetNumber,
      streetName: mlsData.StreetName,
      unitNumber: mlsData.UnitNumber,
      city: mlsData.City,
      stateOrProvince: mlsData.StateOrProvince,
      postalCode: mlsData.PostalCode,
      
      // Location
      latitude: mlsData.Latitude?.toString(),
      longitude: mlsData.Longitude?.toString(),
      subdivision: mlsData.SubdivisionName,
      neighborhood: mlsData.Neighborhood,
      countyOrParish: mlsData.CountyOrParish,
      
      // Property Details
      bedroomsTotal: mlsData.BedroomsTotal,
      mainLevelBedrooms: mlsData.MainLevelBedrooms,
      bathroomsTotalInteger: mlsData.BathroomsTotalInteger,
      bathroomsFull: mlsData.BathroomsFull,
      bathroomsHalf: mlsData.BathroomsHalf,
      livingArea: mlsData.LivingArea?.toString(),
      lotSizeSquareFeet: mlsData.LotSizeSquareFeet?.toString(),
      lotSizeAcres: mlsData.LotSizeAcres?.toString(),
      yearBuilt: mlsData.YearBuilt,
      storiesTotal: mlsData.StoriesTotal,
      propertyCondition: this.ensureArray(mlsData.PropertyCondition),
      
      // Parking & Garage
      garageParkingSpaces: mlsData.GarageSpaces,
      totalParkingSpaces: mlsData.TotalParkingSpaces,
      parkingFeatures: this.ensureArray(mlsData.ParkingFeatures),
      
      // Listing Details
      daysOnMarket: mlsData.DaysOnMarket,
      listingContractDate: mlsData.ListingContractDate ? new Date(mlsData.ListingContractDate) : undefined,
      closeDate: mlsData.CloseDate ? new Date(mlsData.CloseDate) : undefined,
      priceChangeTimestamp: mlsData.PriceChangeTimestamp ? new Date(mlsData.PriceChangeTimestamp) : undefined,
      
      // Schools
      elementarySchool: mlsData.ElementarySchool,
      middleOrJuniorSchool: mlsData.MiddleOrJuniorSchool,
      highSchool: mlsData.HighSchool,
      schoolDistrict: mlsData.SchoolDistrict,
      
      // Descriptions
      publicRemarks: mlsData.PublicRemarks,
      privateRemarks: mlsData.PrivateRemarks,
      
      // MLS Info
      mlsId: mlsData.MlsId || mlsData.ListingId,
      mlsAreaMajor: mlsData.MLSAreaMajor,
      listAgentMlsId: mlsData.ListAgentMlsId,
      listOfficeMlsId: mlsData.ListOfficeMlsId,
      
      // Listing Conditions & Contingencies
      flexListingYN: mlsData.FlexListingYN,
      propertySaleContingency: mlsData.PropertySaleContingency,
      specialListingConditions: this.ensureArray(mlsData.SpecialListingConditions),
      showingRequirements: this.ensureArray(mlsData.ShowingRequirements),
      occupantType: mlsData.OccupantType,
      possession: mlsData.Possession,
      buyerFinancing: this.ensureArray(mlsData.BuyerFinancing),
      
      // Property Features & Amenities
      associationYN: mlsData.AssociationYN,
      ownershipType: mlsData.OwnershipType,
      poolPrivateYN: mlsData.PoolPrivateYN,
      poolFeatures: this.ensureArray(mlsData.PoolFeatures),
      spaFeatures: this.ensureArray(mlsData.SpaFeatures),
      waterfrontYN: mlsData.WaterfrontYN,
      waterfrontFeatures: this.ensureArray(mlsData.WaterfrontFeatures),
      viewYN: mlsData.ViewYN,
      view: this.ensureArray(mlsData.View),
      horseYN: mlsData.HorseYN,
      horseAmenities: this.ensureArray(mlsData.HorseAmenities),
      
      // Interior Features
      interiorFeatures: this.ensureArray(mlsData.InteriorFeatures),
      flooring: this.ensureArray(mlsData.Flooring),
      fireplaceFeatures: this.ensureArray(mlsData.FireplaceFeatures),
      windowFeatures: this.ensureArray(mlsData.WindowFeatures),
      accessibilityFeatures: this.ensureArray(mlsData.AccessibilityFeatures),
      securityFeatures: this.ensureArray(mlsData.SecurityFeatures),
      
      // Exterior Features
      exteriorFeatures: this.ensureArray(mlsData.ExteriorFeatures),
      foundationDetails: this.ensureArray(mlsData.FoundationDetails),
      lotFeatures: this.ensureArray(mlsData.LotFeatures),
      fencing: this.ensureArray(mlsData.Fencing),
      patioAndPorchFeatures: this.ensureArray(mlsData.PatioAndPorchFeatures),
      
      // Community & Location Features
      communityFeatures: this.ensureArray(mlsData.CommunityFeatures),
      
      // Utilities & Systems
      heating: this.ensureArray(mlsData.Heating),
      cooling: this.ensureArray(mlsData.Cooling),
      waterSource: this.ensureArray(mlsData.WaterSource),
      sewer: this.ensureArray(mlsData.Sewer),
      utilities: this.ensureArray(mlsData.Utilities),
      
      // Green/Sustainability
      greenEnergyEfficient: this.ensureArray(mlsData.GreenEnergyEfficient),
      greenSustainability: this.ensureArray(mlsData.GreenSustainability),
      greenBuildingVerificationType: this.ensureArray(mlsData.GreenBuildingVerificationType),
      greenVerificationMetric: mlsData.GreenVerificationMetric,
      greenVerificationStatus: this.ensureArray(mlsData.GreenVerificationStatus),
      greenVerificationRating: mlsData.GreenVerificationRating,
      greenVerificationYear: mlsData.GreenVerificationYear,
      
      // Store any additional fields
      additionalData: mlsData,
    };
  }

  /**
   * Transform MLS Grid media data to our schema
   */
  private transformMediaData(mlsData: any): InsertMedia {
    return {
      mediaKey: mlsData.MediaKey,
      resourceRecordKey: mlsData.ResourceRecordKey,
      mediaURL: mlsData.MediaURL,
      mediaCategory: mlsData.MediaCategory,
      mediaType: mlsData.MediaType,
      order: mlsData.Order,
      caption: mlsData.ShortDescription || mlsData.LongDescription,
      modificationTimestamp: new Date(mlsData.ModificationTimestamp),
      localPath: null,
    };
  }

  /**
   * Get sync metadata for a specific type
   */
  private async getSyncMetadata(syncType: string): Promise<SyncMetadata | undefined> {
    if (!db) return undefined;
    
    try {
      const result = await db
        .select()
        .from(syncMetadata)
        .where(eq(syncMetadata.syncType, syncType))
        .limit(1);
      
      return result?.[0];
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Update sync metadata
   */
  private async updateSyncMetadata(syncType: string, data: any): Promise<void> {
    if (!db) return;
    
    try {
      const existing = await this.getSyncMetadata(syncType);
      
      if (existing) {
        await db
          .update(syncMetadata)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(syncMetadata.syncType, syncType));
      } else {
        await db
          .insert(syncMetadata)
          .values({ syncType, ...data });
      }
    } catch (error) {
      console.error(`Failed to update sync metadata for ${syncType}:`, error);
    }
  }
}

// Global sync service instance
let syncService: MLSGridSyncService | null = null;

export function startMLSGridSync(mlsGridClient: MLSGridClient, intervalMinutes: number = 60): void {
  if (syncService) {
    console.log('MLS Grid sync service already running');
    return;
  }

  syncService = new MLSGridSyncService(mlsGridClient, intervalMinutes);
  syncService.start();
}

export function startMLSGridScheduledSync(mlsGridClient: MLSGridClient): void {
  if (syncService) {
    console.log('MLS Grid sync service already running');
    return;
  }

  syncService = new MLSGridSyncService(mlsGridClient);
  syncService.startScheduled();
}

export function triggerManualSync(): Promise<void> {
  if (!syncService) {
    return Promise.reject(new Error('MLS Grid sync service not initialized'));
  }
  return syncService.syncAll();
}

export function stopMLSGridSync(): void {
  if (syncService) {
    syncService.stop();
    syncService = null;
  }
}

export function getMLSGridSyncService(): MLSGridSyncService | null {
  return syncService;
}
