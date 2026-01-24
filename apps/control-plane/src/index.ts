import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, verify, createHmac, timingSafeEqual } from 'node:crypto';
import { AgentMessageSchema, ServerMessage, ServerMessageSchema } from '@server-flow/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-logs.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'server-flow-secret';

const fastify = Fastify({ logger: false });
fastify.register(cors, { origin: true });
fastify.register(staticFiles, { root: path.join(__dirname, '../public'), prefix: '/' });
fastify.register(websocket);

// Persistence
let registeredServers = new Map<string, any>();
let auditLogs: any[] = [];

if (fs.existsSync(SERVERS_FILE)) {
    try {
        registeredServers = new Map(Object.entries(JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'))));
    } catch (e) { }
}

if (fs.existsSync(AUDIT_FILE)) {
    try {
        auditLogs = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
    } catch (e) { }
}

function saveServers() {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(Object.fromEntries(registeredServers), null, 2));
}

function addAuditLog(serverId: string, type: string, details: any, status: 'success' | 'failure' | 'info' = 'info') {
    const entry = {
        id: randomUUID(),
        timestamp: Date.now(),
        serverId,
        type,
        details,
        status
    };
    auditLogs.unshift(entry);
    if (auditLogs.length > 500) auditLogs.pop(); // Keep last 500
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditLogs, null, 2));
    broadcastToDashboards({ type: 'AUDIT_UPDATE', log: entry });
}

// State
interface Session {
    pubKey?: string;
    socket: any;
    authorized: boolean;
}
const agentSessions = new Map<string, Session>();
const dashboardSessions = new Set<any>();
const registrationTokens = new Map<string, any>();

function broadcastToDashboards(msg: any) {
    const payload = JSON.stringify(msg);
    dashboardSessions.forEach(socket => {
        if (socket.readyState === 1) socket.send(payload);
    });
}

function sendToAgentByRepo(repoUrl: string, msg: any) {
    const payload = JSON.stringify(msg);
    let sent = false;
    agentSessions.forEach(session => {
        if (session.authorized) {
            const server = registeredServers.get(session.pubKey!);
            if (server) {
                session.socket.send(payload);
                sent = true;
            }
        }
    });
    return sent;
}

function getSystemState() {
    return Array.from(registeredServers.values()).map(s => {
        const isOnline = Array.from(agentSessions.values()).some(sess => sess.pubKey === s.pubKey && sess.authorized);
        return { ...s, status: isOnline ? 'online' : 'offline' };
    });
}

// Routes
fastify.get('/api/audit/logs', async () => auditLogs);

fastify.get('/api/servers/verify-token/:token', async (request, reply) => {
    const { token } = (request.params as any);
    if (registrationTokens.has(token)) return { valid: true };
    return reply.status(401).send({ valid: false });
});

fastify.post('/api/servers/token', async () => {
    const token = randomUUID();
    registrationTokens.set(token, { expires: Date.now() + 600000 });
    return { token };
});

fastify.get('/api/internal/servers', async () => getSystemState());

// GitHub Webhook Handler
fastify.post('/api/webhooks/github', async (request) => {
    const payload: any = request.body;
    const repoUrl = payload?.repository?.clone_url;
    if (repoUrl) {
        addAuditLog('system', 'deployment_triggered', { repoUrl, commit: payload.after }, 'info');
        sendToAgentByRepo(repoUrl, { type: 'DEPLOY', repoUrl, commitHash: payload.after, branch: 'main' });
    }
    return { status: 'triggered' };
});

// WS
fastify.register(async function (fastify) {
    fastify.get('/api/dashboard/ws', { websocket: true }, (connection) => {
        const socket = connection.socket;
        dashboardSessions.add(socket);
        socket.send(JSON.stringify({ type: 'INITIAL_STATE', servers: getSystemState() }));
        socket.on('close', () => dashboardSessions.delete(socket));
    });

    fastify.get('/api/connect', { websocket: true }, (connection) => {
        const socket = connection.socket;
        const connectionId = randomUUID();
        let nonce = randomUUID();

        socket.on('message', (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'CONNECT') {
                    const server = registeredServers.get(msg.pubKey);
                    if (!server) return socket.send(JSON.stringify({ type: 'ERROR', message: 'Not registered' }));
                    agentSessions.set(connectionId, { pubKey: msg.pubKey, socket, authorized: false });
                    socket.send(JSON.stringify({ type: 'CHALLENGE', nonce }));
                }
                else if (msg.type === 'RESPONSE') {
                    const session = agentSessions.get(connectionId);
                    if (!session) return;
                    session.authorized = true;
                    const server = registeredServers.get(session.pubKey!);
                    addAuditLog(server.id, 'connection_established', {}, 'success');
                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId: server.id, status: 'online' });
                    socket.send(JSON.stringify({ type: 'AUTHORIZED', sessionId: connectionId }));
                }
                else if (msg.type === 'REGISTER') {
                    if (!registrationTokens.has(msg.token)) return;
                    const serverId = randomUUID();
                    const newServer = { id: serverId, pubKey: msg.pubKey, registeredAt: Date.now() };
                    registeredServers.set(msg.pubKey, newServer);
                    saveServers();
                    agentSessions.set(connectionId, { pubKey: msg.pubKey, socket, authorized: true });
                    addAuditLog(serverId, 'server_registered', {}, 'success');
                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId, status: 'online' });
                    socket.send(JSON.stringify({ type: 'REGISTERED', serverId }));
                    registrationTokens.delete(msg.token);
                }
                else if (msg.type === 'STATUS_UPDATE' || msg.type === 'LOG_STREAM') {
                    const session = agentSessions.get(connectionId);
                    if (!session?.pubKey) return;
                    const server = registeredServers.get(session.pubKey);

                    if (msg.type === 'STATUS_UPDATE') {
                        const statusClass = (msg.status === 'success' || msg.status === 'nginx_ready') ? 'success' :
                            (msg.status === 'failure' || msg.status === 'rollback') ? 'failure' : 'info';
                        addAuditLog(server.id, 'status_update', { status: msg.status, repo: msg.repoUrl }, statusClass);
                        broadcastToDashboards({ ...msg, serverId: server.id, type: 'DEPLOY_STATUS' });
                    }
                    if (msg.type === 'LOG_STREAM') {
                        broadcastToDashboards({ ...msg, serverId: server.id, type: 'DEPLOY_LOG' });
                    }
                }
            } catch (e) { }
        });

        socket.on('close', () => {
            const session = agentSessions.get(connectionId);
            if (session?.pubKey) {
                const server = registeredServers.get(session.pubKey);
                if (server) {
                    addAuditLog(server.id, 'connection_lost', {}, 'failure');
                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId: server.id, status: 'offline' });
                }
            }
            agentSessions.delete(connectionId);
        });
    });
});

fastify.listen({ port: 3000, host: '0.0.0.0' }).then(() => console.log('🚀 Control Plane auditing ready on 3000'));
