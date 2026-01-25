import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHmac, timingSafeEqual, verify as cryptoVerify } from 'node:crypto';
import { config } from 'dotenv';

// Get local network IP address (for SSH installation)
function getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { sshManager, type SSHCredentials } from './ssh/SSHSessionManager.js';
import { eq, and, or, sql, desc } from 'drizzle-orm';
// Billing imports
import {
    stripe,
    isStripeConfigured,
    getPublishableKey,
    formatAmount,
    createCheckoutSession,
    createPortalSession,
    verifyWebhookSignature,
    handleWebhookEvent,
    getUserSubscription,
    getActivePlans,
    assignSubscription,
    getSubscriptionStatus,
    checkUsageLimit,
    incrementUsage,
    getUsageReport,
    createDefaultFreePlan
} from './billing/index.js';
// VPS Providers imports
import {
    getProviderStatuses,
    getAllPlans as getVPSPlans,
    getAllRegions as getVPSRegions,
    provisionServer,
    deleteProvisionedServer,
    getServerStatus,
    type Provider
} from './providers/index.js';
import cookie from '@fastify/cookie';
import bcrypt from 'bcryptjs';
// Security imports
import {
    verifyEd25519,
    getKeyFingerprint,
    getCPPublicKey,
    getCPKeyCreatedAt,
    rotateCPKeys,
    createSignedCommand,
    SIGNED_COMMAND_TYPES
} from './security/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

config({ path: path.join(__dirname, '../.env') });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const fastify = Fastify({ logger: true });
fastify.register(cors, { origin: true, credentials: true });
fastify.register(cookie);
fastify.register(staticFiles, { root: path.join(__dirname, '../public'), prefix: '/' });
fastify.register(websocket);
fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
        files: 5 // Max 5 files per request
    }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/tickets');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Raw body parser for Stripe webhooks
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
        // Store raw body for webhook signature verification
        (req as any).rawBody = body;
        const json = JSON.parse(body as string);
        done(null, json);
    } catch (err: any) {
        done(err, undefined);
    }
});

// Multi-tenant Authentication Middleware
import { createHash, randomBytes } from 'crypto';

// Simple hash function (for MVP - could use bcrypt in prod)
function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

fastify.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/auth') && req.url !== '/api/auth/me') return;
    if (req.url.startsWith('/api/connect')) return;
    if (req.url.startsWith('/api/servers/verify-token')) return;
    if (req.url.startsWith('/api/webhooks')) return; // Webhooks have their own auth
    // Allow /mcp endpoint but require auth, skip other non-api routes
    if (req.url === '/' || (!req.url.startsWith('/api') && !req.url.startsWith('/mcp'))) return;

    // MCP Token Authentication (for AI agents)
    // Support both x-mcp-token header and Authorization: Bearer
    let mcpToken = req.headers['x-mcp-token'] as string;
    if (!mcpToken) {
        const authHeader = req.headers['authorization'] as string;
        if (authHeader?.startsWith('Bearer sf_mcp_')) {
            mcpToken = authHeader.slice(7); // Remove "Bearer "
        }
    }
    if (mcpToken?.startsWith('sf_mcp_')) {
        const tokenPrefix = mcpToken.slice(0, 15);
        const storedToken = await db.select()
            .from(schema.mcpTokens)
            .where(and(
                eq(schema.mcpTokens.tokenPrefix, tokenPrefix),
                sql`${schema.mcpTokens.revokedAt} IS NULL`
            )).get();

        if (storedToken) {
            const tokenHash = hashToken(mcpToken);
            if (tokenHash === storedToken.tokenHash) {
                // Update last used (async)
                db.update(schema.mcpTokens)
                    .set({ lastUsedAt: Math.floor(Date.now() / 1000) })
                    .where(eq(schema.mcpTokens.id, storedToken.id))
                    .run();
                (req as any).userId = storedToken.userId;
                return;
            }
        }
        return reply.status(401).send({ error: 'Invalid MCP token' });
    }

    const sessionId = req.cookies.session_id;
    if (!sessionId) return reply.status(401).send({ error: 'Not authenticated' });

    const session = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)).get();
    if (!session || session.expiresAt < Date.now()) return reply.status(401).send({ error: 'Session expired' });

    (req as any).userId = session.userId;
});

// Real-time State
interface AgentSession { pubKey: string; nodeId: string; socket: any; authorized: boolean; nonce?: string; version?: string; }
const agentSessions = new Map<string, AgentSession>();

// Get current agent bundle version from package.json
function getAgentBundleVersion(): string {
    try {
        const pkgPath = path.join(__dirname, '../../agent/package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            return pkg.version || '0.0.0';
        }
    } catch { }
    return '0.0.0';
}
const AGENT_BUNDLE_VERSION = getAgentBundleVersion();
const dashboardSessions = new Map<string, Set<any>>(); // Map userId -> Set of sockets
const serverMetricsCache = new Map<string, { cpu: number; ram: number; disk: number; ip?: string; updatedAt: number }>(); // nodeId -> metrics
const pendingLogRequests = new Map<string, { resolve: (logs: string) => void; timeout: NodeJS.Timeout }>(); // requestId -> resolver

