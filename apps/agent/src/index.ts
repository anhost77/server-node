import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getOrGenerateIdentity, signData } from './identity.js';
import { ExecutionManager } from './execution.js';
import { AgentMessage, ServerMessageSchema } from '@server-flow/shared';

const CONFIG_DIR = path.join(os.homedir(), '.server-flow');
const REG_FILE = path.join(CONFIG_DIR, 'registration.json');

const fastify = Fastify({ logger: true });
const identity = getOrGenerateIdentity();

// Simple CLI arg parsing
const args = process.argv.slice(2);
const tokenIndex = args.indexOf('--token');
const registrationToken = tokenIndex !== -1 ? args[tokenIndex + 1] : null;

function saveRegistration(data: any) {
    fs.writeFileSync(REG_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function isRegistered() {
    return fs.existsSync(REG_FILE);
}

// Agent Server
fastify.register(websocket);
fastify.get('/', async () => ({ hello: 'agent', registered: isRegistered() }));

// Execution Manager setup
let controlPlaneWs: WebSocket | null = null;

const executor = new ExecutionManager((data, stream) => {
    if (controlPlaneWs && controlPlaneWs.readyState === 1) {
        // Find a way to associate this log with current repoUrl if possible, 
        // or just stream raw with enough metadata.
        // For now, using a global "current task" pattern or just raw stream.
    }
});

// Connect Logic
function connectToControlPlane() {
    const ws = new WebSocket('ws://localhost:3000/api/connect');
    controlPlaneWs = ws;

    ws.on('open', () => {
        console.log('🔗 Connected to Control Plane');
        if (registrationToken) {
            ws.send(JSON.stringify({ type: 'REGISTER', token: registrationToken, pubKey: identity.publicKey }));
        } else {
            ws.send(JSON.stringify({ type: 'CONNECT', pubKey: identity.publicKey }));
        }
    });

    ws.on('message', (data) => {
        try {
            const raw = JSON.parse(data.toString());
            const parsed = ServerMessageSchema.safeParse(raw);
            if (!parsed.success) return;

            const msg = parsed.data;

            if (msg.type === 'CHALLENGE') {
                const signature = signData(msg.nonce, identity.privateKey);
                ws.send(JSON.stringify({ type: 'RESPONSE', signature }));
            }
            else if (msg.type === 'AUTHORIZED') {
                console.log('✅ Agent Authorized');
            }
            else if (msg.type === 'REGISTERED') {
                console.log('✨ Server Registered');
                saveRegistration({ serverId: msg.serverId });
            }
            else if (msg.type === 'DEPLOY') {
                console.log(`🚀 DEPLOY TRIGGERED: ${msg.repoUrl} @ ${msg.commitHash}`);

                const logExecutor = new ExecutionManager((logData, stream) => {
                    ws.send(JSON.stringify({
                        type: 'LOG_STREAM',
                        data: logData,
                        stream,
                        repoUrl: msg.repoUrl
                    }));
                });

                ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: 'cloning' }));

                logExecutor.deploy({
                    repoUrl: msg.repoUrl,
                    commitHash: msg.commitHash,
                    branch: msg.branch
                }).then(success => {
                    ws.send(JSON.stringify({
                        type: 'STATUS_UPDATE',
                        repoUrl: msg.repoUrl,
                        status: success ? 'success' : 'failure'
                    }));
                });
            }
            else if (msg.type === 'ERROR') {
                console.error('❌ Server Error:', msg.message);
            }
        } catch (err) {
            console.error('Processing error', err);
        }
    });

    ws.on('close', () => {
        console.log('Disconnected. Retrying in 5s...');
        setTimeout(connectToControlPlane, 5000);
    });

    ws.on('error', (err) => console.error('WS Error:', err.message));
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
