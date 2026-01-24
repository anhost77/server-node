import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users Table
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name'),
    email: text('email').unique(),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    role: text('role').default('user'),
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
    port: integer('port').notNull(),
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
