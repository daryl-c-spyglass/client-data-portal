import cron from 'node-cron';
import { storage } from './storage';
import { 
  sendSellerUpdateEmail, 
  calculateNextSendDate, 
  initResend, 
  isResendConfigured 
} from './resend-service';
import { isRepliersConfigured, getRepliersClient } from './repliers-client';
import type { SellerUpdate } from '@shared/schema';

interface SchedulerStatus {
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  processedCount: number;
  errorCount: number;
}

let schedulerStatus: SchedulerStatus = {
  isRunning: false,
  lastRun: null,
  nextRun: null,
  processedCount: 0,
  errorCount: 0,
};

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

async function findMatchingPropertiesForUpdate(sellerUpdate: SellerUpdate): Promise<any[]> {
  if (!isRepliersConfigured()) {
    console.warn('⚠️ Repliers API not configured');
    return [];
  }

  const repliersClient = getRepliersClient();
  if (!repliersClient) {
    console.warn('⚠️ Repliers client not available');
    return [];
  }
  
  try {
    // Build search params from all criteria
    const searchParams: any = {
      standardStatus: 'Closed',
      pageSize: 50,
      sortBy: 'closeDate',
      sortOrder: 'desc',
    };

    // Location criteria - at least one should be set
    if (sellerUpdate.postalCode) {
      searchParams.postalCode = sellerUpdate.postalCode;
    }
    if (sellerUpdate.city) {
      searchParams.city = sellerUpdate.city;
    }
    if (sellerUpdate.subdivision) {
      searchParams.area = sellerUpdate.subdivision;
    }

    // Helper to safely parse integer values - returns undefined if invalid
    const safeParseInt = (value: string | null | undefined): number | undefined => {
      if (!value || value.trim() === '') return undefined;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? undefined : parsed;
    };
    
    // Helper to safely parse float values (for baths which can be 2.5, etc.)
    const safeParseFloat = (value: string | null | undefined): number | undefined => {
      if (!value || value.trim() === '') return undefined;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? undefined : parsed;
    };

    // Property criteria that Repliers API supports
    const minBeds = safeParseInt(sellerUpdate.minBeds);
    if (minBeds !== undefined) searchParams.minBeds = minBeds;
    
    const maxBeds = safeParseInt(sellerUpdate.maxBeds);
    if (maxBeds !== undefined) searchParams.maxBeds = maxBeds;
    
    // Baths can be fractional (e.g., 2.5)
    const minBaths = safeParseFloat(sellerUpdate.minBaths);
    if (minBaths !== undefined) searchParams.minBaths = minBaths;
    
    const maxBaths = safeParseFloat(sellerUpdate.maxBaths);
    if (maxBaths !== undefined) searchParams.maxBaths = maxBaths;
    
    const minSqft = safeParseInt(sellerUpdate.minSqft);
    if (minSqft !== undefined) searchParams.minSqft = minSqft;
    
    const maxSqft = safeParseInt(sellerUpdate.maxSqft);
    if (maxSqft !== undefined) searchParams.maxSqft = maxSqft;
    
    const minPrice = safeParseInt(sellerUpdate.minPrice);
    if (minPrice !== undefined) searchParams.minPrice = minPrice;
    
    const maxPrice = safeParseInt(sellerUpdate.maxPrice);
    if (maxPrice !== undefined) searchParams.maxPrice = maxPrice;

    // Sold within X days (default to 90 if not set or invalid)
    const soldDays = safeParseInt(sellerUpdate.soldDays) || 90;
    if (soldDays > 0) {
      const soldAfter = new Date();
      soldAfter.setDate(soldAfter.getDate() - soldDays);
      searchParams.soldDateAfter = soldAfter.toISOString().split('T')[0];
    }

    const result = await repliersClient.searchListings(searchParams);
    let properties = result.listings || [];

    // Client-side filtering for criteria not supported by API

    // Filter by elementary school
    if (sellerUpdate.elementarySchool) {
      properties = properties.filter((p: any) => {
        const school = p.raw?.ElementarySchool || p.elementarySchool || '';
        return school.toLowerCase().includes(sellerUpdate.elementarySchool!.toLowerCase());
      });
    }

    // Filter by middle school
    if (sellerUpdate.middleSchool) {
      properties = properties.filter((p: any) => {
        const school = p.raw?.MiddleOrJuniorSchool || p.middleSchool || '';
        return school.toLowerCase().includes(sellerUpdate.middleSchool!.toLowerCase());
      });
    }

    // Filter by high school
    if (sellerUpdate.highSchool) {
      properties = properties.filter((p: any) => {
        const school = p.raw?.HighSchool || p.highSchool || '';
        return school.toLowerCase().includes(sellerUpdate.highSchool!.toLowerCase());
      });
    }

    // Filter by property subtype
    if (sellerUpdate.propertySubType && sellerUpdate.propertySubType !== 'all') {
      properties = properties.filter((p: any) => {
        const subType = p.propertySubType || p.class || '';
        return subType.toLowerCase().includes(sellerUpdate.propertySubType!.toLowerCase());
      });
    }

    // Filter by year built
    const minYearBuilt = safeParseInt(sellerUpdate.minYearBuilt);
    const maxYearBuilt = safeParseInt(sellerUpdate.maxYearBuilt);
    if (minYearBuilt !== undefined || maxYearBuilt !== undefined) {
      properties = properties.filter((p: any) => {
        const yearBuilt = p.yearBuilt || p.raw?.YearBuilt;
        if (!yearBuilt) return true; // Include if year unknown
        const year = parseInt(String(yearBuilt), 10);
        if (isNaN(year)) return true;
        if (minYearBuilt !== undefined && year < minYearBuilt) return false;
        if (maxYearBuilt !== undefined && year > maxYearBuilt) return false;
        return true;
      });
    }

    // Limit results for email
    return properties.slice(0, 20);
  } catch (error) {
    console.error('Error fetching properties for seller update:', error);
    return [];
  }
}