// GDPR-compliant log sanitization - redacts sensitive data
function sanitizeLogs(logs: string): string {
    return logs
        // Email addresses
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
        // IPv4 addresses (keep first octet for debugging)
        .replace(/\b(\d{1,3})\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '$1.xxx.xxx.xxx')
        // IPv6 addresses
        .replace(/([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g, '[IPv6_REDACTED]')
        // API keys and tokens (common patterns)
        .replace(/(['":]?\s*)(sk_live_[a-zA-Z0-9]+)/gi, '$1[API_KEY_REDACTED]')
        .replace(/(['":]?\s*)(sk_test_[a-zA-Z0-9]+)/gi, '$1[API_KEY_REDACTED]')
        .replace(/(['":]?\s*)(pk_live_[a-zA-Z0-9]+)/gi, '$1[API_KEY_REDACTED]')
        .replace(/(['":]?\s*)(pk_test_[a-zA-Z0-9]+)/gi, '$1[API_KEY_REDACTED]')
        .replace(/(api[_-]?key|apikey|api_secret|secret_key|access_token|auth_token|bearer)\s*[=:]\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?/gi, '$1=[REDACTED]')
        // Authorization headers
        .replace(/(Authorization:\s*Bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[TOKEN_REDACTED]')
        .replace(/(Authorization:\s*Basic\s+)[a-zA-Z0-9+/=]+/gi, '$1[CREDENTIALS_REDACTED]')
        // Passwords in URLs or params
        .replace(/(password|passwd|pwd|secret)\s*[=:]\s*['"]?[^'"\s&]+['"]?/gi, '$1=[REDACTED]')
        // Session IDs and cookies
        .replace(/(session_id|sessionid|sid|cookie)\s*[=:]\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?/gi, '$1=[REDACTED]')
        // Credit card numbers (basic pattern)
        .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD_REDACTED]')
        // French phone numbers
        .replace(/\b0[1-9](\s?\d{2}){4}\b/g, '[PHONE_REDACTED]')
        // Social security numbers (French format)
        .replace(/\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g, '[SSN_REDACTED]');
}

function broadcastToUser(userId: string, msg: any) {
    const sessions = dashboardSessions.get(userId);
    if (!sessions) return;
    const payload = JSON.stringify(msg);
    sessions.forEach(socket => { if (socket.readyState === 1) socket.send(payload); });
}

function broadcastToDashboards(msg: any) {
    const payload = JSON.stringify(msg);
    dashboardSessions.forEach(sessions => {
        sessions.forEach(socket => { if (socket.readyState === 1) socket.send(payload); });
    });
}

async function sendToAgentById(nodeId: string, msg: any, userId: string) {
    const node = await db.select().from(schema.nodes).where(and(eq(schema.nodes.id, nodeId), eq(schema.nodes.ownerId, userId))).get();
    if (!node) return false;

    let sent = false;
    agentSessions.forEach(session => {
        if (session.authorized && session.nodeId === node.id) {
            // Sign commands that require signature
            if (SIGNED_COMMAND_TYPES.includes(msg.type)) {
                const { type, ...payload } = msg;
                const signedCmd = createSignedCommand(type, payload);
                session.socket.send(JSON.stringify(signedCmd));
            } else {
                session.socket.send(JSON.stringify(msg));
            }
            sent = true;
        }
    });
    return sent;
}

// Activity Logging
async function addActivityLog(ownerId: string, type: string, details: any, nodeId?: string, status: 'success' | 'failure' | 'info' = 'info') {
    const entry = {
        id: randomUUID(),
        ownerId,
        nodeId,
        type,
        status,
        details: JSON.stringify(details),
        timestamp: Date.now()
    };
    await db.insert(schema.activityLogs).values(entry).run();
    broadcastToDashboards({ type: 'AUDIT_UPDATE', log: { ...entry, details } });
}

// APIs
fastify.get('/api/audit/logs', async (req) => {
    const userId = (req as any).userId;
    const logs = await db.select().from(schema.activityLogs).where(eq(schema.activityLogs.ownerId, userId)).all();
    return logs.map(l => ({ ...l, details: JSON.parse(l.details || '{}') }));
});

fastify.get('/api/internal/servers', async (req) => {
    const userId = (req as any).userId;
    const userNodes = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
    return userNodes.map(n => {
        const active = Array.from(agentSessions.values()).find(sess => sess.nodeId === n.id && sess.authorized);
        return { ...n, status: active ? 'online' : 'offline' };
    });
});

// ==================== MCP Token Management ====================

// Generate new MCP token
fastify.post('/api/mcp-tokens', async (req) => {
    const userId = (req as any).userId;
    const body = (req.body || {}) as any;

    // Generate raw token (visible only once)
    const rawToken = `sf_mcp_${randomBytes(32).toString('hex')}`;
    const tokenPrefix = rawToken.slice(0, 15);
    const tokenHash = hashToken(rawToken);

    const tokenId = randomUUID();
    await db.insert(schema.mcpTokens).values({
        id: tokenId,
        userId,
        tokenHash,
        tokenPrefix,
        name: body.name || 'Default MCP Token',
        createdAt: Math.floor(Date.now() / 1000)
    }).run();

    addActivityLog(userId, 'mcp_token_created', { name: body.name || 'Default' }, undefined, 'info');

    return {
        token: rawToken, // Shown ONLY ONCE
        id: tokenId,
        prefix: tokenPrefix,
        name: body.name || 'Default MCP Token',
        created_at: Math.floor(Date.now() / 1000)
    };
});

// List MCP tokens (masked)
fastify.get('/api/mcp-tokens', async (req) => {
    const userId = (req as any).userId;
    const tokens = await db.select({
        id: schema.mcpTokens.id,
        name: schema.mcpTokens.name,
        prefix: schema.mcpTokens.tokenPrefix,
        lastUsedAt: schema.mcpTokens.lastUsedAt,
        createdAt: schema.mcpTokens.createdAt
    }).from(schema.mcpTokens)
      .where(and(
          eq(schema.mcpTokens.userId, userId),
          sql`${schema.mcpTokens.revokedAt} IS NULL`
      )).all();

    return { tokens };
});

// Revoke MCP token
fastify.delete('/api/mcp-tokens/:id', async (req) => {
    const userId = (req as any).userId;
    const { id } = req.params as any;

    await db.update(schema.mcpTokens)
        .set({ revokedAt: Math.floor(Date.now() / 1000) })
        .where(and(
            eq(schema.mcpTokens.id, id),
            eq(schema.mcpTokens.userId, userId)
        )).run();

    addActivityLog(userId, 'mcp_token_revoked', { tokenId: id }, undefined, 'info');
    return { success: true };
});

// ==================== MCP HTTP Endpoint ====================
// This allows Claude Desktop/Cursor to connect via HTTP instead of local process

const MCP_TOOLS = [
    {
        name: "list_servers",
        description: "List all registered servers and their connection status",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "list_apps",
        description: "List all registered applications",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "deploy_app",
        description: "Trigger a deployment for a specific application by name or ID",
        inputSchema: {
            type: "object",
            properties: {
                appName: { type: "string", description: "The application name or ID" },
                commitHash: { type: "string", description: "Git commit/branch/tag to deploy (default: main)" },
                dryRun: { type: "boolean", description: "If true, only simulate the deployment" }
            },
            required: ["appName"],
        },
    },
    {
        name: "app_action",
        description: "Perform an action on an application (start, stop, restart)",
        inputSchema: {
            type: "object",
            properties: {
                appName: { type: "string", description: "The application name or ID" },
                action: { type: "string", enum: ["start", "stop", "restart"], description: "The action to perform" },
                dryRun: { type: "boolean", description: "If true, only simulate the action" }
            },
            required: ["appName", "action"],
        },
    },
    {
        name: "get_activity_logs",
        description: "Get recent activity logs from the system",
        inputSchema: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Maximum number of logs to return (default: 20)" }
            },
        },
    },
    {
        name: "provision_domain",
        description: "Setup a domain/subdomain to point to an application port (creates nginx reverse proxy with SSL)",
        inputSchema: {
            type: "object",
            properties: {
                domain: { type: "string", description: "The domain name (e.g., api.example.com)" },
                port: { type: "number", description: "The port to proxy to (e.g., 3000)" },
                serverId: { type: "string", description: "The server ID (optional if only one server)" },
                appName: { type: "string", description: "The app name to associate (optional)" }
            },
            required: ["domain", "port"],
        },
    },
    {
        name: "list_domains",
        description: "List all configured domain proxies",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "get_server_metrics",
        description: "Get real-time CPU, RAM, disk usage for a server",
        inputSchema: {
            type: "object",
            properties: {
                serverId: { type: "string", description: "Server ID (optional if only one server)" }
            },
        },
    },
    {
        name: "check_app_health",
        description: "Test if an app responds correctly (HTTP health check)",
        inputSchema: {
            type: "object",
            properties: {
                appName: { type: "string", description: "The app name to check" },
                endpoint: { type: "string", description: "Health endpoint path (default: /health)" }
            },
            required: ["appName"],
        },
    },
    {
        name: "get_deployment_history",
        description: "List recent deployments with success/failure status",
        inputSchema: {
            type: "object",
            properties: {
                appName: { type: "string", description: "Filter by app name (optional)" },
                limit: { type: "number", description: "Max results (default: 10)" }
            },
        },
    },
    {
        name: "get_server_logs",
        description: "Read recent server logs (nginx, pm2, app). Sensitive data (passwords, tokens, emails, IPs) is automatically redacted for GDPR compliance.",
        inputSchema: {
            type: "object",
            properties: {
                logType: { type: "string", enum: ["nginx-access", "nginx-error", "pm2", "system"], description: "Type of logs to retrieve" },
                lines: { type: "number", description: "Number of lines (default: 50, max: 100)" },
                filter: { type: "string", description: "Optional grep filter pattern" },
                serverId: { type: "string", description: "Server ID (optional if only one server)" }
            },
            required: ["logType"],
        },
    },
    {
        name: "service_action",
        description: "Control system services (nginx, pm2). Actions: start, stop, restart.",
        inputSchema: {
            type: "object",
            properties: {
                service: { type: "string", enum: ["nginx", "pm2"], description: "The service to control" },
                action: { type: "string", enum: ["start", "stop", "restart"], description: "The action to perform" },
                serverId: { type: "string", description: "Server ID (optional if only one server)" }
            },
            required: ["service", "action"],
        },
    },
    {
        name: "get_security_status",
        description: "Get security and system status: firewall, failed services, load average, installed tools",
        inputSchema: {
            type: "object",
            properties: {
                serverId: { type: "string", description: "Server ID (optional if only one server)" }
            },
        },
    },
    {
        name: "install_server_extras",
        description: "Install optional monitoring/security tools on the server (ufw, fail2ban, htop, iotop, ncdu)",
        inputSchema: {
            type: "object",
            properties: {
                serverId: { type: "string", description: "Server ID (optional if only one server)" }
            },
        },
    },
    {
        name: "set_server_alias",
        description: "Set a user-friendly alias/name for a server",
        inputSchema: {
            type: "object",
            properties: {
                serverId: { type: "string", description: "Server ID to update" },
                alias: { type: "string", description: "The alias to set (leave empty to remove)" }
            },
            required: ["serverId"],
        },
    },
];

async function handleMcpToolCall(userId: string, toolName: string, args: any) {
    switch (toolName) {
        case "list_servers": {
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            // Check real-time status via agentSessions (same as dashboard)
            const serversWithStatus = servers.map(s => {
                const active = Array.from(agentSessions.values()).find(sess => sess.nodeId === s.id && sess.authorized);
                return {
                    id: s.id,
                    shortId: s.id.slice(0, 12),
                    alias: s.alias || null,
                    displayName: s.alias || s.hostname || s.id.slice(0, 12),
                    hostname: s.hostname,
                    ip: s.ip,
                    status: active ? 'online' : 'offline',
                    registeredAt: s.registeredAt
                };
            });
            return {
                content: [{ type: "text", text: `Found ${servers.length} server(s):\n${JSON.stringify(serversWithStatus, null, 2)}` }],
            };
        }

        case "list_apps": {
            const apps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
            return {
                content: [{ type: "text", text: `Found ${apps.length} app(s):\n${JSON.stringify(apps.map(a => ({
                    id: a.id,
                    name: a.name,
                    nodeId: a.nodeId?.slice(0, 12),
                    port: a.port,
                    repoUrl: a.repoUrl
                })), null, 2)}` }],
            };
        }

        case "deploy_app": {
            const { appName, commitHash = 'main', dryRun = false } = args;
            const apps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
            const app = apps.find((a: any) =>
                a.name?.toLowerCase() === appName?.toLowerCase() ||
                a.id === appName ||
                a.id?.startsWith(appName)
            );

            if (!app) {
                return { content: [{ type: "text", text: `App not found: ${appName}` }], isError: true };
            }

            // Check deploy limit
            const limitCheck = await checkUsageLimit(userId, 'deploy');
            if (!limitCheck.allowed && !dryRun) {
                return { content: [{ type: "text", text: `Daily deploy limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.` }], isError: true };
            }

            if (dryRun) {
                return {
                    content: [{ type: "text", text: `[DRY RUN] Would deploy "${app.name}" from ${app.repoUrl} @ ${commitHash}` }],
                };
            }

            // Trigger actual deployment via WebSocket to agent
            const sent = await sendToAgentById(app.nodeId, { type: 'DEPLOY', appId: app.id, commitHash }, userId);
            if (sent) {
                // Increment deploy counter
                await incrementUsage(userId, 'deploy');
                return {
                    content: [{ type: "text", text: `Deployment triggered for "${app.name}" @ ${commitHash}` }],
                };
            }
            return { content: [{ type: "text", text: `Node offline for app "${app.name}"` }], isError: true };
        }

        case "app_action": {
            const { appName, action, dryRun = false } = args;
            const apps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
            const app = apps.find((a: any) =>
                a.name?.toLowerCase() === appName?.toLowerCase() ||
                a.id === appName
            );

            if (!app) {
                return { content: [{ type: "text", text: `App not found: ${appName}` }], isError: true };
            }

            if (dryRun) {
                return {
                    content: [{ type: "text", text: `[DRY RUN] Would ${action} app "${app.name}"` }],
                };
            }

            const sent = await sendToAgentById(app.nodeId, { type: 'APP_ACTION', appId: app.id, action }, userId);
            if (sent) {
                return {
                    content: [{ type: "text", text: `Action "${action}" triggered for "${app.name}"` }],
                };
            }
            return { content: [{ type: "text", text: `Node offline for app "${app.name}"` }], isError: true };
        }

        case "get_activity_logs": {
            const { limit = 20 } = args;
            const logs = await db.select().from(schema.activityLogs)
                .where(eq(schema.activityLogs.ownerId, userId))
                .orderBy(sql`${schema.activityLogs.timestamp} DESC`)
                .limit(limit)
                .all();
            return {
                content: [{ type: "text", text: `Last ${logs.length} activity logs:\n${JSON.stringify(logs.map(l => ({
                    time: new Date((l.timestamp || 0) * 1000).toISOString(),
                    type: l.type,
                    status: l.status,
                    details: l.details ? JSON.parse(l.details) : null
                })), null, 2)}` }],
            };
        }

        case "provision_domain": {
            const { domain, port, serverId, appName } = args;

            // Find server - use provided serverId or pick the first online one
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            let targetServer = serverId
                ? servers.find(s => s.id === serverId || s.id.startsWith(serverId))
                : servers[0];

            if (!targetServer) {
                return { content: [{ type: "text", text: `No server found. Register a server first.` }], isError: true };
            }

            // Check if server is online
            const active = Array.from(agentSessions.values()).find(sess => sess.nodeId === targetServer!.id && sess.authorized);
            if (!active) {
                return { content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} is offline. Cannot provision domain.` }], isError: true };
            }

            // Check if domain already exists (update) or new (check limit)
            const existingDomain = await db.select().from(schema.proxies).where(and(eq(schema.proxies.nodeId, targetServer.id), eq(schema.proxies.domain, domain))).get();
            if (!existingDomain) {
                // Check domain limit for new domains only
                const limitCheck = await checkUsageLimit(userId, 'domain');
                if (!limitCheck.allowed) {
                    return { content: [{ type: "text", text: `Domain limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan to add more domains.` }], isError: true };
                }
            }

            // Find app if appName provided
            let appId: string | undefined;
            if (appName) {
                const apps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
                const app = apps.find(a => a.name?.toLowerCase() === appName.toLowerCase() || a.id === appName);
                appId = app?.id;
            }

            // Send provision command to agent
            const sent = await sendToAgentById(targetServer.id, {
                type: 'PROVISION_DOMAIN',
                serverId: targetServer.id,
                domain,
                port,
                appId
            }, userId);

            if (sent) {
                // Save to database
                const existing = await db.select().from(schema.proxies).where(and(eq(schema.proxies.nodeId, targetServer.id), eq(schema.proxies.domain, domain))).get();
                if (existing) {
                    await db.update(schema.proxies).set({ port, appId }).where(eq(schema.proxies.id, existing.id)).run();
                } else {
                    await db.insert(schema.proxies).values({ id: randomUUID(), ownerId: userId, nodeId: targetServer.id, appId, domain, port }).run();
                }
                addActivityLog(userId, 'domain_provisioned', { domain, port }, targetServer.id, 'success');
                return {
                    content: [{ type: "text", text: `Domain "${domain}" configured to proxy to port ${port} on server ${targetServer.id.slice(0, 12)}. SSL certificate will be provisioned automatically.` }],
                };
            }
            return { content: [{ type: "text", text: `Failed to send command to server` }], isError: true };
        }

        case "list_domains": {
            const proxies = await db.select().from(schema.proxies).where(eq(schema.proxies.ownerId, userId)).all();
            return {
                content: [{ type: "text", text: `Found ${proxies.length} domain(s):\n${JSON.stringify(proxies.map(p => ({
                    domain: p.domain,
                    port: p.port,
                    serverId: p.nodeId?.slice(0, 12),
                    appId: p.appId?.slice(0, 12)
                })), null, 2)}` }],
            };
        }

        case "get_server_metrics": {
            const { serverId } = args;
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            const targetServer = serverId
                ? servers.find(s => s.id === serverId || s.id.startsWith(serverId))
                : servers[0];

            if (!targetServer) {
                return { content: [{ type: "text", text: `No server found.` }], isError: true };
            }

            // Check if server is online
            const session = Array.from(agentSessions.values()).find(sess => sess.nodeId === targetServer.id && sess.authorized);
            if (!session) {
                return { content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} is offline.` }], isError: true };
            }

            // Get cached metrics
            const metrics = serverMetricsCache.get(targetServer.id);
            if (!metrics) {
                return {
                    content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} is online but no metrics available yet. Wait a few seconds for the agent to report.` }],
                };
            }

            const ageSeconds = Math.round((Date.now() - metrics.updatedAt) / 1000);
            const ipLine = metrics.ip ? `\n- IP: ${metrics.ip}` : '';
            return {
                content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} metrics (${ageSeconds}s ago):${ipLine}\n- CPU: ${metrics.cpu}%\n- RAM: ${metrics.ram}%\n- Disk: ${metrics.disk}%` }],
            };
        }

        case "check_app_health": {
            const { appName, endpoint = '/health' } = args;
            const apps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
            const app = apps.find(a => a.name?.toLowerCase() === appName?.toLowerCase() || a.id === appName);

            if (!app) {
                return { content: [{ type: "text", text: `App not found: ${appName}` }], isError: true };
            }

            // Find domain for this app
            const proxy = await db.select().from(schema.proxies).where(eq(schema.proxies.appId, app.id)).get();

            if (proxy?.domain) {
                // Try to fetch health endpoint
                try {
                    const start = Date.now();
                    const response = await fetch(`https://${proxy.domain}${endpoint}`, {
                        method: 'GET',
                        signal: AbortSignal.timeout(5000)
                    });
                    const latency = Date.now() - start;
                    const body = await response.text().catch(() => '');

                    return {
                        content: [{ type: "text", text: `Health check for "${app.name}" (${proxy.domain}):\n- Status: ${response.status} ${response.statusText}\n- Latency: ${latency}ms\n- Response: ${body.slice(0, 200)}` }],
                    };
                } catch (e: any) {
                    return {
                        content: [{ type: "text", text: `Health check failed for "${app.name}": ${e.message}` }],
                        isError: true
                    };
                }
            }

            // No domain, try localhost with port
            return {
                content: [{ type: "text", text: `App "${app.name}" has no public domain. Port: ${app.port}. Configure a domain first to enable health checks.` }],
            };
        }

        case "get_deployment_history": {
            const { appName, limit = 10 } = args;

            // Get deployment-related logs
            let query = db.select().from(schema.activityLogs)
                .where(eq(schema.activityLogs.ownerId, userId))
                .orderBy(sql`${schema.activityLogs.timestamp} DESC`)
                .limit(limit);

            const logs = await query.all();

            // Filter for deployment-related events
            const deployLogs = logs
                .filter(l => ['deployment_status', 'app_deploy_triggered', 'webhook_deploy'].includes(l.type || ''))
                .map(l => {
                    const details = l.details ? JSON.parse(l.details) : {};
                    return {
                        time: new Date((l.timestamp || 0)).toISOString(),
                        type: l.type,
                        status: l.status,
                        app: details.name || details.repo?.split('/').pop()?.replace('.git', '') || 'unknown',
                        commit: details.commit || details.commitHash?.slice(0, 7) || '-'
                    };
                });

            // Filter by app if specified
            const filtered = appName
                ? deployLogs.filter(d => d.app?.toLowerCase().includes(appName.toLowerCase()))
                : deployLogs;

            return {
                content: [{ type: "text", text: `Deployment history (last ${filtered.length}):\n${JSON.stringify(filtered, null, 2)}` }],
            };
        }

        case "get_server_logs": {
            const { logType, lines = 50, filter, serverId } = args;
            const maxLines = Math.min(lines, 100); // Cap at 100 lines

            // Validate log type
            const validTypes = ['nginx-access', 'nginx-error', 'pm2', 'system'];
            if (!validTypes.includes(logType)) {
                return { content: [{ type: "text", text: `Invalid log type. Valid types: ${validTypes.join(', ')}` }], isError: true };
            }

            // Find server
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            const targetServer = serverId
                ? servers.find(s => s.id === serverId || s.id.startsWith(serverId))
                : servers[0];

            if (!targetServer) {
                return { content: [{ type: "text", text: `No server found.` }], isError: true };
            }

            // Check if server is online
            const session = Array.from(agentSessions.values()).find(sess => sess.nodeId === targetServer.id && sess.authorized);
            if (!session) {
                return { content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} is offline.` }], isError: true };
            }

            // Create request ID and promise for response
            const requestId = randomUUID();
            const logsPromise = new Promise<string>((resolve) => {
                const timeout = setTimeout(() => {
                    pendingLogRequests.delete(requestId);
                    resolve('ERROR: Request timed out after 10 seconds');
                }, 10000);
                pendingLogRequests.set(requestId, { resolve, timeout });
            });

            // Send request to agent
            session.socket.send(JSON.stringify({
                type: 'GET_LOGS',
                requestId,
                logType,
                lines: maxLines,
                filter: filter || null
            }));

            // Wait for response
            const rawLogs = await logsPromise;

            // Audit log access
            addActivityLog(userId, 'logs_accessed', { logType, lines: maxLines, filter }, targetServer.id, 'info');

            // Sanitize for GDPR
            const sanitizedLogs = sanitizeLogs(rawLogs);

            return {
                content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} - ${logType} (last ${maxLines} lines):\n\n${sanitizedLogs}` }],
            };
        }

        case "service_action": {
            const { service, action, serverId } = args;

            // Find server
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            const targetServer = serverId
                ? servers.find(s => s.id === serverId || s.id.startsWith(serverId))
                : servers[0];

            if (!targetServer) {
                return { content: [{ type: "text", text: `No server found.` }], isError: true };
            }

            // Check if server is online
            const session = Array.from(agentSessions.values()).find(sess => sess.nodeId === targetServer.id && sess.authorized);
            if (!session) {
                return { content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} is offline.` }], isError: true };
            }

            // Send service action to agent
            session.socket.send(JSON.stringify({
                type: 'SERVICE_ACTION',
                service,
                action
            }));

            addActivityLog(userId, 'service_action', { service, action }, targetServer.id, 'info');

            return {
                content: [{ type: "text", text: `Service action "${action}" triggered for ${service} on server ${targetServer.id.slice(0, 12)}` }],
            };
        }

        case "get_security_status": {
            const { serverId } = args;

            // Find server
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            const targetServer = serverId
                ? servers.find(s => s.id === serverId || s.id.startsWith(serverId))
                : servers[0];

            if (!targetServer) {
                return { content: [{ type: "text", text: `No server found.` }], isError: true };
            }

            // Check if server is online and get metrics
            const session = Array.from(agentSessions.values()).find(sess => sess.nodeId === targetServer.id && sess.authorized);
            if (!session) {
                return { content: [{ type: "text", text: `Server ${targetServer.id.slice(0, 12)} is offline.` }], isError: true };
            }

            const metrics = serverMetricsCache.get(targetServer.id);
            const statusLines = [
                `Server: ${targetServer.id.slice(0, 12)}`,
                `Status: Online`,
                metrics?.ip ? `IP: ${metrics.ip}` : '',
                metrics ? `CPU: ${metrics.cpu}% | RAM: ${metrics.ram}% | Disk: ${metrics.disk}%` : 'Metrics: Pending...',
                '',
                'Note: Detailed security info (firewall, failed services, load) is displayed in the agent console logs.',
                'Use get_server_logs with logType="system" to view system logs.'
            ].filter(Boolean);

            return {
                content: [{ type: "text", text: statusLines.join('\n') }],
            };
        }

        case "install_server_extras": {
            const { serverId } = args;

            // Find server
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            const targetServer = serverId
                ? servers.find(s => s.id === serverId || s.id.startsWith(serverId))
                : servers[0];

            if (!targetServer) {
                return { content: [{ type: "text", text: `No server found.` }], isError: true };
            }

            // Get metrics to find the control plane URL
            const metrics = serverMetricsCache.get(targetServer.id);
            const serverIp = metrics?.ip || 'your-server-ip';

            return {
                content: [{ type: "text", text: `To install optional monitoring tools on server ${targetServer.id.slice(0, 12)}, run this command on the server:\n\ncurl -sSL http://${serverIp}:3000/install.sh | bash -s -- --extras-only\n\nThis will install: ufw, fail2ban, htop, iotop, ncdu\n\nNote: The command must be run directly on the server with sudo/root access.` }],
            };
        }

        case "set_server_alias": {
            const { serverId, alias } = args;

            if (!serverId) {
                return { content: [{ type: "text", text: `Server ID is required.` }], isError: true };
            }

            // Find server
            const servers = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
            const targetServer = servers.find(s => s.id === serverId || s.id.startsWith(serverId));

            if (!targetServer) {
                return { content: [{ type: "text", text: `Server not found: ${serverId}` }], isError: true };
            }

            // Update the alias
            const newAlias = alias?.trim() || null;
            await db.update(schema.nodes)
                .set({ alias: newAlias })
                .where(eq(schema.nodes.id, targetServer.id))
                .run();

            const displayName = newAlias || targetServer.hostname || targetServer.id.slice(0, 12);
            return {
                content: [{ type: "text", text: newAlias
                    ? `Server "${targetServer.id.slice(0, 12)}" alias set to "${newAlias}". It will now be displayed as "${displayName}".`
                    : `Server "${targetServer.id.slice(0, 12)}" alias removed.`
                }],
            };
        }

        default:
            return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
    }
}

// MCP HTTP endpoint - handles JSON-RPC over HTTP
fastify.post('/mcp', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized - provide x-mcp-token header' });
    }

    const body = req.body as any;
    const { method, params, id } = body;

    // JSON-RPC response helper
    const jsonRpc = (result: any) => ({ jsonrpc: "2.0", id, result });
    const jsonRpcError = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

    // Notifications don't require a response
    if (method?.startsWith('notifications/')) {
        return reply.status(204).send();
    }

    switch (method) {
        case "initialize":
            return jsonRpc({
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "serverflow-mcp", version: "1.0.0" }
            });

        case "tools/list":
            return jsonRpc({ tools: MCP_TOOLS });

        case "tools/call": {
            const { name, arguments: toolArgs } = params || {};
            const toolResult = await handleMcpToolCall(userId, name, toolArgs || {});
            return jsonRpc(toolResult);
        }

        default:
            return jsonRpcError(-32601, `Method not found: ${method}`);
    }
});

// ==================== Apps Management ====================

fastify.get('/api/apps', async (req) => {
    const userId = (req as any).userId;
    return await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
});

fastify.post('/api/apps', async (req, reply) => {
    const userId = (req as any).userId;

    // Check app limit
    const limitCheck = await checkUsageLimit(userId, 'app');
    if (!limitCheck.allowed) {
        return reply.status(403).send({
            error: 'LIMIT_EXCEEDED',
            resource: 'app',
            current: limitCheck.current,
            limit: limitCheck.limit,
            message: limitCheck.message,
            upgradeUrl: '/billing'
        });
    }

    const body = req.body as any;

    // Handle ports - support both single port (legacy) and multiple ports
    let ports: Array<{ port: number; name: string; isMain: boolean }> = [];
    if (body.ports && Array.isArray(body.ports)) {
        ports = body.ports.map((p: any, i: number) => ({
            port: Number(p.port),
            name: p.name || (i === 0 ? 'main' : `port-${i}`),
            isMain: p.isMain ?? (i === 0)
        }));
    } else if (body.port) {
        ports = [{ port: Number(body.port), name: 'main', isMain: true }];
    }

    const mainPort = ports.find(p => p.isMain)?.port || ports[0]?.port || 3000;

    const app = {
        id: randomUUID(),
        ownerId: userId,
        nodeId: body.serverId,
        name: body.name,
        repoUrl: body.repoUrl,
        port: mainPort, // Legacy field for backwards compatibility
        ports: JSON.stringify(ports),
        env: JSON.stringify(body.env || {}),
        createdAt: Math.floor(Date.now() / 1000)
    };
    await db.insert(schema.apps).values(app).run();
    addActivityLog(userId, 'app_created', { name: app.name, repo: app.repoUrl }, app.nodeId, 'success');
    return { ...app, ports }; // Return parsed ports
});

fastify.delete('/api/apps/:id', async (req) => {
    const userId = (req as any).userId;
    const { id } = (req.params as any);
    const app = await db.select().from(schema.apps).where(and(eq(schema.apps.id, id), eq(schema.apps.ownerId, userId))).get();
    if (app) {
        await db.delete(schema.apps).where(eq(schema.apps.id, id)).run();
        addActivityLog(userId, 'app_deleted', { name: app.name }, app.nodeId, 'info');
    }
    return { success: true };
});

// Update app ports
fastify.patch('/api/apps/:id/ports', async (req, reply) => {
    const userId = (req as any).userId;
    const { id } = req.params as any;
    const { ports } = req.body as any;

    const app = await db.select().from(schema.apps)
        .where(and(eq(schema.apps.id, id), eq(schema.apps.ownerId, userId))).get();

    if (!app) {
        return reply.status(404).send({ error: 'App not found' });
    }

    // Validate ports array
    if (!Array.isArray(ports) || ports.length === 0) {
        return reply.status(400).send({ error: 'At least one port is required' });
    }

    const validatedPorts = ports.map((p: any, i: number) => ({
        port: Number(p.port),
        name: p.name || (i === 0 ? 'main' : `port-${i}`),
        isMain: p.isMain ?? (i === 0)
    }));

    // Ensure exactly one main port
    const mainPorts = validatedPorts.filter((p: any) => p.isMain);
    if (mainPorts.length === 0) {
        validatedPorts[0].isMain = true;
    } else if (mainPorts.length > 1) {
        validatedPorts.forEach((p: any, i: number) => { p.isMain = i === 0; });
    }

    const mainPort = validatedPorts.find((p: any) => p.isMain)?.port;

    await db.update(schema.apps)
        .set({ ports: JSON.stringify(validatedPorts), port: mainPort })
        .where(eq(schema.apps.id, id))
        .run();

    addActivityLog(userId, 'app_ports_updated', { name: app.name, ports: validatedPorts }, app.nodeId, 'info');
    return { success: true, ports: validatedPorts };
});

fastify.post('/api/apps/:id/deploy', async (req, reply) => {
    const userId = (req as any).userId;
    const { id } = (req.params as any);

    // Check deploy limit
    const limitCheck = await checkUsageLimit(userId, 'deploy');
    if (!limitCheck.allowed) {
        return reply.status(403).send({
            error: 'LIMIT_EXCEEDED',
            resource: 'deploy',
            current: limitCheck.current,
            limit: limitCheck.limit,
            message: limitCheck.message,
            upgradeUrl: '/billing'
        });
    }

    const { commitHash } = (req.body as any) || { commitHash: 'main' };
    const app = await db.select().from(schema.apps).where(and(eq(schema.apps.id, id), eq(schema.apps.ownerId, userId))).get();
    if (!app) return reply.status(404).send({ error: 'App not found' });
    const ok = await sendToAgentById(app.nodeId, {
        type: 'DEPLOY',
        appId: app.id,
        repoUrl: app.repoUrl,
        commitHash: commitHash || 'main',
        port: app.port,
        ports: app.ports ? JSON.parse(app.ports) : undefined,
        env: JSON.parse(app.env || '{}')
    }, userId);

    if (ok) {
        // Increment deploy counter
        await incrementUsage(userId, 'deploy');
        addActivityLog(userId, 'app_deploy_triggered', { name: app.name }, app.nodeId, 'info');
        return { status: 'triggered' };
    }
    return reply.status(503).send({ error: 'Target agent offline' });
});

fastify.post('/api/apps/:id/:action', async (req, reply) => {
    const userId = (req as any).userId;
    const { id, action } = (req.params as any);
    const app = await db.select().from(schema.apps).where(and(eq(schema.apps.id, id), eq(schema.apps.ownerId, userId))).get();
    if (!app) return reply.status(404).send({ error: 'App not found' });
    const ok = await sendToAgentById(app.nodeId, {
        type: 'APP_ACTION',
        appId: id,
        action: action.toUpperCase(),
        repoUrl: app.repoUrl
    }, userId);
    return ok ? { status: 'triggered' } : reply.status(503).send({ error: 'Target agent offline' });
});

fastify.post('/api/servers/token', async (req, reply) => {
    const userId = (req as any).userId;

    // Check server limit
    const limitCheck = await checkUsageLimit(userId, 'server');
    if (!limitCheck.allowed) {
        return reply.status(403).send({
            error: 'LIMIT_EXCEEDED',
            resource: 'server',
            current: limitCheck.current,
            limit: limitCheck.limit,
            message: limitCheck.message,
            upgradeUrl: '/billing'
        });
    }

    const token = randomUUID();
    await db.insert(schema.registrationTokens).values({ id: token, ownerId: userId, expiresAt: Date.now() + 600000 }).run();
    return { token };
});

fastify.get('/api/servers/verify-token/:token', async (req, reply) => {
    const { token } = (req.params as any);
    const data = await db.select().from(schema.registrationTokens).where(eq(schema.registrationTokens.id, token)).get();
    if (data && data.expiresAt > Date.now()) return { valid: true };
    return reply.status(401).send({ valid: false });
});

// Update server alias
fastify.patch('/api/servers/:serverId/alias', async (req, reply) => {
    const userId = (req as any).userId;
    const { serverId } = req.params as any;
    const { alias } = req.body as any;

    // Find the server and verify ownership
    const server = await db.select().from(schema.nodes)
        .where(and(
            eq(schema.nodes.ownerId, userId),
            or(eq(schema.nodes.id, serverId), sql`${schema.nodes.id} LIKE ${serverId + '%'}`)
        ))
        .get();

    if (!server) {
        return reply.status(404).send({ error: 'Server not found' });
    }

    // Update the alias
    await db.update(schema.nodes)
        .set({ alias: alias || null })
        .where(eq(schema.nodes.id, server.id))
        .run();

    return { success: true, alias: alias || null };
});

// WebSocket Handlers
fastify.register(async function (fastify) {
    fastify.get('/api/dashboard/ws', { websocket: true }, async (connection, req) => {
        const userId = (req as any).userId;
        if (!userId) return connection.socket.close();

        if (!dashboardSessions.has(userId)) dashboardSessions.set(userId, new Set());
        const sessions = dashboardSessions.get(userId)!;
        sessions.add(connection.socket);

        console.log('📊 Dashboard WS connected, userId:', userId);
        const socket = connection.socket;

        async function broadcastProxies() {
            const up = await db.select().from(schema.proxies).where(eq(schema.proxies.ownerId, userId)).all();
            broadcastToUser(userId, { type: 'PROXIES_UPDATE', proxies: up });
        }

        const userNodes = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
        const userApps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
        const userProxies = await db.select().from(schema.proxies).where(eq(schema.proxies.ownerId, userId)).all();

        const state = userNodes.map(n => {
            const active = Array.from(agentSessions.values()).find(sess => sess.nodeId === n.id && sess.authorized);
            // updateAvailable is true if agent is online AND (no version reported OR different version)
            const needsUpdate = active && (!active.version || active.version !== AGENT_BUNDLE_VERSION);
            return {
                ...n,
                status: active ? 'online' : 'offline',
                agentVersion: active?.version || null,
                updateAvailable: needsUpdate
            };
        });

        socket.send(JSON.stringify({
            type: 'INITIAL_STATE',
            servers: state,
            apps: userApps,
            proxies: userProxies,
            bundleVersion: AGENT_BUNDLE_VERSION
        }));

        socket.on('message', async (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());
                const nodeId = msg.serverId;

                // Combined Deploy + Domain Provision
                if (msg.type === 'DEPLOY_WITH_DOMAIN') {
                    // Check limits before proceeding
                    const appLimit = await checkUsageLimit(userId, 'app');
                    if (!appLimit.allowed) {
                        socket.send(JSON.stringify({ type: 'ERROR', message: `App limit reached (${appLimit.current}/${appLimit.limit}). Please upgrade your plan.` }));
                        return;
                    }

                    const deployLimit = await checkUsageLimit(userId, 'deploy');
                    if (!deployLimit.allowed) {
                        socket.send(JSON.stringify({ type: 'ERROR', message: `Daily deploy limit reached (${deployLimit.current}/${deployLimit.limit}). Please upgrade your plan.` }));
                        return;
                    }

                    const domainLimit = await checkUsageLimit(userId, 'domain');
                    if (!domainLimit.allowed) {
                        socket.send(JSON.stringify({ type: 'ERROR', message: `Domain limit reached (${domainLimit.current}/${domainLimit.limit}). Please upgrade your plan.` }));
                        return;
                    }

                    // 1. Create the app in database
                    const appId = randomUUID();
                    const app = {
                        id: appId,
                        ownerId: userId,
                        nodeId: nodeId,
                        name: msg.appName,
                        repoUrl: msg.repoUrl,
                        port: msg.port,
                        env: '{}',
                        createdAt: Math.floor(Date.now() / 1000)
                    };
                    await db.insert(schema.apps).values(app).run();
                    addActivityLog(userId, 'app_created', { name: app.name, repo: app.repoUrl }, nodeId, 'success');

                    // 2. Deploy the app
                    const deployOk = await sendToAgentById(nodeId, {
                        type: 'DEPLOY',
                        repoUrl: msg.repoUrl,
                        commitHash: 'main',
                        port: msg.port,
                        env: {},
                        appId: appId
                    }, userId);

                    if (deployOk) {
                        // Increment deploy counter
                        await incrementUsage(userId, 'deploy');
                        addActivityLog(userId, 'app_deploy_triggered', { name: app.name }, nodeId, 'info');

                        // 3. Provision domain (after a short delay for app to start)
                        setTimeout(async () => {
                            const provisionOk = await sendToAgentById(nodeId, {
                                type: 'PROVISION_DOMAIN',
                                serverId: nodeId,
                                domain: msg.domain,
                                port: msg.port,
                                appId: appId,
                                repoUrl: 'system-provision'
                            }, userId);

                            if (provisionOk) {
                                await db.insert(schema.proxies).values({
                                    id: randomUUID(),
                                    ownerId: userId,
                                    nodeId,
                                    appId: appId,
                                    domain: msg.domain,
                                    port: msg.port
                                }).run();
                                await broadcastProxies();
                                addActivityLog(userId, 'domain_provisioned', { domain: msg.domain, app: app.name }, nodeId, 'success');
                            }
                        }, 2000);
                    }

                    // Broadcast updated apps list
                    const userApps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
                    socket.send(JSON.stringify({ type: 'APPS_UPDATE', apps: userApps }));
                    return;
                }

                // Infrastructure messages (Story 7.7) + Agent Update
                if (['GET_SERVER_STATUS', 'INSTALL_RUNTIME', 'CONFIGURE_DATABASE', 'UPDATE_AGENT'].includes(msg.type)) {
                    const ok = await sendToAgentById(nodeId, msg, userId);
                    if (!ok) console.error(`❌ Infrastructure command failed: ${msg.type}`);
                    return;
                }

                if (['PROVISION_DOMAIN', 'SERVICE_ACTION', 'APP_ACTION', 'DELETE_PROXY'].includes(msg.type)) {
                    // Check domain limit for PROVISION_DOMAIN
                    if (msg.type === 'PROVISION_DOMAIN') {
                        const existingDomain = await db.select().from(schema.proxies).where(and(eq(schema.proxies.nodeId, nodeId), eq(schema.proxies.domain, msg.domain))).get();
                        if (!existingDomain) {
                            const limitCheck = await checkUsageLimit(userId, 'domain');
                            if (!limitCheck.allowed) {
                                socket.send(JSON.stringify({ type: 'ERROR', message: `Domain limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.` }));
                                return;
                            }
                        }
                    }

                    const ok = await sendToAgentById(nodeId, msg, userId);
                    if (ok && msg.type === 'SERVICE_ACTION') {
                        addActivityLog(userId, 'service_action', { service: msg.service, action: msg.action }, nodeId, 'info');
                    }
                    if (ok && msg.type === 'PROVISION_DOMAIN') {
                        const existing = await db.select().from(schema.proxies).where(and(eq(schema.proxies.nodeId, nodeId), eq(schema.proxies.domain, msg.domain))).get();
                        if (existing) {
                            await db.update(schema.proxies).set({ port: msg.port, appId: msg.appId }).where(eq(schema.proxies.id, existing.id)).run();
                        } else {
                            await db.insert(schema.proxies).values({ id: randomUUID(), ownerId: userId, nodeId, appId: msg.appId, domain: msg.domain, port: msg.port }).run();
                        }
                        await broadcastProxies();
                    }
                    if (ok && msg.type === 'DELETE_PROXY') {
                        await db.delete(schema.proxies).where(and(eq(schema.proxies.nodeId, nodeId), eq(schema.proxies.domain, msg.domain))).run();
                        await broadcastProxies();
                    }
                    if (!ok) console.error(`❌ Route Failed: ${msg.type}`);
                }
            } catch (e) { }
        });

        socket.on('close', () => {
            sessions.delete(socket);
            if (sessions.size === 0) dashboardSessions.delete(userId);
        });
    });

    fastify.get('/api/connect', { websocket: true }, (connection) => {
        const socket = connection.socket;
        const connectionId = randomUUID();
        const nonce = randomUUID();

        socket.on('message', async (message: Buffer) => {
            try {
                const msg = JSON.parse(message.toString());
                if (msg.type === 'CONNECT') {
                    console.log('📡 Agent connecting, pubKey:', msg.pubKey.substring(0, 10), 'version:', msg.version || 'unknown');
                    const node = await db.select().from(schema.nodes).where(eq(schema.nodes.pubKey, msg.pubKey)).get();
                    if (!node) return socket.send(JSON.stringify({ type: 'ERROR', message: 'Not registered' }));
                    agentSessions.set(connectionId, { pubKey: msg.pubKey, nodeId: node.id, socket, authorized: false, nonce, version: msg.version });
                    socket.send(JSON.stringify({ type: 'CHALLENGE', nonce }));
                }
                else if (msg.type === 'RESPONSE') {
                    const sess = agentSessions.get(connectionId);
                    if (sess && sess.nonce) {
                        // Verify the signature with agent's public key
                        const isValid = verifyEd25519(sess.nonce, msg.signature, sess.pubKey);
                        if (!isValid) {
                            console.error(`🚨 SECURITY: Invalid signature from agent [${sess.nodeId}]`);
                            socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid signature' }));
                            socket.close();
                            return;
                        }
                        sess.authorized = true;
                        console.log(`✅ Agent auth [${sess.nodeId}] - Signature verified`);
                        socket.send(JSON.stringify({ type: 'AUTHORIZED', sessionId: connectionId }));
                        broadcastToDashboards({ type: 'SERVER_STATUS', serverId: sess.nodeId, status: 'online' });
                    }
                }
                else if (msg.type === 'REGISTER') {
                    const tokenData = await db.select().from(schema.registrationTokens).where(eq(schema.registrationTokens.id, msg.token)).get();
                    if (!tokenData || tokenData.expiresAt < Date.now()) return socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid token' }));
                    const nodeId = randomUUID();
                    await db.insert(schema.nodes).values({ id: nodeId, ownerId: tokenData.ownerId, pubKey: msg.pubKey }).run();
                    console.log(`🚀 Node reg [${nodeId}] version:`, msg.version || 'unknown');
                    agentSessions.set(connectionId, { pubKey: msg.pubKey, nodeId, socket, authorized: true, version: msg.version });
                    // Include CP public key so agent can verify future commands
                    socket.send(JSON.stringify({
                        type: 'REGISTERED',
                        serverId: nodeId,
                        cpPublicKey: getCPPublicKey()
                    }));
                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId: nodeId, status: 'online' });
                    addActivityLog(tokenData.ownerId, 'node_registered', { nodeId }, nodeId, 'success');
                    await db.delete(schema.registrationTokens).where(eq(schema.registrationTokens.id, msg.token)).run();
                }
                else if (['STATUS_UPDATE', 'LOG_STREAM', 'SYSTEM_LOG'].includes(msg.type)) {
                    const sess = agentSessions.get(connectionId);
                    if (sess?.authorized) {
                        if (msg.type === 'LOG_STREAM') console.log(`⏩ [${sess.nodeId}] Log: ${msg.data.substring(0, 30)}`);
                        broadcastToDashboards({ ...msg, serverId: sess.nodeId });
                        if (msg.type === 'STATUS_UPDATE') {
                            const node = await db.select().from(schema.nodes).where(eq(schema.nodes.id, sess.nodeId)).get();
                            if (node) addActivityLog(node.ownerId, 'deployment_status', { repo: msg.repoUrl, status: msg.status }, node.id, msg.status === 'success' ? 'success' : 'info');
                        }
                        // Cache metrics from SYSTEM_LOG for MCP
                        if (msg.type === 'SYSTEM_LOG') {
                            // Direct metrics fields (new way)
                            if (msg.source === 'metrics' && msg.cpu !== undefined) {
                                serverMetricsCache.set(sess.nodeId, {
                                    cpu: msg.cpu,
                                    ram: msg.ram,
                                    disk: msg.disk,
                                    ip: msg.ip,
                                    updatedAt: Date.now()
                                });
                            }
                            // Parse from text (legacy fallback)
                            else if (msg.data?.includes('[Health Check]')) {
                                const cpuMatch = msg.data.match(/CPU:\s*([\d.]+)%/);
                                const ramMatch = msg.data.match(/\((\d+\.?\d*)%\)/);
                                const diskMatch = msg.data.match(/Disk:\s*([\d.]+)%/);
                                if (cpuMatch && ramMatch && diskMatch) {
                                    const existing = serverMetricsCache.get(sess.nodeId);
                                    serverMetricsCache.set(sess.nodeId, {
                                        cpu: parseFloat(cpuMatch[1]),
                                        ram: parseFloat(ramMatch[1]),
                                        disk: parseFloat(diskMatch[1]),
                                        ip: existing?.ip,
                                        updatedAt: Date.now()
                                    });
                                }
                            }
                        }
                    }
                }
                // Infrastructure response messages (Story 7.7) + Agent Update
                else if (['SERVER_STATUS_RESPONSE', 'INFRASTRUCTURE_LOG', 'RUNTIME_INSTALLED', 'DATABASE_CONFIGURED', 'AGENT_UPDATE_STATUS'].includes(msg.type)) {
                    const sess = agentSessions.get(connectionId);
                    if (sess?.authorized) {
                        console.log(`🔧 [${sess.nodeId}] Infrastructure: ${msg.type}`);
                        broadcastToDashboards({ ...msg, serverId: sess.nodeId });
                    }
                }
                // Handle log response from agent
                else if (msg.type === 'LOG_RESPONSE') {
                    const pending = pendingLogRequests.get(msg.requestId);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        pendingLogRequests.delete(msg.requestId);
                        pending.resolve(msg.logs || msg.error || 'No logs returned');
                    }
                }
                // Handle detected ports from agent
                else if (msg.type === 'DETECTED_PORTS') {
                    const sess = agentSessions.get(connectionId);
                    if (sess?.authorized && msg.appId && msg.ports) {
                        console.log(`🔌 [${sess.nodeId}] Detected ports for app ${msg.appId}: ${msg.ports.join(', ')}`);
                        // Update the app with detected ports
                        await db.update(schema.apps)
                            .set({ detectedPorts: JSON.stringify(msg.ports) })
                            .where(eq(schema.apps.id, msg.appId))
                            .run();
                        // Broadcast to dashboards
                        broadcastToDashboards({
                            type: 'APP_PORTS_DETECTED',
                            appId: msg.appId,
                            serverId: sess.nodeId,
                            detectedPorts: msg.ports
                        });
                    }
                }
            } catch (e) { }
        });
        socket.on('close', () => agentSessions.delete(connectionId));
    });
});

