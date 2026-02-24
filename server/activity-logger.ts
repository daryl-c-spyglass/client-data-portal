import { activityLogs } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool: PgPool } = pg;
import type { Request } from "express";

function getDb() {
  const pool = new PgPool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  return drizzle(pool);
}

export type ActivityAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_SESSION_EXPIRED'
  | 'CMA_CREATED'
  | 'CMA_UPDATED'
  | 'CMA_DELETED'
  | 'CMA_VIEWED'
  | 'CMA_EXPORTED_PDF'
  | 'CMA_SHARED'
  | 'PROPERTY_SEARCH'
  | 'PROPERTY_VIEWED'
  | 'PROPERTY_FAVORITED'
  | 'BUYER_SEARCH_CREATED'
  | 'BUYER_SEARCH_UPDATED'
  | 'BUYER_SEARCH_DELETED'
  | 'SELLER_UPDATE_CREATED'
  | 'SELLER_UPDATE_SENT'
  | 'USER_ROLE_CHANGED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_DELETED'
  | 'FEATURE_VISIBILITY_CHANGED'
  | 'FEATURE_VISIBILITY_BULK_UPDATE'
  | 'API_ERROR'
  | 'RATE_LIMIT_EXCEEDED';

export interface LogActivityParams {
  userId?: string;
  userEmail?: string;
  action: ActivityAction;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  status?: 'success' | 'error' | 'warning';
  errorMessage?: string;
  durationMs?: number;
  req?: Request;
}

export async function logActivity({
  userId,
  userEmail,
  action,
  resource,
  resourceId,
  details,
  status = 'success',
  errorMessage,
  durationMs,
  req,
}: LogActivityParams): Promise<void> {
  try {
    const db = getDb();
    await db.insert(activityLogs).values({
      userId: userId || (req as any)?.user?.id || null,
      userEmail: userEmail || (req as any)?.user?.email || null,
      action,
      resource: resource || null,
      resourceId: resourceId || null,
      details: details || null,
      status,
      errorMessage: errorMessage || null,
      durationMs: durationMs || null,
      ipAddress: req?.ip || (req?.headers?.['x-forwarded-for'] as string) || null,
      userAgent: req?.headers?.['user-agent'] || null,
      sessionId: (req as any)?.sessionID || null,
    });
    console.log(`[ActivityLogger] Logged ${action} for ${userEmail || (req as any)?.user?.email || 'system'} on ${resource || ''}${resourceId ? ':' + resourceId : ''}`);
  } catch (error) {
    console.error('[ActivityLogger] Failed to log activity:', error);
  }
}
