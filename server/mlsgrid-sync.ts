import { MLSGridClient } from './mlsgrid-client';
import { storage } from './storage';
import type { InsertProperty, InsertMedia, SyncMetadata } from '@shared/schema';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { syncMetadata } from '@shared/schema';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Database connection for sync metadata
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const db = pool ? drizzle(pool) : null;

export class MLSGridSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(
    private mlsGridClient: MLSGridClient,
    private intervalMinutes: number = 60
  ) {}

  /**
   * Start automatic background sync
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
      console.log('🛑 MLS Grid auto-sync stopped');
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
      await Promise.all([
        this.syncProperties(),
        this.syncMedia()
      ]);
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
      
      // Property Details
      bedroomsTotal: mlsData.BedroomsTotal,
      bathroomsTotalInteger: mlsData.BathroomsTotalInteger,
      bathroomsFull: mlsData.BathroomsFull,
      bathroomsHalf: mlsData.BathroomsHalf,
      livingArea: mlsData.LivingArea?.toString(),
      lotSizeSquareFeet: mlsData.LotSizeSquareFeet?.toString(),
      lotSizeAcres: mlsData.LotSizeAcres?.toString(),
      yearBuilt: mlsData.YearBuilt,
      
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
      
      // MLS Info
      mlsId: mlsData.MlsId || mlsData.ListingId,
      mlsAreaMajor: mlsData.MLSAreaMajor,
      listAgentMlsId: mlsData.ListAgentMlsId,
      listOfficeMlsId: mlsData.ListOfficeMlsId,
      
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

export function stopMLSGridSync(): void {
  if (syncService) {
    syncService.stop();
    syncService = null;
  }
}

export function getMLSGridSyncService(): MLSGridSyncService | null {
  return syncService;
}