// Auth
async function createSession(userId: string, reply: any) {
    const sessionId = randomUUID();
    await db.insert(schema.sessions).values({ id: sessionId, userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 }).run();
    reply.setCookie('session_id', sessionId, { path: '/', httpOnly: true, secure: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    return sessionId;
}

fastify.post('/api/auth/register', async (req, reply) => {
    const { email, password, name } = req.body as any;
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (existing) return reply.status(400).send({ error: 'Conflict' });
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(schema.users).values({ id: userId, email, name, passwordHash }).run();
    await createSession(userId, reply);
    return { success: true };
});

fastify.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body as any;
    const user = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return reply.status(401).send({ error: 'Unauthorized' });
    await createSession(user.id, reply);
    return { success: true };
});

fastify.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies.session_id;
    if (sid) await db.delete(schema.sessions).where(eq(schema.sessions.id, sid)).run();
    reply.clearCookie('session_id');
    return { success: true };
});

fastify.get('/api/auth/me', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'No user' });
    return await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
});

// ==================== GDPR USER DATA ROUTES ====================

// Export user data (GDPR Article 20 - Right to data portability)
fastify.get('/api/user/export-data', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    // Collect all user data
    const userData = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    const userNodes = await db.select().from(schema.nodes).where(eq(schema.nodes.ownerId, userId)).all();
    const userApps = await db.select().from(schema.apps).where(eq(schema.apps.ownerId, userId)).all();
    const userProxies = await db.select().from(schema.proxies).where(eq(schema.proxies.ownerId, userId)).all();
    const userSubscriptions = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).all();
    const userInvoices = await db.select().from(schema.invoices).where(eq(schema.invoices.userId, userId)).all();
    const userActivityLogs = await db.select().from(schema.activityLogs).where(eq(schema.activityLogs.ownerId, userId)).all();
    const userManagedServers = await db.select().from(schema.managedServers).where(eq(schema.managedServers.userId, userId)).all();

    // Remove sensitive fields
    if (userData) {
        delete (userData as any).passwordHash;
        delete (userData as any).mcpToken;
    }

    const exportData = {
        exportDate: new Date().toISOString(),
        user: userData,
        nodes: userNodes,
        applications: userApps,
        proxies: userProxies,
        subscriptions: userSubscriptions,
        invoices: userInvoices,
        activityLogs: userActivityLogs,
        managedServers: userManagedServers
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="serverflow-data-${userId}.json"`);
    return JSON.stringify(exportData, null, 2);
});

// Delete user account (GDPR Article 17 - Right to erasure)
fastify.delete('/api/user/delete-account', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    try {
        // Delete all user data (cascade should handle most, but be explicit)
        await db.delete(schema.activityLogs).where(eq(schema.activityLogs.ownerId, userId)).run();
        await db.delete(schema.invoices).where(eq(schema.invoices.userId, userId)).run();
        await db.delete(schema.usageRecords).where(eq(schema.usageRecords.userId, userId)).run();
        await db.delete(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).run();
        await db.delete(schema.managedServers).where(eq(schema.managedServers.userId, userId)).run();
        await db.delete(schema.mcpTokens).where(eq(schema.mcpTokens.userId, userId)).run();
        await db.delete(schema.proxies).where(eq(schema.proxies.ownerId, userId)).run();
        await db.delete(schema.apps).where(eq(schema.apps.ownerId, userId)).run();
        await db.delete(schema.nodes).where(eq(schema.nodes.ownerId, userId)).run();
        await db.delete(schema.registrationTokens).where(eq(schema.registrationTokens.ownerId, userId)).run();
        await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId)).run();
        await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
        await db.delete(schema.users).where(eq(schema.users.id, userId)).run();

        // Clear session cookie
        reply.clearCookie('session_id');

        console.log(`🗑️ Account deleted: ${userId}`);
        return { success: true, message: 'Account deleted successfully' };
    } catch (err: any) {
        console.error('Failed to delete account:', err);
        return reply.status(500).send({ error: 'Failed to delete account' });
    }
});

fastify.get('/api/github/repos', async (req, reply) => {
    const token = req.headers['x-github-token'];
    if (!token) return reply.status(401).send({ error: 'Missing token' });
    const res = await fetch('https://api.github.com/user/repos?sort=updated', { headers: { 'Authorization': `Bearer ${token}` } });
    return await res.json();
});

fastify.get('/api/auth/github/login', async (req, reply) => {
    const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    if (!CLIENT_ID) return reply.status(500).send({ error: 'GitHub OAuth not configured' });
    const redirectUri = `${process.env.CONTROL_PLANE_URL || 'http://localhost:3000'}/api/auth/github/callback`;
    const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: redirectUri, scope: 'repo user:email' });
    return reply.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

fastify.get('/api/auth/github/callback', async (req: any, reply) => {
    const code = req.query.code;
    const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
    if (!CLIENT_ID || !CLIENT_SECRET) return reply.status(500).send({ error: 'GitHub OAuth not configured' });
    const tRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code })
    });
    const tData = await tRes.json() as any;
    const uRes = await fetch('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${tData.access_token}` } });
    const ghUser = await uRes.json() as any;

    let user = await db.select().from(schema.accounts).where(eq(schema.accounts.providerAccountId, String(ghUser.id))).get();
    let userId = user ? user.userId : randomUUID();

    if (!user) {
        await db.insert(schema.users).values({ id: userId, email: ghUser.email, name: ghUser.name || ghUser.login, avatarUrl: ghUser.avatar_url }).run();
        await db.insert(schema.accounts).values({ id: randomUUID(), userId, provider: 'github', providerAccountId: String(ghUser.id), accessToken: tData.access_token }).run();
    }
    await createSession(userId, reply);
    return reply.redirect(`${process.env.APP_URL || 'http://localhost:5173'}/?gh_token=${tData.access_token}`);
});

