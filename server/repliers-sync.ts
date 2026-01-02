import { getUnifiedInventory, clearInventoryCache } from './inventory-service';
import { getRepliersClient, isRepliersConfigured } from './repliers-client';
import type { Express, Request, Response } from 'express';

interface SyncStatus {
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  lastSyncDuration: number | null;
  lastSyncCounts: {
    Active: number;
    'Active Under Contract': number;
    Pending: number;
    Closed: number;
    total: number;
  } | null;
  isSyncing: boolean;
  nextScheduledSync: string | null;
  errors: string[];
}

class RepliersSyncService {
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private useScheduledSync: boolean = false;
  private scheduledHour: number = 0;
  private scheduledMinute: number = 0;
  private timezone: string = 'America/Chicago';
  
  private syncStatus: SyncStatus = {
    lastSyncAt: null,
    lastSyncSuccess: false,
    lastSyncDuration: null,
    lastSyncCounts: null,
    isSyncing: false,
    nextScheduledSync: null,
    errors: [],
  };

  private getMillisecondsUntilNextSync(): number {
    const now = new Date();
    
    const cstFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    
    const cstParts = cstFormatter.formatToParts(now);
    const currentHour = parseInt(cstParts.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(cstParts.find(p => p.type === 'minute')?.value || '0');
    
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const targetTotalMinutes = this.scheduledHour * 60 + this.scheduledMinute;
    
    let minutesUntilSync = targetTotalMinutes - currentTotalMinutes;
    
    if (minutesUntilSync <= 0) {
      minutesUntilSync += 24 * 60;
    }
    
    const hoursUntil = Math.floor(minutesUntilSync / 60);
    const minsUntil = minutesUntilSync % 60;
    
    console.log(`⏰ Next Repliers inventory sync scheduled in ${hoursUntil}h ${minsUntil}m (12:00 AM CST)`);
    
    const nextSyncDate = new Date(now.getTime() + minutesUntilSync * 60 * 1000);
    this.syncStatus.nextScheduledSync = nextSyncDate.toISOString();
    
    return minutesUntilSync * 60 * 1000;
  }

  startScheduled() {
    if (this.scheduledTimeout) {
      console.log('⚠️ Repliers scheduled sync already running');
      return;
    }

    this.useScheduledSync = true;
    console.log('🕛 Starting Repliers inventory scheduled sync (daily at 12:00 AM CST)');
    
    this.scheduleNextSync();
  }

  private scheduleNextSync() {
    const msUntilSync = this.getMillisecondsUntilNextSync();
    
    this.scheduledTimeout = setTimeout(async () => {
      try {
        console.log('🔄 Running scheduled Repliers inventory sync (12:00 AM CST)...');
        await this.syncInventory();
      } catch (error) {
        console.error('❌ Scheduled Repliers inventory sync failed:', error);
      }
      
      if (this.useScheduledSync) {
        this.scheduleNextSync();
      }
    }, msUntilSync);
  }

  stop() {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
      this.useScheduledSync = false;
      console.log('🛑 Repliers scheduled sync stopped');
    }
  }

  async syncInventory(): Promise<SyncStatus> {
    if (this.isSyncing) {
      console.log('⏩ Repliers sync already in progress, skipping...');
      return this.syncStatus;
    }

    if (!isRepliersConfigured()) {
      const error = 'Repliers API not configured';
      console.error('❌', error);
      this.syncStatus.errors = [error];
      return this.syncStatus;
    }

    this.isSyncing = true;
    this.syncStatus.isSyncing = true;
    const startTime = Date.now();

    console.log('🔄 Starting Repliers inventory sync...');

    try {
      clearInventoryCache();
      
      const inventory = await getUnifiedInventory(true);
      
      const duration = Date.now() - startTime;
      
      this.syncStatus = {
        lastSyncAt: new Date().toISOString(),
        lastSyncSuccess: true,
        lastSyncDuration: duration,
        lastSyncCounts: {
          Active: inventory.countsByStatus.Active,
          'Active Under Contract': inventory.countsByStatus['Active Under Contract'],
          Pending: inventory.countsByStatus.Pending,
          Closed: inventory.countsByStatus.Closed,
          total: inventory.totalCount,
        },
        isSyncing: false,
        nextScheduledSync: this.syncStatus.nextScheduledSync,
        errors: inventory.errors,
      };

      console.log(`✅ Repliers inventory sync completed in ${duration}ms`);
      console.log(`   Total: ${inventory.totalCount}, Active: ${inventory.countsByStatus.Active}, AUC: ${inventory.countsByStatus['Active Under Contract']}, Pending: ${inventory.countsByStatus.Pending}, Closed: ${inventory.countsByStatus.Closed}`);

      return this.syncStatus;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.syncStatus = {
        ...this.syncStatus,
        lastSyncAt: new Date().toISOString(),
        lastSyncSuccess: false,
        lastSyncDuration: duration,
        isSyncing: false,
        errors: [error.message || 'Unknown error'],
      };

      console.error('❌ Repliers inventory sync failed:', error.message);
      throw error;
    } finally {
      this.isSyncing = false;
      this.syncStatus.isSyncing = false;
    }
  }

  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }
}

let syncServiceInstance: RepliersSyncService | null = null;

export function getRepliersSyncService(): RepliersSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new RepliersSyncService();
  }
  return syncServiceInstance;
}

export function startRepliersScheduledSync() {
  const service = getRepliersSyncService();
  service.startScheduled();
}

export async function triggerRepliersSync(): Promise<SyncStatus> {
  const service = getRepliersSyncService();
  return service.syncInventory();
}

export function getRepliersySyncStatus(): SyncStatus {
  const service = getRepliersSyncService();
  return service.getStatus();
}

export function registerRepliersSyncRoutes(app: Express) {
  app.post('/api/admin/repliers/sync', async (req: Request, res: Response) => {
    try {
      console.log('📡 Manual Repliers inventory sync triggered');
      const status = await triggerRepliersSync();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ 
        error: 'Sync failed', 
        message: error.message,
        status: getRepliersySyncStatus()
      });
    }
  });

  app.get('/api/admin/repliers/sync/status', (req: Request, res: Response) => {
    res.json(getRepliersySyncStatus());
  });
}
