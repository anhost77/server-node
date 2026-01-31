import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export interface SubscriptionWithPlan {
    subscription: typeof schema.subscriptions.$inferSelect | null;
    plan: typeof schema.plans.$inferSelect;
}

// Get user's active subscription with plan details
export async function getUserSubscription(userId: string): Promise<SubscriptionWithPlan> {
    // First try to get active subscription
    const subscription = await db.select()
        .from(schema.subscriptions)
        .where(and(
            eq(schema.subscriptions.userId, userId),
            eq(schema.subscriptions.status, 'active')
        ))
        .get();

    if (subscription) {
        const plan = await db.select()
            .from(schema.plans)
            .where(eq(schema.plans.id, subscription.planId))
            .get();

        if (plan) {
            return { subscription, plan };
        }
    }

    // Fallback to default (free) plan
    let freePlan = await db.select()
        .from(schema.plans)
        .where(eq(schema.plans.isDefault, true))
        .get();

    // If no default plan, get the first free plan
    if (!freePlan) {
        freePlan = await db.select()
            .from(schema.plans)
            .where(eq(schema.plans.priceMonthly, 0))
            .get();
    }

    // If still no plan, create a basic free plan
    if (!freePlan) {
        freePlan = await createDefaultFreePlan();
    }

    return { subscription: null, plan: freePlan };
}

/**
 * Features disponibles pour les plans de pricing.
 * Ces clés correspondent aux traductions dans les fichiers i18n du site de vente.
 * Voir: apps/sales-website/src/i18n/{lang}.json -> pricingPage.featureKeys
 */
const FREE_PLAN_FEATURES = ['ssl_auto', 'github_integration', 'support_community'];
const PRO_PLAN_FEATURES = ['mcp_integration', 'hot_patch', 'services_25plus', 'support_priority'];

// Create default free plan if it doesn't exist
export async function createDefaultFreePlan(): Promise<typeof schema.plans.$inferSelect> {
    const id = 'free';
    const existing = await db.select().from(schema.plans).where(eq(schema.plans.id, id)).get();

    if (existing) {
        // Mettre à jour les features si elles sont anciennes
        const currentFeatures = existing.features ? JSON.parse(existing.features) : [];
        if (!currentFeatures.includes('ssl_auto')) {
            await db.update(schema.plans)
                .set({ features: JSON.stringify(FREE_PLAN_FEATURES) })
                .where(eq(schema.plans.id, id))
                .run();
            return (await db.select().from(schema.plans).where(eq(schema.plans.id, id)).get())!;
        }
        return existing;
    }

    await db.insert(schema.plans).values({
        id,
        name: 'free',
        displayName: 'Free',
        description: 'Get started with basic features',
        priceMonthly: 0,
        priceYearly: 0,
        maxServers: 1,
        maxApps: 3,
        maxDomains: 3,
        maxDeploysPerDay: 10,
        features: JSON.stringify(FREE_PLAN_FEATURES),
        isActive: true,
        isDefault: true,
        sortOrder: 0
    }).run();

    return (await db.select().from(schema.plans).where(eq(schema.plans.id, id)).get())!;
}

// Create default pro plan if it doesn't exist
export async function createDefaultProPlan(): Promise<typeof schema.plans.$inferSelect> {
    const id = 'pro';
    const existing = await db.select().from(schema.plans).where(eq(schema.plans.id, id)).get();

    if (existing) {
        // Mettre à jour les features si elles sont anciennes
        const currentFeatures = existing.features ? JSON.parse(existing.features) : [];
        if (!currentFeatures.includes('mcp_integration')) {
            await db.update(schema.plans)
                .set({ features: JSON.stringify(PRO_PLAN_FEATURES) })
                .where(eq(schema.plans.id, id))
                .run();
            return (await db.select().from(schema.plans).where(eq(schema.plans.id, id)).get())!;
        }
        return existing;
    }

    await db.insert(schema.plans).values({
        id,
        name: 'pro',
        displayName: 'Pro',
        description: 'For serious builders and small teams',
        priceMonthly: 900, // 9€ en centimes
        priceYearly: 8400, // 84€/an (7€/mois) en centimes
        maxServers: 5,
        maxApps: -1, // Illimité
        maxDomains: -1, // Illimité
        maxDeploysPerDay: -1, // Illimité
        features: JSON.stringify(PRO_PLAN_FEATURES),
        isActive: true,
        isDefault: false,
        sortOrder: 1
    }).run();

    return (await db.select().from(schema.plans).where(eq(schema.plans.id, id)).get())!;
}

// Manually assign subscription (for admin)
export async function assignSubscription(
    userId: string,
    planId: string,
    options?: {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        periodEnd?: number;
        status?: string;
    }
): Promise<typeof schema.subscriptions.$inferSelect> {
    // Cancel any existing active subscriptions
    await db.update(schema.subscriptions)
        .set({ status: 'canceled', canceledAt: Math.floor(Date.now() / 1000) })
        .where(and(
            eq(schema.subscriptions.userId, userId),
            eq(schema.subscriptions.status, 'active')
        ))
        .run();

    const now = Math.floor(Date.now() / 1000);
    const id = randomUUID();

    await db.insert(schema.subscriptions).values({
        id,
        userId,
        planId,
        stripeCustomerId: options?.stripeCustomerId,
        stripeSubscriptionId: options?.stripeSubscriptionId,
        status: options?.status || 'active',
        currentPeriodStart: now,
        currentPeriodEnd: options?.periodEnd || (now + 30 * 24 * 60 * 60), // 30 days default
        createdAt: now,
        updatedAt: now
    }).run();

    return (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).get())!;
}

// Get all plans (for pricing page)
export async function getActivePlans(): Promise<(typeof schema.plans.$inferSelect)[]> {
    return await db.select()
        .from(schema.plans)
        .where(eq(schema.plans.isActive, true))
        .orderBy(schema.plans.sortOrder)
        .all();
}

// Check if user has a paid subscription
export async function hasPaidSubscription(userId: string): Promise<boolean> {
    const { subscription, plan } = await getUserSubscription(userId);
    return subscription !== null && (plan.priceMonthly || 0) > 0;
}

// Get subscription status summary
export interface SubscriptionStatus {
    isActive: boolean;
    isPaid: boolean;
    isTrial: boolean;
    isPastDue: boolean;
    planName: string;
    planDisplayName: string;
    expiresAt: number | null;
    limits: {
        servers: number;
        apps: number;
        domains: number;
        deploysPerDay: number;
    };
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    const { subscription, plan } = await getUserSubscription(userId);

    const now = Math.floor(Date.now() / 1000);
    const isTrial = subscription?.trialEnd ? subscription.trialEnd > now : false;

    return {
        isActive: subscription?.status === 'active' || subscription?.status === 'trialing' || (plan.priceMonthly || 0) === 0,
        isPaid: (plan.priceMonthly || 0) > 0,
        isTrial,
        isPastDue: subscription?.status === 'past_due',
        planName: plan.name,
        planDisplayName: plan.displayName,
        expiresAt: subscription?.currentPeriodEnd || null,
        limits: {
            servers: plan.maxServers || 1,
            apps: plan.maxApps || 3,
            domains: plan.maxDomains || 3,
            deploysPerDay: plan.maxDeploysPerDay || 10
        }
    };
}
