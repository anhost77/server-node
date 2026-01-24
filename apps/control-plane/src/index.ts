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

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'server-flow-secret';

const fastify = Fastify({ logger: false });
fastify.register(cors, { origin: true });
fastify.register(staticFiles, { root: path.join(__dirname, '../public'), prefix: '/' });
fastify.register(websocket);

// Persistence
let registeredServers = new Map<string, any>();
if (fs.existsSync(SERVERS_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf-8'));
        registeredServers = new Map(Object.entries(data));
        console.log(`[DB] Loaded ${registeredServers.size} servers`);
    } catch (e) { console.error('Failed to load servers.json', e); }
}

function saveServers() {
    const data = Object.fromEntries(registeredServers);
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2));
}

// State
interface Session {
    pubKey?: string;
    socket: any;
    authorized: boolean;
}
const agentSessions = new Map<string, Session>(); // ConnectionId -> Session
const dashboardSessions = new Set<any>();
const registrationTokens = new Map<string, any>();

function broadcastToDashboards(msg: any) {
    const payload = JSON.stringify(msg);
    dashboardSessions.forEach(socket => {
        if (socket.readyState === 1) socket.send(payload);
    });
}

function getSystemState() {
    return Array.from(registeredServers.values()).map(s => {
        const isOnline = Array.from(agentSessions.values()).some(sess => sess.pubKey === s.pubKey && sess.authorized);
        return { ...s, status: isOnline ? 'online' : 'offline' };
    });
}

// Routes
fastify.get('/api/servers/verify-token/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const tokenData = registrationTokens.get(token);

    if (tokenData && tokenData.expires > Date.now()) {
        return { valid: true };
    }

    return reply.status(401).send({ valid: false, message: 'Invalid or expired token' });
});

fastify.post('/api/servers/token', async () => {
    const token = randomUUID();
    registrationTokens.set(token, { expires: Date.now() + 600000 });
    return { token };
});

fastify.get('/api/internal/servers', async () => getSystemState());

// Webhook
fastify.post('/api/webhooks/github', async (req, res) => {
    // ... Simplified for demo
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
                    // Mock verify for demo speed
                    session.authorized = true;
                    const server = registeredServers.get(session.pubKey!);
                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId: server.id, status: 'online' });
                    socket.send(JSON.stringify({ type: 'AUTHORIZED', sessionId: connectionId }));
                }
                else if (msg.type === 'REGISTER') {
                    if (!registrationTokens.has(msg.token)) return;
                    const serverId = randomUUID();
                    const newServer = { id: serverId, pubKey: msg.pubKey, registeredAt: Date.now() };

                    registeredServers.set(msg.pubKey, newServer);
                    saveServers();

                    // CRITICAL: Mark as authorized session immediately
                    agentSessions.set(connectionId, { pubKey: msg.pubKey, socket, authorized: true });

                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId, status: 'online' });
                    socket.send(JSON.stringify({ type: 'REGISTERED', serverId }));
                }
                else if (msg.type === 'STATUS_UPDATE' || msg.type === 'LOG_STREAM') {
                    const session = agentSessions.get(connectionId);
                    if (!session?.pubKey) return;
                    const server = registeredServers.get(session.pubKey);
                    const forward = { ...msg, serverId: server.id };
                    if (msg.type === 'STATUS_UPDATE') forward.type = 'DEPLOY_STATUS';
                    if (msg.type === 'LOG_STREAM') forward.type = 'DEPLOY_LOG';
                    broadcastToDashboards(forward);
                }
            } catch (e) { }
        });

        socket.on('close', () => {
            const session = agentSessions.get(connectionId);
            if (session?.pubKey) {
                const server = registeredServers.get(session.pubKey);
                broadcastToDashboards({ type: 'SERVER_STATUS', serverId: server.id, status: 'offline' });
            }
            agentSessions.delete(connectionId);
        });
    });
});

fastify.listen({ port: 3000, host: '0.0.0.0' }).then(() => console.log('🚀 Ready on 3000'));
