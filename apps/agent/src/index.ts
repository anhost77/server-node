import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { getOrGenerateIdentity, signData } from './identity';
import { AgentMessage, ServerMessageSchema } from '@server-flow/shared';

const fastify = Fastify({ logger: true });
const identity = getOrGenerateIdentity();

// Agent Server (Metrics/Local Control)
fastify.register(websocket);
fastify.get('/', async function handler(request, reply) {
    return { hello: 'agent', pubKey: identity.publicKey }
});

// Connect to Control Plane
function connectToControlPlane() {
    const ws = new WebSocket('ws://localhost:3000/api/connect');

    ws.on('open', () => {
        console.log('Connected to Control Plane');
        const msg: AgentMessage = { type: 'CONNECT', pubKey: identity.publicKey };
        ws.send(JSON.stringify(msg));
    });

    ws.on('message', (data) => {
        try {
            // Parse with Schema for safety
            const raw = JSON.parse(data.toString());
            const parsed = ServerMessageSchema.safeParse(raw);

            if (!parsed.success) {
                console.error('Invalid server message:', parsed.error);
                return;
            }

            const msg = parsed.data;

            if (msg.type === 'CHALLENGE') {
                console.log('Received Challenge:', msg.nonce);
                const signature = signData(msg.nonce, identity.privateKey);
                const response: AgentMessage = { type: 'RESPONSE', signature };
                ws.send(JSON.stringify(response));
            } else if (msg.type === 'AUTHORIZED') {
                console.log('✅ Agent Authorized! Session:', msg.sessionId);
            } else if (msg.type === 'ERROR') {
                console.error('❌ Server Error:', msg.message);
            }

        } catch (err) {
            console.error('Message processing error:', err);
        }
    });

    ws.on('close', () => {
        console.log('Disconnected. Retrying in 5s...');
        setTimeout(connectToControlPlane, 5000);
    });

    ws.on('error', (err) => {
        console.error('WS Error:', err.message);
    });
}

const start = async () => {
    try {
        await fastify.listen({ port: 3001 });
        connectToControlPlane();
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
