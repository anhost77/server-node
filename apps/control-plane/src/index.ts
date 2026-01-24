import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, verify } from 'node:crypto';
import { AgentMessageSchema, ServerMessage } from '@server-flow/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
    logger: true
});

fastify.register(cors, { origin: true });
fastify.register(staticFiles, { root: path.join(__dirname, '../public'), prefix: '/' });
fastify.register(websocket);

// State Management
interface Session {
    nonce: string;
    pubKey?: string;
    socket: any;
    authorized: boolean;
}

const agentSessions = new Map<string, Session>();
const dashboardSessions = new Set<any>(); // Simple set for MVP broadcast
const registrationTokens = new Map<string, { userId: string, expires: number }>();
const registeredServers = new Map<string, { id: string, pubKey: string, registeredAt: number }>();

function broadcastToDashboards(msg: ServerMessage) {
    const payload = JSON.stringify(msg);
    dashboardSessions.forEach(socket => {
        if (socket.readyState === 1) { // OPEN
            socket.send(payload);
        }
    });
}

// REST APIs
fastify.post('/api/servers/token', async () => {
    const token = randomUUID();
    registrationTokens.set(token, { userId: 'default-user', expires: Date.now() + 10 * 60 * 1000 });
    return { token };
});

// WebSocket Handlers
fastify.register(async function (fastify) {
    // 1. Dashboard Events Socket
    fastify.get('/api/dashboard/ws', { websocket: true }, (connection) => {
        const socket = connection.socket;
        dashboardSessions.add(socket);
        console.log('Dashboard connected');

        socket.on('close', () => {
            dashboardSessions.delete(socket);
            console.log('Dashboard disconnected');
        });
    });

    // 2. Agent Connection Socket
    fastify.get('/api/connect', { websocket: true }, (connection) => {
        const socket = connection.socket;
        const connectionId = randomUUID();

        socket.on('message', (message: Buffer) => {
            try {
                const raw = JSON.parse(message.toString());
                const parsed = AgentMessageSchema.safeParse(raw);
                if (!parsed.success) return;

                const msg = parsed.data;

                if (msg.type === 'CONNECT') {
                    const server = registeredServers.get(msg.pubKey);
                    if (!server) {
                        socket.send(JSON.stringify({ type: 'ERROR', message: 'Not registered' }));
                        return;
                    }

                    const nonce = randomUUID();
                    agentSessions.set(connectionId, { nonce, pubKey: msg.pubKey, socket, authorized: false });
                    socket.send(JSON.stringify({ type: 'CHALLENGE', nonce }));
                }
                else if (msg.type === 'RESPONSE') {
                    const session = agentSessions.get(connectionId);
                    if (!session || !session.pubKey) return;

                    const isValid = verify(
                        undefined, Buffer.from(session.nonce),
                        { key: session.pubKey, format: 'pem', type: 'spki' },
                        Buffer.from(msg.signature, 'base64')
                    );

                    if (isValid) {
                        session.authorized = true;
                        const server = registeredServers.get(session.pubKey);
                        if (server) {
                            broadcastToDashboards({ type: 'SERVER_STATUS', serverId: server.id, status: 'online' });
                        }
                        socket.send(JSON.stringify({ type: 'AUTHORIZED', sessionId: connectionId }));
                    } else {
                        socket.close();
                    }
                }
                else if (msg.type === 'REGISTER') {
                    const tokenData = registrationTokens.get(msg.token);
                    if (!tokenData || tokenData.expires < Date.now()) {
                        socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid token' }));
                        return;
                    }

                    const serverId = randomUUID();
                    registeredServers.set(msg.pubKey, { id: serverId, pubKey: msg.pubKey, registeredAt: Date.now() });
                    registrationTokens.delete(msg.token);

                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId, status: 'online' });
                    socket.send(JSON.stringify({ type: 'REGISTERED', serverId }));
                }

            } catch (err) {
                console.error('WS Error', err);
            }
        });

        socket.on('close', () => {
            const session = agentSessions.get(connectionId);
            if (session?.pubKey) {
                const server = registeredServers.get(session.pubKey);
                if (server) {
                    broadcastToDashboards({ type: 'SERVER_STATUS', serverId: server.id, status: 'offline' });
                }
            }
            agentSessions.delete(connectionId);
        });
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
