import Stripe from 'stripe';
import { stripe } from './stripe.js';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event | null {
    if (!stripe || !webhookSecret) return null;

    try {
        return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return null;
    }
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
    console.log(`📥 Stripe webhook: ${event.type}`);

    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
            break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
            break;

        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
            break;

        case 'invoice.paid':
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;

        case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
            break;

        case 'customer.subscription.trial_will_end':
            await handleTrialWillEnd(event.data.object as Stripe.Subscription);
            break;

        default:
            console.log(`Unhandled webhook event: ${event.type}`);
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    if (!userId || !planId) {
        console.error('Checkout session missing userId or planId metadata');
        return;
    }

    console.log(`✅ Checkout completed for user ${userId}, plan ${planId}`);

    // The subscription will be created via the subscription.created webhook
    // Update user's stripe customer ID if needed
    if (session.customer) {
        await db.update(schema.users)
            .set({ stripeCustomerId: session.customer as string })
            .where(eq(schema.users.id, userId))
            .run();
    }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    const planId = subscription.metadata?.planId;

    if (!userId) {
        console.error('Subscription missing userId metadata');
        return;
    }

    console.log(`📝 Subscription update for user ${userId}: ${subscription.status}`);

    // Check if subscription exists
    const existingSub = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.stripeSubscriptionId, subscription.id))
        .get();

    // Cast to any to access snake_case properties from Stripe API
    const sub = subscription as any;
    const subscriptionData = {
        planId: planId || existingSub?.planId || 'free',
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        status: subscription.status,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at || undefined,
        trialStart: sub.trial_start || undefined,
        trialEnd: sub.trial_end || undefined,
        updatedAt: Math.floor(Date.now() / 1000)
    };

    if (existingSub) {
        // Update existing subscription
        await db.update(schema.subscriptions)
            .set(subscriptionData)
            .where(eq(schema.subscriptions.id, existingSub.id))
            .run();
    } else {
        // Create new subscription record
        await db.insert(schema.subscriptions).values({
            id: randomUUID(),
            userId,
            ...subscriptionData
        }).run();
    }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    console.log(`🗑️ Subscription deleted: ${subscription.id}`);

    await db.update(schema.subscriptions)
        .set({
            status: 'canceled',
            canceledAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000)
        })
        .where(eq(schema.subscriptions.stripeSubscriptionId, subscription.id))
        .run();
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Cast to any to access snake_case properties
    const inv = invoice as any;
    if (!inv.subscription) return;

    const subscription = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.stripeSubscriptionId, inv.subscription as string))
        .get();

    if (!subscription) return;

    console.log(`💰 Invoice paid: ${invoice.id} for user ${subscription.userId}`);

    // Record invoice
    await db.insert(schema.invoices).values({
        id: randomUUID(),
        userId: subscription.userId,
        subscriptionId: subscription.id,
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: inv.payment_intent as string || undefined,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status || 'paid',
        invoicePdfUrl: invoice.invoice_pdf || undefined,
        hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
        paidAt: Math.floor(Date.now() / 1000)
    }).run();

    // Update subscription status to active if it was past_due
    if (subscription.status === 'past_due') {
        await db.update(schema.subscriptions)
            .set({ status: 'active', updatedAt: Math.floor(Date.now() / 1000) })
            .where(eq(schema.subscriptions.id, subscription.id))
            .run();
    }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Cast to any to access snake_case properties
    const inv = invoice as any;
    if (!inv.subscription) return;

    const subscription = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.stripeSubscriptionId, inv.subscription as string))
        .get();

    if (!subscription) return;

    console.log(`⚠️ Invoice payment failed for user ${subscription.userId}`);

    // Update subscription status
    await db.update(schema.subscriptions)
        .set({ status: 'past_due', updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.subscriptions.id, subscription.id))
        .run();

    // TODO: Send notification email to user
}

async function handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    console.log(`⏰ Trial ending soon for user ${userId}`);
    // TODO: Send reminder email to user
}
