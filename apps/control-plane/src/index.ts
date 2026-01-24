import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from 'dotenv';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import cookie from '@fastify/cookie';
import bcrypt from 'bcryptjs';

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
interface AgentSession { pubKey: string; nodeId: string; socket: any; authorized: boolean; nonce?: string; }
const agentSessions = new Map<string, AgentSession>();
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
            session.socket.send(JSON.stringify(msg));
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

            if (dryRun) {
                return {
                    content: [{ type: "text", text: `[DRY RUN] Would deploy "${app.name}" from ${app.repoUrl} @ ${commitHash}` }],
                };
            }

            // Trigger actual deployment via WebSocket to agent
            const sent = await sendToAgentById(app.nodeId, { type: 'DEPLOY', appId: app.id, commitHash }, userId);
            if (sent) {
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

fastify.post('/api/apps', async (req) => {
    const userId = (req as any).userId;
    const body = req.body as any;
    const app = {
        id: randomUUID(),
        ownerId: userId,
        nodeId: body.serverId,
        name: body.name,
        repoUrl: body.repoUrl,
        port: body.port,
        env: JSON.stringify(body.env || {}),
        createdAt: Math.floor(Date.now() / 1000)
    };
    await db.insert(schema.apps).values(app).run();
    addActivityLog(userId, 'app_created', { name: app.name, repo: app.repoUrl }, app.nodeId, 'success');
    return app;
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

fastify.post('/api/apps/:id/deploy', async (req, reply) => {
    const userId = (req as any).userId;
    const { id } = (req.params as any);
    const { commitHash } = (req.body as any) || { commitHash: 'main' };
    const app = await db.select().from(schema.apps).where(and(eq(schema.apps.id, id), eq(schema.apps.ownerId, userId))).get();
    if (!app) return reply.status(404).send({ error: 'App not found' });
    const ok = await sendToAgentById(app.nodeId, {
        type: 'DEPLOY',
        repoUrl: app.repoUrl,
        commitHash: commitHash || 'main',
        port: app.port,
        env: JSON.parse(app.env || '{}')
    }, userId);

    if (ok) {
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

fastify.post('/api/servers/token', async (req) => {
    const userId = (req as any).userId;
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
            return { ...n, status: active ? 'online' : 'offline' };
        });

        socket.send(JSON.stringify({ type: 'INITIAL_STATE', servers: state, apps: userApps, proxies: userProxies }));

        socket.on('message', async (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());
                const nodeId = msg.serverId;

                // Combined Deploy + Domain Provision
                if (msg.type === 'DEPLOY_WITH_DOMAIN') {
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

                if (['PROVISION_DOMAIN', 'SERVICE_ACTION', 'APP_ACTION', 'DELETE_PROXY'].includes(msg.type)) {
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
                    console.log('📡 Agent connecting, pubKey:', msg.pubKey.substring(0, 10));
                    const node = await db.select().from(schema.nodes).where(eq(schema.nodes.pubKey, msg.pubKey)).get();
                    if (!node) return socket.send(JSON.stringify({ type: 'ERROR', message: 'Not registered' }));
                    agentSessions.set(connectionId, { pubKey: msg.pubKey, nodeId: node.id, socket, authorized: false, nonce });
                    socket.send(JSON.stringify({ type: 'CHALLENGE', nonce }));
                }
                else if (msg.type === 'RESPONSE') {
                    const sess = agentSessions.get(connectionId);
                    if (sess) {
                        sess.authorized = true;
                        console.log(`✅ Agent auth [${sess.nodeId}]`);
                        socket.send(JSON.stringify({ type: 'AUTHORIZED', sessionId: connectionId }));
                        broadcastToDashboards({ type: 'SERVER_STATUS', serverId: sess.nodeId, status: 'online' });
                    }
                }
                else if (msg.type === 'REGISTER') {
                    const tokenData = await db.select().from(schema.registrationTokens).where(eq(schema.registrationTokens.id, msg.token)).get();
                    if (!tokenData || tokenData.expiresAt < Date.now()) return socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid token' }));
                    const nodeId = randomUUID();
                    await db.insert(schema.nodes).values({ id: nodeId, ownerId: tokenData.ownerId, pubKey: msg.pubKey }).run();
                    console.log(`🚀 Node reg [${nodeId}]`);
                    agentSessions.set(connectionId, { pubKey: msg.pubKey, nodeId, socket, authorized: true });
                    socket.send(JSON.stringify({ type: 'REGISTERED', serverId: nodeId }));
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
                // Handle log response from agent
                else if (msg.type === 'LOG_RESPONSE') {
                    const pending = pendingLogRequests.get(msg.requestId);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        pendingLogRequests.delete(msg.requestId);
                        pending.resolve(msg.logs || msg.error || 'No logs returned');
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

fastify.get('/api/github/repos', async (req, reply) => {
    const token = req.headers['x-github-token'];
    if (!token) return reply.status(401).send({ error: 'Missing token' });
    const res = await fetch('https://api.github.com/user/repos?sort=updated', { headers: { 'Authorization': `Bearer ${token}` } });
    return await res.json();
});

fastify.get('/api/auth/github/login', async (req, reply) => {
    const CLIENT_ID = 'Ov23li2gv04BDMg0h9Tn';
    const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: 'http://localhost:3000/api/auth/github/callback', scope: 'repo user:email' });
    return reply.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

fastify.get('/api/auth/github/callback', async (req: any, reply) => {
    const code = req.query.code;
    const CLIENT_ID = 'Ov23li2gv04BDMg0h9Tn';
    const CLIENT_SECRET = '499e7cde652a6a626927923205903bf4d302b4ce';
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
    return reply.redirect(`http://localhost:5173/?gh_token=${tData.access_token}`);
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
                repoUrl: targetApp.repoUrl,
                commitHash,
                port: targetApp.port,
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

fastify.listen({ port: 3000, host: '0.0.0.0' }).then(() => console.log('🚀 Engine Online'));
