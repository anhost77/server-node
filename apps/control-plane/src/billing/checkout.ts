import Stripe from 'stripe';
import { stripe, getOrCreateCustomer } from './stripe.js';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface CheckoutOptions {
    userId: string;
    email: string;
    name?: string;
    planId: string;
    billingInterval: 'month' | 'year';
    successUrl: string;
    cancelUrl: string;
}

export async function createCheckoutSession(options: CheckoutOptions): Promise<Stripe.Checkout.Session | null> {
    if (!stripe) {
        throw new Error('Stripe is not configured');
    }

    // Get plan details
    const plan = await db.select().from(schema.plans).where(eq(schema.plans.id, options.planId)).get();
    if (!plan) {
        throw new Error('Plan not found');
    }

    // Get the appropriate price ID based on billing interval
    const priceId = options.billingInterval === 'year'
        ? plan.stripePriceIdYearly
        : plan.stripePriceIdMonthly;

    if (!priceId) {
        throw new Error('Plan does not have a Stripe price configured');
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(options.userId, options.email, options.name);
    if (!customerId) {
        throw new Error('Failed to get or create Stripe customer');
    }

    // Update user with Stripe customer ID
    await db.update(schema.users)
        .set({ stripeCustomerId: customerId })
        .where(eq(schema.users.id, options.userId))
        .run();

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1
            }
        ],
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        metadata: {
            userId: options.userId,
            planId: options.planId
        },
        subscription_data: {
            metadata: {
                userId: options.userId,
                planId: options.planId
            }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        customer_update: {
            address: 'auto',
            name: 'auto'
        }
    });

    return session;
}

export async function createPortalSession(
    customerId: string,
    returnUrl: string
): Promise<Stripe.BillingPortal.Session | null> {
    if (!stripe) {
        throw new Error('Stripe is not configured');
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
    });

    return session;
}

export async function getSubscriptionDetails(subscriptionId: string): Promise<Stripe.Subscription | null> {
    if (!stripe) return null;
    return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
): Promise<Stripe.Subscription | null> {
    if (!stripe) return null;

    if (immediately) {
        return await stripe.subscriptions.cancel(subscriptionId);
    }

    return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
    });
}
