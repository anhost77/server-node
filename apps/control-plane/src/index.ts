import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { randomUUID, verify } from 'node:crypto';
import { AgentMessageSchema, ServerMessage } from '@server-flow/shared';

const fastify = Fastify({
    logger: true
});

fastify.register(websocket);

interface Session {
    nonce: string;
    pubKey?: string;
    socket: any;
    authorized: boolean;
}

const sessions = new Map<string, Session>(); // Socket -> Session

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

                    // Verify Signature for Ed25519
                    const isValid = verify(
                        undefined,
                        Buffer.from(session.nonce),
                        { key: session.pubKey, format: 'pem', type: 'spki' },
                        Buffer.from(msg.signature, 'base64')
                    );

                    if (isValid) {
                        session.authorized = true;
                        console.log(`✅ Agent ${connectionId} Authorized`);
                        const response: ServerMessage = { type: 'AUTHORIZED', sessionId: connectionId };
                        socket.send(JSON.stringify(response));
                    } else {
                        console.error(`❌ Agent ${connectionId} Failed Auth`);
                        const response: ServerMessage = { type: 'ERROR', message: 'Invalid Signature' };
                        socket.send(JSON.stringify(response));
                        socket.close();
                    }
                }

            } catch (err) {
                console.error('Processing error', err);
            }
        });

        socket.on('close', () => {
            sessions.delete(connectionId);
            console.log('Client disconnected', connectionId);
        });
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000 });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