async function getAgentInfoForUpdate(userId: string): Promise<{ name: string; email: string; phone?: string } | null> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return null;

    return {
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Spyglass Realty',
      email: user.email,
      phone: user.phone || undefined,
    };
  } catch (error) {
    console.error('Error fetching agent info:', error);
    return null;
  }
}

async function processSellerUpdate(sellerUpdate: SellerUpdate): Promise<boolean> {
  console.log(`📧 Processing seller update: ${sellerUpdate.name} (ID: ${sellerUpdate.id})`);

  const agent = await getAgentInfoForUpdate(sellerUpdate.userId);
  if (!agent) {
    console.error(`❌ Could not find agent for seller update ${sellerUpdate.id}`);
    await storage.createSendHistory({
      sellerUpdateId: sellerUpdate.id,
      recipientEmail: sellerUpdate.email,
      status: 'failed',
      propertyCount: 0,
      errorMessage: 'Agent not found',
    });
    return false;
  }

  const properties = await findMatchingPropertiesForUpdate(sellerUpdate);
  
  if (properties.length === 0) {
    console.log(`⚠️ No properties found for seller update ${sellerUpdate.id}`);
    await storage.createSendHistory({
      sellerUpdateId: sellerUpdate.id,
      recipientEmail: sellerUpdate.email,
      status: 'failed',
      propertyCount: 0,
      errorMessage: 'No matching properties found',
    });
    return false;
  }

  const clientName = sellerUpdate.name.split(' ')[0] || 'Valued Client';
  
  const result = await sendSellerUpdateEmail(
    sellerUpdate,
    properties,
    agent,
    clientName,
    false
  );

  await storage.createSendHistory({
    sellerUpdateId: sellerUpdate.id,
    recipientEmail: sellerUpdate.email,
    status: result.success ? 'success' : 'failed',
    propertyCount: properties.length,
    errorMessage: result.error,
    sendgridMessageId: result.messageId,
  });

  if (result.success) {
    const nextSendAt = calculateNextSendDate(sellerUpdate.emailFrequency);
    await storage.updateSellerUpdate(sellerUpdate.id, {
      lastSentAt: new Date(),
      nextSendAt,
    });
    console.log(`✅ Successfully sent email for ${sellerUpdate.name}, next send: ${nextSendAt.toISOString()}`);
  } else {
    console.error(`❌ Failed to send email for ${sellerUpdate.name}: ${result.error}`);
  }

  return result.success;
}

async function runScheduledJob(): Promise<void> {
  if (schedulerStatus.isRunning) {
    console.log('⏳ Scheduler already running, skipping...');
    return;
  }

  schedulerStatus.isRunning = true;
  schedulerStatus.lastRun = new Date();
  
  console.log('🕘 Running seller update scheduler job...');

  try {
    const dueUpdates = await storage.getDueSellerUpdates();
    console.log(`📋 Found ${dueUpdates.length} due seller updates`);

    let successCount = 0;
    let errorCount = 0;

    for (const update of dueUpdates) {
      try {
        const success = await processSellerUpdate(update);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing seller update ${update.id}:`, error);
        errorCount++;
      }
    }

    schedulerStatus.processedCount += successCount;
    schedulerStatus.errorCount += errorCount;
    
    console.log(`✅ Scheduler job completed: ${successCount} sent, ${errorCount} errors`);
  } catch (error) {
    console.error('❌ Scheduler job failed:', error);
    schedulerStatus.errorCount++;
  } finally {
    schedulerStatus.isRunning = false;
  }
}

export function startScheduler(): boolean {
  if (!isResendConfigured()) {
    console.warn('⚠️ Resend not configured. Seller update scheduler disabled.');
    return false;
  }

  initResend();

  scheduledTask = cron.schedule('0 9 * * *', runScheduledJob, {
    timezone: 'America/Chicago',
  });

  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(9, 0, 0, 0);
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  schedulerStatus.nextRun = nextRun;

  console.log('✅ Seller update scheduler started (9 AM Central daily)');
  console.log(`📅 Next scheduled run: ${nextRun.toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
  
  return true;
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('🛑 Seller update scheduler stopped');
  }
}

export function getSchedulerStatus(): SchedulerStatus {
  return { ...schedulerStatus };
}

export async function runManualJob(): Promise<{ success: number; errors: number }> {
  console.log('🔧 Running manual scheduler job...');
  
  schedulerStatus.isRunning = true;
  schedulerStatus.lastRun = new Date();
  
  let successCount = 0;
  let errorCount = 0;

  try {
    const dueUpdates = await storage.getDueSellerUpdates();
    console.log(`📋 Found ${dueUpdates.length} due seller updates`);

    for (const update of dueUpdates) {
      try {
        const success = await processSellerUpdate(update);
        if (success) successCount++;
        else errorCount++;
      } catch (error) {
        console.error(`Error processing seller update ${update.id}:`, error);
        errorCount++;
      }
    }

    schedulerStatus.processedCount += successCount;
    schedulerStatus.errorCount += errorCount;
  } finally {
    schedulerStatus.isRunning = false;
  }

  return { success: successCount, errors: errorCount };
}

export { processSellerUpdate, findMatchingPropertiesForUpdate, getAgentInfoForUpdate };