// GitHub Webhook Handler (Auto-deploy on push)
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'dev-webhook-secret';

function verifyGitHubSignature(payload: string, signature: string | undefined): boolean {
    if (!signature) return false;
    const expectedSig = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
    try {
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSig);
        if (sigBuffer.length !== expectedBuffer.length) return false;
        return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
        return false;
    }
}

fastify.post('/api/webhooks/github', async (req, reply) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const event = req.headers['x-github-event'] as string;
    const payload = JSON.stringify(req.body);

    // Verify HMAC signature
    if (!verifyGitHubSignature(payload, signature)) {
        console.warn('⚠️ GitHub webhook: Invalid signature');
        return reply.status(401).send({ error: 'Invalid signature' });
    }

    // Only handle push events
    if (event !== 'push') {
        return { status: 'ignored', event };
    }

    const body = req.body as any;
    const repoUrl = body.repository?.clone_url;
    const branch = body.ref?.replace('refs/heads/', '');
    const commitHash = body.after;

    // Only deploy main/master branch
    if (!['main', 'master'].includes(branch)) {
        return { status: 'ignored', reason: 'not main branch', branch };
    }

    console.log(`🔔 GitHub Push: ${repoUrl} @ ${commitHash?.slice(0, 7)}`);

    // Find the app matching this repo
    const app = await db.select().from(schema.apps).where(eq(schema.apps.repoUrl, repoUrl)).get();
    if (!app) {
        // Try matching without .git suffix
        const altUrl = repoUrl.replace(/\.git$/, '');
        const altApp = await db.select().from(schema.apps).where(eq(schema.apps.repoUrl, altUrl)).get();
        if (!altApp) {
            console.log(`⚠️ No app registered for repo: ${repoUrl}`);
            return { status: 'no_app_found', repoUrl };
        }
    }

    const targetApp = app || await db.select().from(schema.apps).where(eq(schema.apps.repoUrl, repoUrl.replace(/\.git$/, ''))).get();
    if (!targetApp) {
        return { status: 'no_app_found', repoUrl };
    }

    // Find the agent for this app's node
    let agentFound = false;
    agentSessions.forEach(session => {
        if (session.authorized && session.nodeId === targetApp.nodeId) {
            session.socket.send(JSON.stringify({
                type: 'DEPLOY',
                appId: targetApp.id,
                repoUrl: targetApp.repoUrl,
                commitHash,
                port: targetApp.port,
                ports: targetApp.ports ? JSON.parse(targetApp.ports) : undefined,
                env: JSON.parse(targetApp.env || '{}')
            }));
            agentFound = true;
        }
    });

    if (agentFound) {
        addActivityLog(targetApp.ownerId, 'webhook_deploy', { repo: repoUrl, commit: commitHash?.slice(0, 7) }, targetApp.nodeId, 'info');
        return { status: 'deploy_triggered', app: targetApp.name, commit: commitHash };
    }

    return reply.status(503).send({ error: 'Agent offline', nodeId: targetApp.nodeId });
});

