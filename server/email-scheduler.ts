import { storage } from "./storage";
import { findMatchingProperties, calculateMarketSummary } from "./seller-update-service";
import { generateSellerUpdateEmail, generateSellerUpdateTextEmail } from "./email-templates";
import type { SellerUpdate } from "@shared/schema";

// SendGrid configuration (optional - if not configured, emails will be logged instead)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "updates@mlsgrid-idx.com";
const FROM_NAME = process.env.FROM_NAME || "MLS Grid IDX Platform";

interface EmailSendResult {
  success: boolean;
  updateId: string;
  recipientEmail: string;
  error?: string;
}

/**
 * Determines if a seller update is due to be sent based on frequency and last sent date
 */
function isUpdateDue(update: SellerUpdate): boolean {
  if (!update.isActive) {
    return false;
  }

  const now = new Date();
  
  // If never sent, it's due
  if (!update.lastSentAt) {
    return true;
  }

  const lastSent = new Date(update.lastSentAt);
  const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

  switch (update.emailFrequency) {
    case 'daily':
      // Send if 24 hours have passed
      return hoursSinceLastSent >= 24;
    
    case 'weekly':
      // Send if 7 days have passed
      return hoursSinceLastSent >= 24 * 7;
    
    case 'bi-weekly':
      // Send if 14 days have passed
      return hoursSinceLastSent >= 24 * 14;
    
    case 'monthly':
      // Send if 30 days have passed (approximation)
      return hoursSinceLastSent >= 24 * 30;
    
    default:
      return false;
  }
}

/**
 * Sends an email via SendGrid or logs it if SendGrid is not configured
 */
async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log('📧 [Email Scheduler] SendGrid not configured. Email would have been sent:');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   HTML Length: ${htmlContent.length} chars`);
    console.log(`   Text Length: ${textContent.length} chars`);
    return;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            subject: subject,
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        content: [
          {
            type: 'text/plain',
            value: textContent,
          },
          {
            type: 'text/html',
            value: htmlContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    console.log(`✅ [Email Scheduler] Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`❌ [Email Scheduler] Failed to send email to ${to}:`, error);
    throw error;
  }
}

/**
 * Processes a single seller update - finds matching properties and sends email
 */
async function processSellerUpdate(update: SellerUpdate): Promise<EmailSendResult> {
  try {
    console.log(`🔄 [Email Scheduler] Processing seller update: ${update.name} (${update.id})`);

    // Find matching properties
    const result = await findMatchingProperties(update);
    
    // Calculate market summary
    const marketSummary = calculateMarketSummary(result.properties);
    
    // If no properties found or no market summary, skip this update
    if (!marketSummary || result.totalMatches === 0) {
      console.log(`⏭️  [Email Scheduler] Skipping ${update.name} - no matching properties found`);
      return {
        success: true,
        updateId: update.id,
        recipientEmail: update.email,
      };
    }

    // Get recipient name from email (e.g., "john@example.com" -> "John")
    const recipientName = update.email.split('@')[0]
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Generate email content
    const htmlContent = generateSellerUpdateEmail({
      recipientName,
      updateName: update.name,
      postalCode: update.postalCode,
      elementarySchool: update.elementarySchool || undefined,
      propertySubType: update.propertySubType || undefined,
      properties: result.properties.slice(0, 10), // Show top 10 in email
      marketSummary,
      totalMatches: result.totalMatches,
    });

    const textContent = generateSellerUpdateTextEmail({
      recipientName,
      updateName: update.name,
      postalCode: update.postalCode,
      elementarySchool: update.elementarySchool || undefined,
      propertySubType: update.propertySubType || undefined,
      properties: result.properties.slice(0, 10),
      marketSummary,
      totalMatches: result.totalMatches,
    });

    const subject = `Market Update: ${update.postalCode}${update.elementarySchool ? ` • ${update.elementarySchool}` : ''} - ${result.totalMatches} Properties`;

    // Send email
    await sendEmail(update.email, subject, htmlContent, textContent);

    // Update lastSentAt timestamp
    await storage.updateSellerUpdate(update.id, {
      lastSentAt: new Date(),
    });

    return {
      success: true,
      updateId: update.id,
      recipientEmail: update.email,
    };
  } catch (error) {
    console.error(`❌ [Email Scheduler] Failed to process seller update ${update.id}:`, error);
    return {
      success: false,
      updateId: update.id,
      recipientEmail: update.email,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main scheduler function that processes all due seller updates
 */
export async function processScheduledEmails(): Promise<EmailSendResult[]> {
  console.log('⏰ [Email Scheduler] Starting scheduled email processing...');

  try {
    // Get all active seller updates
    const allUpdates = await storage.getAllSellerUpdates();
    const activeUpdates = allUpdates.filter(update => update.isActive);

    console.log(`📋 [Email Scheduler] Found ${activeUpdates.length} active seller updates`);

    // Filter to only those that are due
    const dueUpdates = activeUpdates.filter(isUpdateDue);

    console.log(`📨 [Email Scheduler] ${dueUpdates.length} updates are due to be sent`);

    if (dueUpdates.length === 0) {
      console.log('✅ [Email Scheduler] No updates due at this time');
      return [];
    }

    // Process each due update
    const results: EmailSendResult[] = [];
    for (const update of dueUpdates) {
      const result = await processSellerUpdate(update);
      results.push(result);
      
      // Add a small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`✅ [Email Scheduler] Processing complete: ${successCount} sent, ${failureCount} failed`);

    return results;
  } catch (error) {
    console.error('❌ [Email Scheduler] Critical error during scheduled email processing:', error);
    return [];
  }
}

/**
 * Starts the email scheduler that runs every hour
 */
export function startEmailScheduler(): void {
  console.log('🚀 [Email Scheduler] Starting email scheduler...');
  
  // Skip all scheduled processing in development to prevent memory issues
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    console.log('⏭️ [Email Scheduler] Skipping email scheduler in development mode (use manual trigger for testing)');
    return;
  }

  // Run immediately on startup in production
  processScheduledEmails().catch(console.error);

  // Then run every hour
  const HOUR_IN_MS = 60 * 60 * 1000;
  setInterval(() => {
    processScheduledEmails().catch(console.error);
  }, HOUR_IN_MS);

  console.log('✅ [Email Scheduler] Email scheduler started (runs every hour)');
}

/**
 * Manually triggers email processing for a specific seller update
 * Useful for testing or on-demand sends
 */
export async function sendSellerUpdateNow(updateId: string): Promise<EmailSendResult> {
  console.log(`📧 [Email Scheduler] Manually triggering email for update: ${updateId}`);
  
  const update = await storage.getSellerUpdate(updateId);
  if (!update) {
    throw new Error(`Seller update not found: ${updateId}`);
  }

  return await processSellerUpdate(update);
}
