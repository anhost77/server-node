import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, verify } from 'node:crypto';
import { AgentMessageSchema, ServerMessage } from '@server-flow/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
    logger: true
});

// Serve installer script
fastify.register(staticFiles, {
    root: path.join(__dirname, '../public'),
    prefix: '/'
});

fastify.register(websocket);

// Data structures (To be moved to DB later)
interface Session {
    nonce: string;
    pubKey?: string;
    socket: any;
    authorized: boolean;
}

const sessions = new Map<string, Session>();
const registrationTokens = new Map<string, { userId: string, expires: number }>();
const registeredServers = new Map<string, { pubKey: string }>(); // PubKey -> ServerInfo

// API: Generate Registration Token
fastify.post('/api/servers/token', async (request, reply) => {
    const token = randomUUID();
    registrationTokens.set(token, { userId: 'default-user', expires: Date.now() + 10 * 60 * 1000 });
    return { token };
});

// WebSocket Handshake Handler
fastify.register(async function (fastify) {
    fastify.get('/api/connect', { websocket: true }, (connection, req) => {
        const socket = connection.socket;
        const connectionId = randomUUID();

        console.log('Client connected', connectionId);

        socket.on('message', (message: Buffer) => {
            try {
                const raw = JSON.parse(message.toString());
                const parsed = AgentMessageSchema.safeParse(raw);

                if (!parsed.success) {
                    console.error('Invalid agent message', parsed.error);
                    return;
                }

                const msg = parsed.data;

                if (msg.type === 'CONNECT') {
                    const server = registeredServers.get(msg.pubKey);
                    if (!server) {
                        const response: ServerMessage = { type: 'ERROR', message: 'Server not registered.' };
                        socket.send(JSON.stringify(response));
                        return;
                    }

                    const nonce = randomUUID();
                    sessions.set(connectionId, { nonce, pubKey: msg.pubKey, socket, authorized: false });
                    const response: ServerMessage = { type: 'CHALLENGE', nonce };
                    socket.send(JSON.stringify(response));
                }
                else if (msg.type === 'RESPONSE') {
                    const session = sessions.get(connectionId);
                    if (!session || !session.pubKey) {
                        socket.close(1008, 'Session invalid');
                        return;
                    }

                    const isValid = verify(
                        undefined,
                        Buffer.from(session.nonce),
                        { key: session.pubKey, format: 'pem', type: 'spki' },
                        Buffer.from(msg.signature, 'base64')
                    );

                    if (isValid) {
                        session.authorized = true;
                        const response: ServerMessage = { type: 'AUTHORIZED', sessionId: connectionId };
                        socket.send(JSON.stringify(response));
                    } else {
                        socket.close();
                    }
                }
                else if (msg.type === 'REGISTER') {
                    const tokenData = registrationTokens.get(msg.token);
                    if (!tokenData || tokenData.expires < Date.now()) {
                        const response: ServerMessage = { type: 'ERROR', message: 'Invalid token' };
                        socket.send(JSON.stringify(response));
                        return;
                    }

                    registeredServers.set(msg.pubKey, { pubKey: msg.pubKey });
                    registrationTokens.delete(msg.token);

                    const response: ServerMessage = { type: 'REGISTERED', serverId: randomUUID() };
                    socket.send(JSON.stringify(response));
                }

            } catch (err) {
                console.error('Processing error', err);
            }
        });

        socket.on('close', () => {
            sessions.delete(connectionId);
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