// ==================== Assisted SSH Installation ====================
// Rate limiting for SSH connection attempts
const sshConnectionAttempts = new Map<string, { count: number; resetAt: number }>();
// Temporary tokens for SSH WebSocket auth (bypass cookie cross-origin issue)
const sshTokens = new Map<string, { userId: string; expiresAt: number }>();

// Generate a temporary token for SSH WebSocket authentication
// This endpoint works via HTTP where cookies are sent correctly
fastify.post('/api/ssh/token', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const token = randomUUID();
    // Token expires in 30 seconds (just enough time to establish WebSocket)
    sshTokens.set(token, { userId, expiresAt: Date.now() + 30000 });

    // Cleanup expired tokens periodically
    for (const [t, data] of sshTokens.entries()) {
        if (data.expiresAt < Date.now()) sshTokens.delete(t);
    }

    return { token };
});

function checkSSHRateLimit(ip: string): boolean {
    const now = Date.now();
    const limit = sshConnectionAttempts.get(ip);

    if (!limit || now > limit.resetAt) {
        sshConnectionAttempts.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
        return true;
    }

    if (limit.count >= 5) {
        return false; // Max 5 attempts per minute
    }

    limit.count++;
    return true;
}

// Initiate SSH connection (returns session ID)
fastify.post('/api/ssh/connect', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const ip = req.ip;
    if (!checkSSHRateLimit(ip)) {
        return reply.status(429).send({ error: 'Too many connection attempts. Wait 1 minute.' });
    }

    const body = req.body as any;
    const credentials: SSHCredentials = {
        host: body.host,
        port: body.port || 22,
        username: body.username,
        password: body.password,
        privateKey: body.privateKey,
    };

    // Validate required fields
    if (!credentials.host || !credentials.username) {
        return reply.status(400).send({ error: 'Missing host or username' });
    }

    if (!credentials.password && !credentials.privateKey) {
        return reply.status(400).send({ error: 'Provide password or private key' });
    }

    return {
        status: 'ready',
        message: 'Connect via WebSocket at /api/ssh/session',
        credentials: { host: credentials.host, port: credentials.port, username: credentials.username }
    };
});

// WebSocket endpoint for SSH sessions
fastify.register(async function (fastify) {
    fastify.get('/api/ssh/session', { websocket: true }, async (connection, req) => {
        // Try cookie-based auth first, then token-based auth (for cross-origin)
        let userId = (req as any).userId;

        // Check for token in query string (cross-origin WebSocket auth)
        const url = new URL(req.url, `http://${req.hostname}`);
        const token = url.searchParams.get('token');
        if (!userId && token) {
            const tokenData = sshTokens.get(token);
            if (tokenData && tokenData.expiresAt > Date.now()) {
                userId = tokenData.userId;
                sshTokens.delete(token); // One-time use
                console.log('🔑 SSH WebSocket auth via token');
            }
        }

        if (!userId) {
            connection.socket.close(4001, 'Not authenticated');
            return;
        }

        const socket = connection.socket;
        let sessionId: string | null = null;

        console.log('🔌 SSH WebSocket connected, userId:', userId);

        socket.on('message', async (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());
                console.log('📩 SSH WebSocket message received:', msg.type, msg.host || '');

                // Start SSH connection
                if (msg.type === 'CONNECT') {
                    console.log('🔗 Attempting SSH to', msg.host, 'as', msg.username);
                    const ip = req.ip;
                    if (!checkSSHRateLimit(ip)) {
                        socket.send(JSON.stringify({
                            type: 'ERROR',
                            code: 'RATE_LIMITED',
                            message: 'Too many connection attempts. Wait 1 minute.'
                        }));
                        return;
                    }

                    const credentials: SSHCredentials = {
                        host: msg.host,
                        port: msg.port || 22,
                        username: msg.username,
                        password: msg.password,
                        privateKey: msg.privateKey,
                    };

                    if (!credentials.host || !credentials.username) {
                        socket.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_PARAMS', message: 'Missing host or username' }));
                        return;
                    }

                    if (!credentials.password && !credentials.privateKey) {
                        socket.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_PARAMS', message: 'Provide password or private key' }));
                        return;
                    }

                    try {
                        console.log('🔐 Creating SSH session...');
                        sessionId = await sshManager.createSession(userId, credentials, socket, msg.verbose || false);
                        console.log('✅ SSH session created:', sessionId);
                        socket.send(JSON.stringify({ type: 'CONNECTED', sessionId }));

                        // Run pre-flight checks
                        console.log('🔍 Running preflight checks...');
                        const preflightOk = await sshManager.runPreflightChecks(sessionId);
                        console.log('📋 Preflight result:', preflightOk);

                        if (preflightOk && msg.autoInstall) {
                            // Generate registration token
                            const token = randomUUID();
                            await db.insert(schema.registrationTokens).values({
                                id: token,
                                ownerId: userId,
                                expiresAt: Date.now() + 600000 // 10 min
                            }).run();

                            // Use the control plane URL from environment or auto-detect local IP
                            const localIp = getLocalIpAddress();
                            const controlPlaneUrl = process.env.CONTROL_PLANE_URL || `http://${localIp}:3000`;
                            console.log('🌐 Control Plane URL for installation:', controlPlaneUrl);

                            // Run installation
                            await sshManager.runInstallation(sessionId, controlPlaneUrl, token);
                        }
                    } catch (err: any) {
                        console.error('❌ SSH Error:', err.message, err.stack);
                        if (err.message === 'MAX_SESSIONS_EXCEEDED') {
                            socket.send(JSON.stringify({
                                type: 'ERROR',
                                code: 'MAX_SESSIONS',
                                message: 'Maximum 3 concurrent SSH sessions allowed'
                            }));
                        } else {
                            socket.send(JSON.stringify({
                                type: 'ERROR',
                                code: 'SSH_ERROR',
                                message: err.message || 'SSH connection failed'
                            }));
                        }
                    }
                }

                // Manual install trigger (after preflight passed)
                else if (msg.type === 'START_INSTALL' && sessionId) {
                    const token = randomUUID();
                    await db.insert(schema.registrationTokens).values({
                        id: token,
                        ownerId: userId,
                        expiresAt: Date.now() + 600000
                    }).run();

                    const localIp = getLocalIpAddress();
                    const controlPlaneUrl = process.env.CONTROL_PLANE_URL || `http://${localIp}:3000`;
                    console.log('🌐 Control Plane URL for manual installation:', controlPlaneUrl);
                    await sshManager.runInstallation(sessionId, controlPlaneUrl, token);
                }

                // Agent update trigger (for old agents without UPDATE_AGENT support)
                else if (msg.type === 'START_UPDATE' && sessionId) {
                    const localIp = getLocalIpAddress();
                    const controlPlaneUrl = process.env.CONTROL_PLANE_URL || `http://${localIp}:3000`;
                    console.log('🔄 Starting SSH-based agent update');
                    await sshManager.runUpdate(sessionId, controlPlaneUrl);
                }

                // Send input to SSH shell
                else if (msg.type === 'INPUT' && sessionId) {
                    sshManager.sendInput(sessionId, msg.data);
                }

                // Cancel/disconnect
                else if (msg.type === 'DISCONNECT' && sessionId) {
                    sshManager.endSession(sessionId, userId);
                    socket.send(JSON.stringify({ type: 'DISCONNECTED' }));
                }

            } catch (e) {
                console.error('SSH WebSocket error:', e);
            }
        });

        socket.on('close', () => {
            console.log('🔌 SSH WebSocket closed');
            if (sessionId) {
                sshManager.endSession(sessionId, userId);
            }
        });
    });
});

