import { adminActivityLogs, users } from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool: PgPool } = pg;
import type { Request } from "express";

function getDb() {
  const pool = new PgPool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  return drizzle(pool);
}

export type AdminAction = 
  | 'USER_ROLE_CHANGED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_CREATED'
  | 'USER_INVITED'
  | 'USER_DELETED'
  | 'SETTINGS_UPDATED';

interface LogActivityParams {
  adminUserId: string;
  action: AdminAction;
  targetUserId?: string;
  previousValue?: string;
  newValue?: string;
  details?: Record<string, unknown>;
  req?: Request;
}

export async function logAdminActivity({
  adminUserId,
  action,
  targetUserId,
  previousValue,
  newValue,
  details,
  req,
}: LogActivityParams): Promise<void> {
  try {
    const db = getDb();
    await db.insert(adminActivityLogs).values({
      adminUserId,
      action,
      targetUserId: targetUserId || null,
      previousValue: previousValue || null,
      newValue: newValue || null,
      details: details || null,
      ipAddress: req?.ip || (req?.headers['x-forwarded-for'] as string) || null,
      userAgent: req?.headers['user-agent'] || null,
    });
    console.log(`[AdminActivity] Logged: ${action} by ${adminUserId}${targetUserId ? ` on ${targetUserId}` : ''}`);
  } catch (error) {
    console.error('[AdminActivity] Failed to log activity:', error);
  }
}

interface GetActivityLogsFilters {
  adminUserId?: string;
  targetUserId?: string;
  action?: AdminAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function getActivityLogs(filters?: GetActivityLogsFilters) {
  const db = getDb();
  const conditions = [];
  
  if (filters?.adminUserId) {
    conditions.push(eq(adminActivityLogs.adminUserId, filters.adminUserId));
  }
  if (filters?.targetUserId) {
    conditions.push(eq(adminActivityLogs.targetUserId, filters.targetUserId));
  }
  if (filters?.action) {
    conditions.push(eq(adminActivityLogs.action, filters.action));
  }
  if (filters?.startDate) {
    conditions.push(gte(adminActivityLogs.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(adminActivityLogs.createdAt, filters.endDate));
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  // Get logs with admin and target user details
  const logs = await db
    .select({
      id: adminActivityLogs.id,
      action: adminActivityLogs.action,
      previousValue: adminActivityLogs.previousValue,
      newValue: adminActivityLogs.newValue,
      details: adminActivityLogs.details,
      ipAddress: adminActivityLogs.ipAddress,
      createdAt: adminActivityLogs.createdAt,
      adminUserId: adminActivityLogs.adminUserId,
      targetUserId: adminActivityLogs.targetUserId,
    })
    .from(adminActivityLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(adminActivityLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get user details for admin and target users
  const userIds = new Set<string>();
  logs.forEach(log => {
    userIds.add(log.adminUserId);
    if (log.targetUserId) userIds.add(log.targetUserId);
  });

  const userList = userIds.size > 0 
    ? await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users)
    : [];

  const userMap = new Map(userList.map(u => [u.id, u]));

  return logs.map(log => ({
    ...log,
    adminUser: userMap.get(log.adminUserId) || null,
    targetUser: log.targetUserId ? userMap.get(log.targetUserId) || null : null,
  }));
}
