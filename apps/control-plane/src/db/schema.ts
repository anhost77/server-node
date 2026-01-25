import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users Table
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name'),
    email: text('email').unique(),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    role: text('role').default('user'), // 'user' | 'admin'
    mcpToken: text('mcp_token'), // Persistent MCP API token
    // Billing
    stripeCustomerId: text('stripe_customer_id'),
    billingEmail: text('billing_email'),
    billingName: text('billing_name'),
    billingCompany: text('billing_company'),
    billingAddress: text('billing_address'),
    billingCity: text('billing_city'),
    billingPostalCode: text('billing_postal_code'),
    billingCountry: text('billing_country'),
    billingVatNumber: text('billing_vat_number'),
    billingPhone: text('billing_phone'),
    // Legal Acceptance
    acceptedTermsAt: integer('accepted_terms_at'), // Unix timestamp
    acceptedPrivacyAt: integer('accepted_privacy_at'), // Unix timestamp
    waivedWithdrawalAt: integer('waived_withdrawal_at'), // Unix timestamp
    onboardingCompleted: integer('onboarding_completed').default(0), // 0 = false, 1 = true
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// OAuth Accounts
export const accounts = sqliteTable('accounts', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Sessions
export const sessions = sqliteTable('sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    expiresAt: integer('expires_at').notNull()
});

// Infrastructure Nodes (Servers)
export const nodes = sqliteTable('nodes', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    pubKey: text('pub_key').notNull(),
    hostname: text('hostname'),
    ip: text('ip'),
    os: text('os'),
    alias: text('alias'), // User-friendly name for the server
    registeredAt: integer('registered_at').default(sql`(cast(strftime('%s','now') as int))`),
    status: text('status').default('offline')
});