// ==================== BILLING ROUTES ====================

// Get available plans (public)
fastify.get('/api/billing/plans', async () => {
    const plans = await getActivePlans();
    return {
        plans: plans.map(p => ({
            id: p.id,
            name: p.name,
            displayName: p.displayName,
            description: p.description,
            priceMonthly: p.priceMonthly,
            priceYearly: p.priceYearly,
            priceMonthlyFormatted: formatAmount(p.priceMonthly || 0),
            priceYearlyFormatted: formatAmount(p.priceYearly || 0),
            limits: {
                servers: p.maxServers,
                apps: p.maxApps,
                domains: p.maxDomains,
                deploysPerDay: p.maxDeploysPerDay
            },
            features: p.features ? JSON.parse(p.features) : [],
            isDefault: p.isDefault
        })),
        stripeConfigured: isStripeConfigured(),
        publishableKey: getPublishableKey()
    };
});

// Get current subscription
fastify.get('/api/billing/subscription', async (req) => {
    const userId = (req as any).userId;
    return await getSubscriptionStatus(userId);
});

// Get usage report
fastify.get('/api/billing/usage', async (req) => {
    const userId = (req as any).userId;
    return await getUsageReport(userId);
});

// Create checkout session
fastify.post('/api/billing/checkout', async (req, reply) => {
    const userId = (req as any).userId;
    const { planId, billingInterval = 'month' } = req.body as any;

    if (!isStripeConfigured()) {
        return reply.status(400).send({ error: 'Stripe is not configured' });
    }

    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!user) {
        return reply.status(404).send({ error: 'User not found' });
    }

    try {
        const session = await createCheckoutSession({
            userId,
            email: user.email!,
            name: user.name || undefined,
            planId,
            billingInterval,
            successUrl: `${process.env.APP_URL || 'http://localhost:5173'}/?billing=success`,
            cancelUrl: `${process.env.APP_URL || 'http://localhost:5173'}/?billing=canceled`
        });

        return { url: session?.url };
    } catch (err: any) {
        return reply.status(400).send({ error: err.message });
    }
});

// Get customer portal URL
fastify.post('/api/billing/portal', async (req, reply) => {
    const userId = (req as any).userId;

    if (!isStripeConfigured()) {
        return reply.status(400).send({ error: 'Stripe is not configured' });
    }

    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!user?.stripeCustomerId) {
        return reply.status(400).send({ error: 'No billing account found' });
    }

    try {
        const session = await createPortalSession(
            user.stripeCustomerId,
            `${process.env.APP_URL || 'http://localhost:5173'}/`
        );
        return { url: session?.url };
    } catch (err: any) {
        return reply.status(400).send({ error: err.message });
    }
});

// Get invoices
fastify.get('/api/billing/invoices', async (req) => {
    const userId = (req as any).userId;
    const invoices = await db.select()
        .from(schema.invoices)
        .where(eq(schema.invoices.userId, userId))
        .orderBy(desc(schema.invoices.createdAt))
        .all();
    return invoices;
});

// Save billing information (onboarding)
fastify.post('/api/billing/onboarding', async (req, reply) => {
    const userId = (req as any).userId;
    const {
        billingName,
        billingEmail,
        billingCompany,
        billingAddress,
        billingCity,
        billingPostalCode,
        billingCountry,
        billingVatNumber,
        billingPhone,
        acceptTerms,
        acceptPrivacy,
        waiveWithdrawal
    } = req.body as any;

    // Validate required fields
    if (!billingName || !billingEmail || !billingAddress || !billingCity || !billingPostalCode || !billingCountry) {
        return reply.status(400).send({ error: 'Missing required billing fields' });
    }

    // Validate legal checkboxes
    if (!acceptTerms || !acceptPrivacy || !waiveWithdrawal) {
        return reply.status(400).send({ error: 'You must accept all legal agreements' });
    }

    const now = Math.floor(Date.now() / 1000);

    // Update user billing info
    await db.update(schema.users)
        .set({
            billingName,
            billingEmail,
            billingCompany: billingCompany || null,
            billingAddress,
            billingCity,
            billingPostalCode,
            billingCountry,
            billingVatNumber: billingVatNumber || null,
            billingPhone: billingPhone || null,
            acceptedTermsAt: now,
            acceptedPrivacyAt: now,
            waivedWithdrawalAt: now,
            onboardingCompleted: 1
        })
        .where(eq(schema.users.id, userId))
        .run();

    return { success: true };
});

// Stripe Webhook (raw body required)
fastify.post('/api/webhooks/stripe', {
    config: {
        rawBody: true
    }
}, async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = (req as any).rawBody || req.body;

    if (!signature) {
        return reply.status(400).send({ error: 'Missing signature' });
    }

    const event = verifyWebhookSignature(
        typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody),
        signature
    );

    if (!event) {
        return reply.status(400).send({ error: 'Invalid signature' });
    }

    try {
        await handleWebhookEvent(event);
        return { received: true };
    } catch (err: any) {
        console.error('Webhook error:', err);
        return reply.status(500).send({ error: err.message });
    }
});

// ==================== ADMIN ROUTES ====================

// Admin middleware
async function requireAdmin(req: any, reply: any) {
    const userId = req.userId;
    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!user || user.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin access required' });
    }
}

// List all users
fastify.get('/api/admin/users', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const users = await db.select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        stripeCustomerId: schema.users.stripeCustomerId,
        // Billing Information
        billingEmail: schema.users.billingEmail,
        billingName: schema.users.billingName,
        billingCompany: schema.users.billingCompany,
        billingAddress: schema.users.billingAddress,
        billingCity: schema.users.billingCity,
        billingPostalCode: schema.users.billingPostalCode,
        billingCountry: schema.users.billingCountry,
        billingVatNumber: schema.users.billingVatNumber,
        billingPhone: schema.users.billingPhone,
        // Legal Acceptance
        acceptedTermsAt: schema.users.acceptedTermsAt,
        acceptedPrivacyAt: schema.users.acceptedPrivacyAt,
        waivedWithdrawalAt: schema.users.waivedWithdrawalAt,
        onboardingCompleted: schema.users.onboardingCompleted,
        createdAt: schema.users.createdAt
    }).from(schema.users).all();

    // Get subscription info for each user
    const usersWithSubs = await Promise.all(users.map(async (user) => {
        const sub = await db.select()
            .from(schema.subscriptions)
            .where(and(
                eq(schema.subscriptions.userId, user.id),
                eq(schema.subscriptions.status, 'active')
            ))
            .get();

        let planName = 'free';
        if (sub) {
            const plan = await db.select().from(schema.plans).where(eq(schema.plans.id, sub.planId)).get();
            planName = plan?.displayName || sub.planId;
        }

        return { ...user, plan: planName, subscriptionStatus: sub?.status || 'none' };
    }));

    return usersWithSubs;
});

// Get user details
fastify.get('/api/admin/users/:id', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { id } = req.params as any;
    const user = await db.select().from(schema.users).where(eq(schema.users.id, id)).get();
    if (!user) {
        return reply.status(404).send({ error: 'User not found' });
    }

    const subscription = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, id))
        .get();

    const usage = await getUsageReport(id);
    const invoices = await db.select()
        .from(schema.invoices)
        .where(eq(schema.invoices.userId, id))
        .orderBy(desc(schema.invoices.createdAt))
        .limit(10)
        .all();

    return {
        user: { ...user, passwordHash: undefined },
        subscription,
        usage,
        invoices
    };
});

// Update user
fastify.patch('/api/admin/users/:id', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { id } = req.params as any;
    const updates = req.body as any;

    // Only allow certain fields to be updated
    const allowedFields = ['name', 'role', 'billingEmail', 'billingName'];
    const filteredUpdates: any = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    }

    await db.update(schema.users)
        .set(filteredUpdates)
        .where(eq(schema.users.id, id))
        .run();

    return { success: true };
});

// Impersonate user (creates a session for the target user)
fastify.post('/api/admin/users/:id/impersonate', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const adminId = (req as any).userId;
    const { id: targetUserId } = req.params as any;

    const targetUser = await db.select().from(schema.users).where(eq(schema.users.id, targetUserId)).get();
    if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' });
    }

    // Log the impersonation
    await addActivityLog(adminId, 'admin_impersonate', {
        targetUserId,
        targetEmail: targetUser.email
    });

    // Create session for target user
    const sessionId = randomUUID();
    await db.insert(schema.sessions).values({
        id: sessionId,
        userId: targetUserId,
        expiresAt: Date.now() + 1000 * 60 * 60 // 1 hour only for impersonation
    }).run();

    reply.setCookie('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 // 1 hour
    });

    return { success: true, user: { ...targetUser, passwordHash: undefined } };
});

// List all plans
fastify.get('/api/admin/plans', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    return await db.select().from(schema.plans).orderBy(schema.plans.sortOrder).all();
});

// Create plan
fastify.post('/api/admin/plans', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const planData = req.body as any;
    const id = planData.id || planData.name?.toLowerCase().replace(/\s+/g, '-') || randomUUID();

    await db.insert(schema.plans).values({
        id,
        name: planData.name,
        displayName: planData.displayName || planData.name,
        description: planData.description,
        stripePriceIdMonthly: planData.stripePriceIdMonthly,
        stripePriceIdYearly: planData.stripePriceIdYearly,
        priceMonthly: planData.priceMonthly || 0,
        priceYearly: planData.priceYearly || 0,
        maxServers: planData.maxServers ?? 1,
        maxApps: planData.maxApps ?? 3,
        maxDomains: planData.maxDomains ?? 3,
        maxDeploysPerDay: planData.maxDeploysPerDay ?? 10,
        features: planData.features ? JSON.stringify(planData.features) : null,
        isActive: planData.isActive ?? true,
        isDefault: planData.isDefault ?? false,
        sortOrder: planData.sortOrder ?? 0
    }).run();

    return { success: true, id };
});

// Update plan
fastify.patch('/api/admin/plans/:id', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { id } = req.params as any;
    const updates = req.body as any;

    // Handle features as JSON
    if (updates.features && Array.isArray(updates.features)) {
        updates.features = JSON.stringify(updates.features);
    }

    await db.update(schema.plans)
        .set(updates)
        .where(eq(schema.plans.id, id))
        .run();

    return { success: true };
});

// Delete plan
fastify.delete('/api/admin/plans/:id', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { id } = req.params as any;

    // Check if any subscriptions use this plan
    const activeSubs = await db.select()
        .from(schema.subscriptions)
        .where(and(
            eq(schema.subscriptions.planId, id),
            eq(schema.subscriptions.status, 'active')
        ))
        .all();

    if (activeSubs.length > 0) {
        return reply.status(400).send({
            error: 'Cannot delete plan with active subscriptions',
            activeSubscriptions: activeSubs.length
        });
    }

    await db.delete(schema.plans).where(eq(schema.plans.id, id)).run();
    return { success: true };
});

// List all subscriptions
fastify.get('/api/admin/subscriptions', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const subs = await db.select().from(schema.subscriptions).all();

    const subsWithUsers = await Promise.all(subs.map(async (sub) => {
        const user = await db.select({
            id: schema.users.id,
            email: schema.users.email,
            name: schema.users.name
        }).from(schema.users).where(eq(schema.users.id, sub.userId)).get();

        const plan = await db.select({
            name: schema.plans.name,
            displayName: schema.plans.displayName
        }).from(schema.plans).where(eq(schema.plans.id, sub.planId)).get();

        return { ...sub, user, plan };
    }));

    return subsWithUsers;
});

// Manually assign subscription
fastify.patch('/api/admin/subscriptions/:userId', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { userId } = req.params as any;
    const { planId, status, periodEnd } = req.body as any;

    const subscription = await assignSubscription(userId, planId, {
        status,
        periodEnd
    });

    await addActivityLog((req as any).userId, 'admin_subscription_update', {
        targetUserId: userId,
        planId,
        status
    });

    return subscription;
});

// Admin metrics
fastify.get('/api/admin/metrics', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    // Total users
    const usersResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .get();

    // Active subscriptions
    const activeSubsResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, 'active'))
        .get();

    // Total servers
    const serversResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.nodes)
        .get();

    // Total apps
    const appsResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.apps)
        .get();

    // MRR calculation (sum of monthly prices of active subscriptions)
    const activeSubs = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.status, 'active'))
        .all();

    let mrr = 0;
    for (const sub of activeSubs) {
        const plan = await db.select().from(schema.plans).where(eq(schema.plans.id, sub.planId)).get();
        if (plan) {
            mrr += plan.priceMonthly || 0;
        }
    }

    // Recent signups (last 7 days)
    const weekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const recentUsersResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(sql`${schema.users.createdAt} > ${weekAgo}`)
        .get();

    return {
        users: {
            total: usersResult?.count || 0,
            recentSignups: recentUsersResult?.count || 0
        },
        subscriptions: {
            active: activeSubsResult?.count || 0
        },
        infrastructure: {
            servers: serversResult?.count || 0,
            apps: appsResult?.count || 0
        },
        revenue: {
            mrr,
            mrrFormatted: formatAmount(mrr)
        }
    };
});

// ============ SECURITY ADMIN API ============

// Get security info (CP key fingerprint, creation date)
fastify.get('/api/admin/security', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const cpPublicKey = getCPPublicKey();
    const createdAt = getCPKeyCreatedAt();

    // Count online/offline agents
    let onlineAgents = 0;
    const allNodes = await db.select().from(schema.nodes).all();
    agentSessions.forEach(session => {
        if (session.authorized) onlineAgents++;
    });

    return {
        controlPlane: {
            fingerprint: getKeyFingerprint(cpPublicKey),
            createdAt,
            algorithm: 'Ed25519'
        },
        agents: {
            total: allNodes.length,
            online: onlineAgents,
            offline: allNodes.length - onlineAgents
        }
    };
});

// Get agent keys info
fastify.get('/api/admin/security/agents', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const nodes = await db.select().from(schema.nodes).all();

    return nodes.map(node => {
        const isOnline = Array.from(agentSessions.values()).some(
            s => s.nodeId === node.id && s.authorized
        );
        return {
            id: node.id,
            alias: node.alias || node.hostname || 'Unknown',
            fingerprint: getKeyFingerprint(node.pubKey),
            isOnline
        };
    });
});

