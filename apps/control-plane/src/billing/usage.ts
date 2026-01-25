import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getSubscriptionStatus, type SubscriptionStatus } from './subscription.js';

export type ResourceType = 'server' | 'app' | 'domain' | 'deploy';

export interface UsageCheckResult {
    allowed: boolean;
    current: number;
    limit: number;
    resource: ResourceType;
    message?: string;
}

// Get current usage counts for a user
export async function getCurrentUsage(userId: string): Promise<{
    servers: number;
    apps: number;
    domains: number;
    deploysToday: number;
}> {
    // Count servers
    const serversResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.nodes)
        .where(eq(schema.nodes.ownerId, userId))
        .get();

    // Count apps
    const appsResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.apps)
        .where(eq(schema.apps.ownerId, userId))
        .get();

    // Count domains
    const domainsResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.proxies)
        .where(eq(schema.proxies.ownerId, userId))
        .get();

    // Count deploys today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usageRecord = await db.select()
        .from(schema.usageRecords)
        .where(and(
            eq(schema.usageRecords.userId, userId),
            eq(schema.usageRecords.date, today)
        ))
        .get();

    return {
        servers: serversResult?.count || 0,
        apps: appsResult?.count || 0,
        domains: domainsResult?.count || 0,
        deploysToday: usageRecord?.deploysCount || 0
    };
}

// Check if user can perform action based on limits
export async function checkUsageLimit(
    userId: string,
    resource: ResourceType
): Promise<UsageCheckResult> {
    const status = await getSubscriptionStatus(userId);
    const usage = await getCurrentUsage(userId);

    let current: number;
    let limit: number;

    switch (resource) {
        case 'server':
            current = usage.servers;
            limit = status.limits.servers;
            break;
        case 'app':
            current = usage.apps;
            limit = status.limits.apps;
            break;
        case 'domain':
            current = usage.domains;
            limit = status.limits.domains;
            break;
        case 'deploy':
            current = usage.deploysToday;
            limit = status.limits.deploysPerDay;
            break;
    }

    // -1 means unlimited
    const allowed = limit === -1 || current < limit;

    return {
        allowed,
        current,
        limit,
        resource,
        message: allowed
            ? undefined
            : `You have reached your ${resource} limit (${current}/${limit}). Please upgrade your plan to add more.`
    };
}

// Increment usage counter (for deploys)
export async function incrementUsage(
    userId: string,
    resource: 'deploy' | 'apiCall'
): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Try to get existing record
    const existing = await db.select()
        .from(schema.usageRecords)
        .where(and(
            eq(schema.usageRecords.userId, userId),
            eq(schema.usageRecords.date, today)
        ))
        .get();

    if (existing) {
        // Update existing record
        if (resource === 'deploy') {
            await db.update(schema.usageRecords)
                .set({ deploysCount: (existing.deploysCount || 0) + 1 })
                .where(eq(schema.usageRecords.id, existing.id))
                .run();
        } else {
            await db.update(schema.usageRecords)
                .set({ apiCallsCount: (existing.apiCallsCount || 0) + 1 })
                .where(eq(schema.usageRecords.id, existing.id))
                .run();
        }
    } else {
        // Create new record
        await db.insert(schema.usageRecords).values({
            id: randomUUID(),
            userId,
            date: today,
            deploysCount: resource === 'deploy' ? 1 : 0,
            apiCallsCount: resource === 'apiCall' ? 1 : 0
        }).run();
    }
}

// Get usage statistics for a date range (for admin/analytics)
export async function getUsageStats(
    userId: string,
    startDate: string,
    endDate: string
): Promise<{
    totalDeploys: number;
    totalApiCalls: number;
    dailyStats: { date: string; deploys: number; apiCalls: number }[];
}> {
    const records = await db.select()
        .from(schema.usageRecords)
        .where(and(
            eq(schema.usageRecords.userId, userId),
            sql`${schema.usageRecords.date} >= ${startDate}`,
            sql`${schema.usageRecords.date} <= ${endDate}`
        ))
        .all();

    const totalDeploys = records.reduce((sum, r) => sum + (r.deploysCount || 0), 0);
    const totalApiCalls = records.reduce((sum, r) => sum + (r.apiCallsCount || 0), 0);

    const dailyStats = records.map(r => ({
        date: r.date,
        deploys: r.deploysCount || 0,
        apiCalls: r.apiCallsCount || 0
    }));

    return { totalDeploys, totalApiCalls, dailyStats };
}

// Get full usage report for user dashboard
export interface UsageReport {
    subscription: SubscriptionStatus;
    usage: {
        servers: { current: number; limit: number; percentage: number };
        apps: { current: number; limit: number; percentage: number };
        domains: { current: number; limit: number; percentage: number };
        deploysToday: { current: number; limit: number; percentage: number };
    };
}

export async function getUsageReport(userId: string): Promise<UsageReport> {
    const status = await getSubscriptionStatus(userId);
    const usage = await getCurrentUsage(userId);

    const calculatePercentage = (current: number, limit: number): number => {
        if (limit === -1) return 0; // Unlimited
        if (limit === 0) return 100;
        return Math.min(100, Math.round((current / limit) * 100));
    };

    return {
        subscription: status,
        usage: {
            servers: {
                current: usage.servers,
                limit: status.limits.servers,
                percentage: calculatePercentage(usage.servers, status.limits.servers)
            },
            apps: {
                current: usage.apps,
                limit: status.limits.apps,
                percentage: calculatePercentage(usage.apps, status.limits.apps)
            },
            domains: {
                current: usage.domains,
                limit: status.limits.domains,
                percentage: calculatePercentage(usage.domains, status.limits.domains)
            },
            deploysToday: {
                current: usage.deploysToday,
                limit: status.limits.deploysPerDay,
                percentage: calculatePercentage(usage.deploysToday, status.limits.deploysPerDay)
            }
        }
    };
}