// Proxies (Nginx Domains)
export const proxies = sqliteTable('proxies', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    nodeId: text('node_id').references(() => nodes.id, { onDelete: 'cascade' }).notNull(),
    appId: text('app_id').references(() => apps.id, { onDelete: 'set null' }),
    domain: text('domain').notNull(),
    port: integer('port').notNull(),
    ssl: integer('ssl', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Applications
export const apps = sqliteTable('apps', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    nodeId: text('node_id').references(() => nodes.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    repoUrl: text('repo_url').notNull(),
    port: integer('port').notNull(), // Legacy: main port (kept for backwards compatibility)
    ports: text('ports'), // JSON: [{"port": 3000, "name": "web", "isMain": true}, {"port": 3001, "name": "api"}]
    detectedPorts: text('detected_ports'), // JSON: [3000, 3001, 9229] - actual ports from server
    env: text('env'), // Stored as JSON or encoded string
    status: text('status').default('stopped'),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Multi-tenant Registration Tokens (Installation tokens)
export const registrationTokens = sqliteTable('registration_tokens', {
    id: text('id').primaryKey(), // The token itself
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    expiresAt: integer('expires_at').notNull()
});

// MCP API Tokens
export const mcpTokens = sqliteTable('mcp_tokens', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    tokenHash: text('token_hash').notNull(), // bcrypt hash
    tokenPrefix: text('token_prefix').notNull(), // "sf_mcp_abc..." premiers 12 chars
    name: text('name').default('Default MCP Token'),
    lastUsedAt: integer('last_used_at'),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`),
    revokedAt: integer('revoked_at')
});

// Activity Logs
export const activityLogs = sqliteTable('activity_logs', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    nodeId: text('node_id').references(() => nodes.id, { onDelete: 'set null' }),
    type: text('type').notNull(), // 'app_deploy', 'server_connect', etc.
    status: text('status').default('info'), // 'success', 'failure', 'info'
    details: text('details'), // JSON string
    timestamp: integer('timestamp').default(sql`(cast(strftime('%s','now') as int))`)
});

// ============================================
// BILLING & MONETIZATION TABLES
// ============================================

// Subscription Plans (configurable via admin)
export const plans = sqliteTable('plans', {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // 'free', 'pro', 'enterprise'
    displayName: text('display_name').notNull(),
    description: text('description'),
    stripePriceIdMonthly: text('stripe_price_id_monthly'),
    stripePriceIdYearly: text('stripe_price_id_yearly'),
    priceMonthly: integer('price_monthly').default(0), // cents
    priceYearly: integer('price_yearly').default(0), // cents
    // Limits
    maxServers: integer('max_servers').default(1),
    maxApps: integer('max_apps').default(3),
    maxDomains: integer('max_domains').default(3),
    maxDeploysPerDay: integer('max_deploys_per_day').default(10),
    // Features (JSON array of feature flags)
    features: text('features'), // e.g., '["ssl","monitoring","priority_support"]'
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false), // Default plan for new users
    sortOrder: integer('sort_order').default(0),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// User Subscriptions
export const subscriptions = sqliteTable('subscriptions', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    planId: text('plan_id').references(() => plans.id).notNull(),
    // Stripe Data
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    // Status: 'active', 'past_due', 'canceled', 'trialing', 'incomplete', 'paused'
    status: text('status').default('active'),
    // Billing period
    currentPeriodStart: integer('current_period_start'),
    currentPeriodEnd: integer('current_period_end'),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
    canceledAt: integer('canceled_at'),
    // Trial
    trialStart: integer('trial_start'),
    trialEnd: integer('trial_end'),
    // Metadata
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`),
    updatedAt: integer('updated_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Invoice History
export const invoices = sqliteTable('invoices', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    subscriptionId: text('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    stripeInvoiceId: text('stripe_invoice_id').unique(),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    // Amount (in cents)
    amountDue: integer('amount_due'),
    amountPaid: integer('amount_paid'),
    currency: text('currency').default('eur'),
    // Status: 'draft', 'open', 'paid', 'void', 'uncollectible'
    status: text('status'),
    invoicePdfUrl: text('invoice_pdf_url'),
    hostedInvoiceUrl: text('hosted_invoice_url'),
    // Period
    periodStart: integer('period_start'),
    periodEnd: integer('period_end'),
    paidAt: integer('paid_at'),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Usage Records (daily aggregates for limit enforcement)
export const usageRecords = sqliteTable('usage_records', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    date: text('date').notNull(), // YYYY-MM-DD format
    deploysCount: integer('deploys_count').default(0),
    apiCallsCount: integer('api_calls_count').default(0),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Managed Servers (VPS provisioned for users)
export const managedServers = sqliteTable('managed_servers', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    nodeId: text('node_id').references(() => nodes.id, { onDelete: 'set null' }),
    // Provider Details
    provider: text('provider').notNull(), // 'hetzner', 'digitalocean', 'vultr'
    providerServerId: text('provider_server_id'),
    providerRegion: text('provider_region'),
    providerImage: text('provider_image'), // OS image used
    // Specs
    serverType: text('server_type'), // 'cx11', 'cpx11', 's-1vcpu-1gb', etc.
    vcpus: integer('vcpus'),
    memoryMb: integer('memory_mb'),
    diskGb: integer('disk_gb'),
    // Network
    ipAddress: text('ip_address'),
    ipv6Address: text('ipv6_address'),
    hostname: text('hostname'),
    // Status: 'provisioning', 'installing', 'running', 'stopped', 'error', 'deleted'
    status: text('status').default('provisioning'),
    statusMessage: text('status_message'),
    provisionedAt: integer('provisioned_at'),
    deletedAt: integer('deleted_at'),
    // Billing
    monthlyCostCents: integer('monthly_cost_cents'),
    lastBilledAt: integer('last_billed_at'),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// ============================================
// SUPPORT TICKET SYSTEM
// ============================================

// Support Tickets
export const supportTickets = sqliteTable('support_tickets', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    subject: text('subject').notNull(),
    category: text('category').default('general'), // 'general', 'billing', 'technical', 'feature_request', 'bug_report'
    priority: text('priority').default('normal'), // 'low', 'normal', 'high', 'urgent'
    status: text('status').default('open'), // 'open', 'pending', 'in_progress', 'resolved', 'closed'
    assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }), // Admin assigned
    lastMessageAt: integer('last_message_at'),
    resolvedAt: integer('resolved_at'),
    closedAt: integer('closed_at'),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Ticket Messages (conversation thread)
export const ticketMessages = sqliteTable('ticket_messages', {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').references(() => supportTickets.id, { onDelete: 'cascade' }).notNull(),
    senderId: text('sender_id').references(() => users.id, { onDelete: 'set null' }),
    senderType: text('sender_type').notNull(), // 'user', 'admin', 'system', 'ai'
    content: text('content').notNull(),
    isInternal: integer('is_internal', { mode: 'boolean' }).default(false), // Internal notes for admins
    readAt: integer('read_at'),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Ticket Attachments
export const ticketAttachments = sqliteTable('ticket_attachments', {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').references(() => supportTickets.id, { onDelete: 'cascade' }).notNull(),
    messageId: text('message_id').references(() => ticketMessages.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    storagePath: text('storage_path').notNull(), // Path in local storage
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});

// Canned Responses (for quick replies and auto-responses)
export const cannedResponses = sqliteTable('canned_responses', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    category: text('category'), // Match ticket categories
    keywords: text('keywords'), // Comma-separated keywords for auto-matching
    isAutoResponse: integer('is_auto_response', { mode: 'boolean' }).default(false),
    sortOrder: integer('sort_order').default(0),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').default(sql`(cast(strftime('%s','now') as int))`)
});