// Rotate CP key
fastify.post('/api/admin/security/rotate-cp-key', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    // Generate new keys
    const newKeys = rotateCPKeys();
    console.log('🔐 CP keys rotated by admin');

    // Broadcast new public key to all connected agents
    let notifiedCount = 0;
    agentSessions.forEach(session => {
        if (session.authorized) {
            const signedCmd = createSignedCommand('CP_KEY_ROTATION', {
                newPublicKey: newKeys.publicKey
            });
            session.socket.send(JSON.stringify(signedCmd));
            notifiedCount++;
        }
    });

    return {
        success: true,
        fingerprint: getKeyFingerprint(newKeys.publicKey),
        agentsNotified: notifiedCount
    };
});

// Rotate agent key
fastify.post('/api/admin/security/rotate-agent-key/:nodeId', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { nodeId } = req.params as { nodeId: string };
    const node = await db.select().from(schema.nodes).where(eq(schema.nodes.id, nodeId)).get();
    if (!node) {
        return reply.status(404).send({ error: 'Server not found' });
    }

    // Find the agent session
    let agentSession: any = null;
    agentSessions.forEach(session => {
        if (session.nodeId === nodeId && session.authorized) {
            agentSession = session;
        }
    });

    if (!agentSession) {
        return reply.status(400).send({ error: 'Agent is offline. Cannot rotate key.' });
    }

    // Generate a new registration token for re-registration
    const token = randomUUID();
    await db.insert(schema.registrationTokens).values({
        id: token,
        ownerId: node.ownerId,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    }).run();

    // Send command to agent to regenerate identity
    const signedCmd = createSignedCommand('REGENERATE_IDENTITY', {
        registrationToken: token
    });
    agentSession.socket.send(JSON.stringify(signedCmd));

    return {
        success: true,
        message: 'Agent will regenerate identity and re-register'
    };
});

// Public endpoint to get CP public key (for install.sh)
fastify.get('/api/security/public-key', async () => {
    return {
        publicKey: getCPPublicKey(),
        algorithm: 'Ed25519'
    };
});

// ============ MANAGED SERVERS API ============

// Get provider status
fastify.get('/api/managed-servers/providers', async () => {
    return getProviderStatuses();
});

// Get all VPS plans
fastify.get('/api/managed-servers/plans', async () => {
    return await getVPSPlans();
});

// Get all VPS regions
fastify.get('/api/managed-servers/regions', async () => {
    return await getVPSRegions();
});

// Get user's managed servers
fastify.get('/api/managed-servers', async (req) => {
    const userId = (req as any).userId;
    const servers = await db.select()
        .from(schema.managedServers)
        .where(eq(schema.managedServers.userId, userId))
        .all();

    return servers;
});

// Provision a new managed server
fastify.post('/api/managed-servers', async (req, reply) => {
    const userId = (req as any).userId;
    const { provider, planId, regionId, name } = req.body as {
        provider: Provider;
        planId: string;
        regionId: string;
        name: string;
    };

    // Check server limit
    const limitCheck = await checkUsageLimit(userId, 'server');
    if (!limitCheck.allowed) {
        return reply.status(403).send({
            error: 'LIMIT_EXCEEDED',
            resource: 'server',
            current: limitCheck.current,
            limit: limitCheck.limit,
            message: limitCheck.message,
            upgradeUrl: '/billing'
        });
    }

    // Create registration token for the new server
    const agentToken = randomUUID();
    await db.insert(schema.registrationTokens).values({
        id: agentToken,
        ownerId: userId,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    }).run();

    // Get control plane URL for cloud-init
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL || `http://${getLocalIpAddress()}:3000`;

    try {
        // Provision the server
        const server = await provisionServer(
            provider,
            planId,
            regionId,
            name,
            agentToken,
            controlPlaneUrl
        );

        // Save to database
        const managedServerId = randomUUID();
        await db.insert(schema.managedServers).values({
            id: managedServerId,
            userId,
            provider,
            providerServerId: server.providerId,
            hostname: server.name,
            serverType: server.plan,
            providerRegion: regionId,
            ipAddress: server.ipv4 || null,
            status: 'provisioning',
            monthlyCostCents: 0, // Will be updated later
            provisionedAt: Math.floor(Date.now() / 1000)
        }).run();

        addActivityLog(userId, 'managed_server_created', { provider, name, plan: planId }, undefined, 'success');

        return {
            ...server,
            id: managedServerId, // Override the provider's id with our internal id
            agentToken,
            message: 'Server provisioning started. It will connect automatically once ready.'
        };
    } catch (error: any) {
        console.error('Failed to provision server:', error);
        return reply.status(500).send({
            error: 'PROVISION_FAILED',
            message: error.message || 'Failed to provision server'
        });
    }
});

// Get managed server details
fastify.get('/api/managed-servers/:id', async (req, reply) => {
    const userId = (req as any).userId;
    const { id } = req.params as { id: string };

    const server = await db.select()
        .from(schema.managedServers)
        .where(and(
            eq(schema.managedServers.id, id),
            eq(schema.managedServers.userId, userId)
        ))
        .get();

    if (!server) {
        return reply.status(404).send({ error: 'Server not found' });
    }

    // Get current status from provider (if providerServerId exists)
    let providerStatus = null;
    if (server.providerServerId) {
        providerStatus = await getServerStatus(server.provider as Provider, server.providerServerId);
    }

    return {
        ...server,
        providerStatus
    };
});

// Delete managed server
fastify.delete('/api/managed-servers/:id', async (req, reply) => {
    const userId = (req as any).userId;
    const { id } = req.params as { id: string };

    const server = await db.select()
        .from(schema.managedServers)
        .where(and(
            eq(schema.managedServers.id, id),
            eq(schema.managedServers.userId, userId)
        ))
        .get();

    if (!server) {
        return reply.status(404).send({ error: 'Server not found' });
    }

    try {
        // Delete from provider (if providerServerId exists)
        if (server.providerServerId) {
            await deleteProvisionedServer(server.provider as Provider, server.providerServerId);
        }

        // Delete from database
        await db.delete(schema.managedServers)
            .where(eq(schema.managedServers.id, id))
            .run();

        // Also delete associated node if exists
        if (server.nodeId) {
            await db.delete(schema.nodes)
                .where(eq(schema.nodes.id, server.nodeId))
                .run();
        }

        addActivityLog(userId, 'managed_server_deleted', { provider: server.provider, hostname: server.hostname }, undefined, 'info');

        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete server:', error);
        return reply.status(500).send({
            error: 'DELETE_FAILED',
            message: error.message || 'Failed to delete server'
        });
    }
});

// ============================================
// NODE (SERVER) DELETION
// ============================================

/**
 * **DELETE /api/nodes/:id**
 * Supprime un serveur connecté (node) et toutes ses ressources associées.
 * - Envoie SHUTDOWN_AGENT à l'agent si connecté
 * - Supprime en cascade: apps, domaines (proxyConfigs)
 * - Supprime le node de la base de données
 * - Timeout de 10 secondes pour attendre l'ACK de l'agent
 */
fastify.delete<{ Params: { id: string }, Querystring: { action?: 'stop' | 'uninstall' } }>('/api/nodes/:id', async (req, reply) => {
    const userId = (req as any).userId;
    const { id } = req.params;
    const action = req.query.action || 'stop'; // Par défaut: arrêter sans désinstaller

    // Vérifier que le node appartient à l'utilisateur
    const node = await db.select()
        .from(schema.nodes)
        .where(and(
            eq(schema.nodes.id, id),
            eq(schema.nodes.ownerId, userId)
        ))
        .get();

    if (!node) {
        return reply.status(404).send({ error: 'NODE_NOT_FOUND', message: 'Server not found' });
    }

    // Trouver la session de l'agent si connecté
    const agentSession = Array.from(agentSessions.values()).find(
        sess => sess.nodeId === id && sess.authorized
    );

    let agentAcknowledged = false;

    // Envoyer SHUTDOWN_AGENT si l'agent est connecté
    if (agentSession) {
        try {
            // Créer une promesse pour attendre l'ACK
            const ackPromise = new Promise<boolean>((resolve) => {
                const timeout = setTimeout(() => resolve(false), 10000); // 10 secondes

                // Écouter l'ACK (on le fera via le socket)
                const originalOnMessage = agentSession.socket.onmessage;
                agentSession.socket.onmessage = (event: MessageEvent) => {
                    try {
                        const msg = JSON.parse(event.data.toString());
                        if (msg.type === 'AGENT_SHUTDOWN_ACK' && msg.serverId === id) {
                            clearTimeout(timeout);
                            agentSession.socket.onmessage = originalOnMessage;
                            resolve(true);
                        } else if (originalOnMessage) {
                            originalOnMessage.call(agentSession.socket, event);
                        }
                    } catch {
                        if (originalOnMessage) {
                            originalOnMessage.call(agentSession.socket, event);
                        }
                    }
                };
            });

            // Envoyer la commande SHUTDOWN_AGENT
            agentSession.socket.send(JSON.stringify({
                type: 'SHUTDOWN_AGENT',
                serverId: id,
                action
            }));

            // Attendre l'ACK (max 10 secondes)
            agentAcknowledged = await ackPromise;
        } catch (e) {
            console.error('Error sending SHUTDOWN_AGENT:', e);
        }
    }

    try {
        // Supprimer les apps associées au node
        const deletedApps = await db.delete(schema.apps)
            .where(eq(schema.apps.nodeId, id))
            .returning()
            .all();

        // Supprimer les proxies (domaines) associées au node
        const deletedProxies = await db.delete(schema.proxies)
            .where(eq(schema.proxies.nodeId, id))
            .returning()
            .all();

        // Supprimer le managed server associé (si existe)
        await db.delete(schema.managedServers)
            .where(eq(schema.managedServers.nodeId, id))
            .run();

        // Supprimer le node
        await db.delete(schema.nodes)
            .where(eq(schema.nodes.id, id))
            .run();

        // Supprimer la session de l'agent de la map
        if (agentSession) {
            for (const [connId, sess] of agentSessions.entries()) {
                if (sess.nodeId === id) {
                    agentSessions.delete(connId);
                    break;
                }
            }
        }

        // Logger l'activité
        addActivityLog(userId, 'node_deleted', {
            nodeId: id,
            nodeName: node.alias || node.hostname || id,
            nodeIp: node.ip,
            action,
            agentAcknowledged,
            deletedApps: deletedApps.length,
            deletedDomains: deletedProxies.length
        }, undefined, 'info');

        // Notifier tous les dashboards de la suppression
        broadcastToDashboards({ type: 'SERVER_STATUS', serverId: id, status: 'offline' });

        return {
            success: true,
            agentOnline: !!agentSession,
            agentAcknowledged,
            deletedApps: deletedApps.length,
            deletedDomains: deletedProxies.length
        };
    } catch (error: any) {
        console.error('Failed to delete node:', error);
        return reply.status(500).send({
            error: 'DELETE_FAILED',
            message: error.message || 'Failed to delete server'
        });
    }
});

// ============================================
// SUPPORT TICKET SYSTEM
// ============================================

// Helper: Find auto-response based on keywords
async function findAutoResponse(subject: string, content: string, category: string): Promise<string | null> {
    const searchText = `${subject} ${content}`.toLowerCase();

    const responses = await db.select()
        .from(schema.cannedResponses)
        .where(eq(schema.cannedResponses.isAutoResponse, true))
        .all();

    for (const response of responses) {
        // Check category match
        if (response.category && response.category !== category) continue;

        // Check keywords
        if (response.keywords) {
            const keywords = response.keywords.toLowerCase().split(',').map(k => k.trim());
            const hasMatch = keywords.some(keyword => searchText.includes(keyword));
            if (hasMatch) {
                return response.content;
            }
        }
    }

    return null;
}

// User: List my tickets
fastify.get('/api/support/tickets', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const tickets = await db.select({
        id: schema.supportTickets.id,
        subject: schema.supportTickets.subject,
        category: schema.supportTickets.category,
        priority: schema.supportTickets.priority,
        status: schema.supportTickets.status,
        lastMessageAt: schema.supportTickets.lastMessageAt,
        createdAt: schema.supportTickets.createdAt
    })
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.userId, userId))
    .orderBy(desc(schema.supportTickets.lastMessageAt))
    .all();

    // Count unread messages for each ticket
    const ticketsWithUnread = await Promise.all(tickets.map(async (ticket) => {
        const unreadCount = await db.select({ count: sql<number>`count(*)` })
            .from(schema.ticketMessages)
            .where(and(
                eq(schema.ticketMessages.ticketId, ticket.id),
                sql`${schema.ticketMessages.senderType} != 'user'`,
                sql`${schema.ticketMessages.readAt} IS NULL`
            ))
            .get();
        return { ...ticket, unreadCount: unreadCount?.count || 0 };
    }));

    return ticketsWithUnread;
});

// User: Create a new ticket
fastify.post('/api/support/tickets', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { subject, message, category = 'general', priority = 'normal' } = req.body as any;

    if (!subject?.trim() || !message?.trim()) {
        return reply.status(400).send({ error: 'Subject and message are required' });
    }

    const ticketId = randomUUID();
    const messageId = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Create ticket
    await db.insert(schema.supportTickets).values({
        id: ticketId,
        userId,
        subject: subject.trim(),
        category,
        priority,
        status: 'open',
        lastMessageAt: now,
        createdAt: now
    }).run();

    // Create initial message
    await db.insert(schema.ticketMessages).values({
        id: messageId,
        ticketId,
        senderId: userId,
        senderType: 'user',
        content: message.trim(),
        createdAt: now
    }).run();

    // Check for auto-response
    const autoResponse = await findAutoResponse(subject, message, category);
    if (autoResponse) {
        await db.insert(schema.ticketMessages).values({
            id: randomUUID(),
            ticketId,
            senderId: null,
            senderType: 'ai',
            content: autoResponse,
            createdAt: now + 1
        }).run();

        await db.update(schema.supportTickets)
            .set({ lastMessageAt: now + 1 })
            .where(eq(schema.supportTickets.id, ticketId))
            .run();
    }

    addActivityLog(userId, 'support_ticket_created', { ticketId, subject, category });

    return {
        success: true,
        ticketId,
        hasAutoResponse: !!autoResponse
    };
});

