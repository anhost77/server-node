import Stripe from 'stripe';

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' })
    : null;

export function isStripeConfigured(): boolean {
    return !!stripe;
}

export function isTestMode(): boolean {
    return process.env.STRIPE_MODE !== 'live';
}

export function getPublishableKey(): string | undefined {
    return process.env.STRIPE_PUBLISHABLE_KEY;
}

// Helper to format amount for display
export function formatAmount(amountCents: number, currency: string = 'eur'): string {
    const amount = amountCents / 100;
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount);
}

// Helper to get or create Stripe customer
export async function getOrCreateCustomer(
    userId: string,
    email: string,
    name?: string
): Promise<string | null> {
    if (!stripe) return null;

    // Search for existing customer by metadata
    const existingCustomers = await stripe.customers.list({
        email,
        limit: 1
    });

    if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id;
    }

    // Create new customer
    const customer = await stripe.customers.create({
        email,
        name: name || undefined,
        metadata: {
            userId
        }
    });

    return customer.id;
}
