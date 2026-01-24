import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { eq, and } from 'drizzle-orm';
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
fastify.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/auth') && req.url !== '/api/auth/me') return;
    if (req.url.startsWith('/api/connect')) return;
    if (req.url.startsWith('/api/servers/verify-token')) return;
    if (req.url === '/' || !req.url.startsWith('/api')) return;

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
                if (['PROVISION_DOMAIN', 'SERVICE_ACTION', 'APP_ACTION', 'DELETE_PROXY'].includes(msg.type)) {
                    const ok = await sendToAgentById(nodeId, msg, userId);
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

fastify.listen({ port: 3000, host: '0.0.0.0' }).then(() => console.log('🚀 Engine Online'));