// User: Get ticket details with messages
fastify.get('/api/support/tickets/:id', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = req.params as any;

    const ticket = await db.select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, id))
        .get();

    if (!ticket) {
        return reply.status(404).send({ error: 'Ticket not found' });
    }

    // Check ownership (unless admin)
    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (ticket.userId !== userId && user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Access denied' });
    }

    // Get messages (hide internal notes for regular users)
    const isAdmin = user?.role === 'admin';
    const messagesQuery = db.select({
        id: schema.ticketMessages.id,
        senderId: schema.ticketMessages.senderId,
        senderType: schema.ticketMessages.senderType,
        content: schema.ticketMessages.content,
        isInternal: schema.ticketMessages.isInternal,
        createdAt: schema.ticketMessages.createdAt
    })
    .from(schema.ticketMessages)
    .where(
        isAdmin
            ? eq(schema.ticketMessages.ticketId, id)
            : and(
                eq(schema.ticketMessages.ticketId, id),
                eq(schema.ticketMessages.isInternal, false)
            )
    )
    .orderBy(schema.ticketMessages.createdAt);

    const messages = await messagesQuery.all();

    // Get attachments
    const attachments = await db.select({
        id: schema.ticketAttachments.id,
        messageId: schema.ticketAttachments.messageId,
        fileName: schema.ticketAttachments.fileName,
        fileSize: schema.ticketAttachments.fileSize,
        mimeType: schema.ticketAttachments.mimeType,
        createdAt: schema.ticketAttachments.createdAt
    })
    .from(schema.ticketAttachments)
    .where(eq(schema.ticketAttachments.ticketId, id))
    .all();

    // Mark messages as read for user
    if (ticket.userId === userId) {
        const now = Math.floor(Date.now() / 1000);
        await db.update(schema.ticketMessages)
            .set({ readAt: now })
            .where(and(
                eq(schema.ticketMessages.ticketId, id),
                sql`${schema.ticketMessages.senderType} != 'user'`,
                sql`${schema.ticketMessages.readAt} IS NULL`
            ))
            .run();
    }

    // Get sender names
    const senderIds = [...new Set(messages.map(m => m.senderId).filter(Boolean))] as string[];
    const senders: Record<string, { name: string | null; avatarUrl: string | null }> = {};

    for (const senderId of senderIds) {
        const sender = await db.select({ name: schema.users.name, avatarUrl: schema.users.avatarUrl })
            .from(schema.users)
            .where(eq(schema.users.id, senderId))
            .get();
        if (sender) {
            senders[senderId] = sender;
        }
    }

    return {
        ticket,
        messages: messages.map(m => ({
            ...m,
            senderName: m.senderId ? senders[m.senderId]?.name : (m.senderType === 'ai' ? 'AI Assistant' : 'System'),
            senderAvatar: m.senderId ? senders[m.senderId]?.avatarUrl : null
        })),
        attachments
    };
});

// User: Send a message to a ticket
fastify.post('/api/support/tickets/:id/messages', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = req.params as any;
    const { content } = req.body as any;

    if (!content?.trim()) {
        return reply.status(400).send({ error: 'Message content is required' });
    }

    const ticket = await db.select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, id))
        .get();

    if (!ticket) {
        return reply.status(404).send({ error: 'Ticket not found' });
    }

    if (ticket.userId !== userId) {
        return reply.status(403).send({ error: 'Access denied' });
    }

    if (ticket.status === 'closed') {
        return reply.status(400).send({ error: 'Cannot reply to a closed ticket' });
    }

    const messageId = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(schema.ticketMessages).values({
        id: messageId,
        ticketId: id,
        senderId: userId,
        senderType: 'user',
        content: content.trim(),
        createdAt: now
    }).run();

    // Update ticket last message time and set to open if was resolved
    await db.update(schema.supportTickets)
        .set({
            lastMessageAt: now,
            status: ticket.status === 'resolved' ? 'open' : ticket.status
        })
        .where(eq(schema.supportTickets.id, id))
        .run();

    return { success: true, messageId };
});

// User: Upload attachment
fastify.post('/api/support/tickets/:id/attachments', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = req.params as any;

    const ticket = await db.select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, id))
        .get();

    if (!ticket) {
        return reply.status(404).send({ error: 'Ticket not found' });
    }

    // Check ownership or admin
    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (ticket.userId !== userId && user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Access denied' });
    }

    const files = await req.files();
    const uploadedFiles: any[] = [];

    for await (const file of files) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/zip'];
        if (!allowedTypes.includes(file.mimetype)) {
            continue; // Skip unsupported file types
        }

        const attachmentId = randomUUID();
        const ext = path.extname(file.filename) || '';
        const storagePath = `tickets/${id}/${attachmentId}${ext}`;
        const fullPath = path.join(__dirname, '../uploads', storagePath);

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Save file
        const buffer = await file.toBuffer();
        fs.writeFileSync(fullPath, buffer);

        // Save to database
        await db.insert(schema.ticketAttachments).values({
            id: attachmentId,
            ticketId: id,
            fileName: file.filename,
            fileSize: buffer.length,
            mimeType: file.mimetype,
            storagePath,
            uploadedBy: userId,
            createdAt: Math.floor(Date.now() / 1000)
        }).run();

        uploadedFiles.push({
            id: attachmentId,
            fileName: file.filename,
            fileSize: buffer.length,
            mimeType: file.mimetype
        });
    }

    return { success: true, files: uploadedFiles };
});

// User: Download attachment
fastify.get('/api/support/attachments/:id', async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = req.params as any;

    const attachment = await db.select()
        .from(schema.ticketAttachments)
        .where(eq(schema.ticketAttachments.id, id))
        .get();

    if (!attachment) {
        return reply.status(404).send({ error: 'Attachment not found' });
    }

    // Check access via ticket ownership
    const ticket = await db.select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, attachment.ticketId))
        .get();

    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (ticket?.userId !== userId && user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Access denied' });
    }

    const fullPath = path.join(__dirname, '../uploads', attachment.storagePath);
    if (!fs.existsSync(fullPath)) {
        return reply.status(404).send({ error: 'File not found' });
    }

    reply.header('Content-Type', attachment.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
    return fs.createReadStream(fullPath);
});

// ============================================
// ADMIN SUPPORT ENDPOINTS
// ============================================

// Admin: List all tickets
fastify.get('/api/admin/support/tickets', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { status, category, priority, assignedTo } = req.query as any;

    let query = db.select({
        id: schema.supportTickets.id,
        userId: schema.supportTickets.userId,
        subject: schema.supportTickets.subject,
        category: schema.supportTickets.category,
        priority: schema.supportTickets.priority,
        status: schema.supportTickets.status,
        assignedTo: schema.supportTickets.assignedTo,
        lastMessageAt: schema.supportTickets.lastMessageAt,
        createdAt: schema.supportTickets.createdAt
    })
    .from(schema.supportTickets)
    .orderBy(desc(schema.supportTickets.lastMessageAt));

    const tickets = await query.all();

    // Filter in JS for simplicity (could optimize with dynamic where clauses)
    let filtered = tickets;
    if (status) filtered = filtered.filter(t => t.status === status);
    if (category) filtered = filtered.filter(t => t.category === category);
    if (priority) filtered = filtered.filter(t => t.priority === priority);
    if (assignedTo) filtered = filtered.filter(t => t.assignedTo === assignedTo);

    // Get user info for each ticket
    const ticketsWithUsers = await Promise.all(filtered.map(async (ticket) => {
        const user = await db.select({ name: schema.users.name, email: schema.users.email })
            .from(schema.users)
            .where(eq(schema.users.id, ticket.userId))
            .get();

        const unreadCount = await db.select({ count: sql<number>`count(*)` })
            .from(schema.ticketMessages)
            .where(and(
                eq(schema.ticketMessages.ticketId, ticket.id),
                eq(schema.ticketMessages.senderType, 'user'),
                sql`${schema.ticketMessages.readAt} IS NULL`
            ))
            .get();

        return {
            ...ticket,
            userName: user?.name || 'Unknown',
            userEmail: user?.email,
            unreadCount: unreadCount?.count || 0
        };
    }));

    return ticketsWithUsers;
});

// Admin: Update ticket (status, priority, assign)
fastify.patch('/api/admin/support/tickets/:id', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const adminId = (req as any).userId;
    const { id } = req.params as any;
    const { status, priority, assignedTo } = req.body as any;

    const ticket = await db.select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, id))
        .get();

    if (!ticket) {
        return reply.status(404).send({ error: 'Ticket not found' });
    }

    const updates: any = {};
    const now = Math.floor(Date.now() / 1000);

    if (status) {
        updates.status = status;
        if (status === 'resolved') updates.resolvedAt = now;
        if (status === 'closed') updates.closedAt = now;
    }
    if (priority) updates.priority = priority;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo || null;

    await db.update(schema.supportTickets)
        .set(updates)
        .where(eq(schema.supportTickets.id, id))
        .run();

    // Add system message for status change
    if (status && status !== ticket.status) {
        await db.insert(schema.ticketMessages).values({
            id: randomUUID(),
            ticketId: id,
            senderId: adminId,
            senderType: 'system',
            content: `Ticket status changed to "${status}"`,
            createdAt: now
        }).run();
    }

    addActivityLog(adminId, 'support_ticket_updated', { ticketId: id, updates });

    return { success: true };
});

// Admin: Reply to ticket
fastify.post('/api/admin/support/tickets/:id/reply', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const adminId = (req as any).userId;
    const { id } = req.params as any;
    const { content, isInternal = false } = req.body as any;

    if (!content?.trim()) {
        return reply.status(400).send({ error: 'Message content is required' });
    }

    const ticket = await db.select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, id))
        .get();

    if (!ticket) {
        return reply.status(404).send({ error: 'Ticket not found' });
    }

    const messageId = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(schema.ticketMessages).values({
        id: messageId,
        ticketId: id,
        senderId: adminId,
        senderType: 'admin',
        content: content.trim(),
        isInternal,
        createdAt: now
    }).run();

    // Update ticket
    const updates: any = { lastMessageAt: now };
    if (ticket.status === 'open') {
        updates.status = 'in_progress';
    }
    if (!ticket.assignedTo) {
        updates.assignedTo = adminId;
    }

    await db.update(schema.supportTickets)
        .set(updates)
        .where(eq(schema.supportTickets.id, id))
        .run();

    // Mark user messages as read
    await db.update(schema.ticketMessages)
        .set({ readAt: now })
        .where(and(
            eq(schema.ticketMessages.ticketId, id),
            eq(schema.ticketMessages.senderType, 'user'),
            sql`${schema.ticketMessages.readAt} IS NULL`
        ))
        .run();

    return { success: true, messageId };
});

// Admin: Get canned responses
fastify.get('/api/admin/support/canned-responses', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const responses = await db.select()
        .from(schema.cannedResponses)
        .orderBy(schema.cannedResponses.sortOrder)
        .all();

    return responses;
});

// Admin: Create canned response
fastify.post('/api/admin/support/canned-responses', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const adminId = (req as any).userId;
    const { title, content, category, keywords, isAutoResponse = false, sortOrder = 0 } = req.body as any;

    if (!title?.trim() || !content?.trim()) {
        return reply.status(400).send({ error: 'Title and content are required' });
    }

    const responseId = randomUUID();

    await db.insert(schema.cannedResponses).values({
        id: responseId,
        title: title.trim(),
        content: content.trim(),
        category: category || null,
        keywords: keywords || null,
        isAutoResponse,
        sortOrder,
        createdBy: adminId,
        createdAt: Math.floor(Date.now() / 1000)
    }).run();

    return { success: true, id: responseId };
});

// Admin: Update canned response
fastify.patch('/api/admin/support/canned-responses/:id', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { id } = req.params as any;
    const { title, content, category, keywords, isAutoResponse, sortOrder } = req.body as any;

    const existing = await db.select()
        .from(schema.cannedResponses)
        .where(eq(schema.cannedResponses.id, id))
        .get();

    if (!existing) {
        return reply.status(404).send({ error: 'Canned response not found' });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined) updates.category = category || null;
    if (keywords !== undefined) updates.keywords = keywords || null;
    if (isAutoResponse !== undefined) updates.isAutoResponse = isAutoResponse;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    await db.update(schema.cannedResponses)
        .set(updates)
        .where(eq(schema.cannedResponses.id, id))
        .run();

    return { success: true };
});

// Admin: Delete canned response
fastify.delete('/api/admin/support/canned-responses/:id', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const { id } = req.params as any;

    await db.delete(schema.cannedResponses)
        .where(eq(schema.cannedResponses.id, id))
        .run();

    return { success: true };
});

// Admin: Support metrics
fastify.get('/api/admin/support/metrics', async (req, reply) => {
    await requireAdmin(req, reply);
    if (reply.sent) return;

    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 86400;
    const weekAgo = now - 604800;

    // Total tickets by status
    const openTickets = await db.select({ count: sql<number>`count(*)` })
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.status, 'open'))
        .get();

    const inProgressTickets = await db.select({ count: sql<number>`count(*)` })
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.status, 'in_progress'))
        .get();

    const resolvedTickets = await db.select({ count: sql<number>`count(*)` })
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.status, 'resolved'))
        .get();

    // New tickets this week
    const newThisWeek = await db.select({ count: sql<number>`count(*)` })
        .from(schema.supportTickets)
        .where(sql`${schema.supportTickets.createdAt} >= ${weekAgo}`)
        .get();

    // Unread messages count
    const unreadMessages = await db.select({ count: sql<number>`count(*)` })
        .from(schema.ticketMessages)
        .where(and(
            eq(schema.ticketMessages.senderType, 'user'),
            sql`${schema.ticketMessages.readAt} IS NULL`
        ))
        .get();

    return {
        openTickets: openTickets?.count || 0,
        inProgressTickets: inProgressTickets?.count || 0,
        resolvedTickets: resolvedTickets?.count || 0,
        newThisWeek: newThisWeek?.count || 0,
        unreadMessages: unreadMessages?.count || 0
    };
});

// Initialize default free plan on startup
createDefaultFreePlan().catch(console.error);

fastify.listen({ port: 3000, host: '0.0.0.0' }).then(() => console.log('🚀 Engine Online'));
