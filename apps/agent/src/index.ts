import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getOrGenerateIdentity, signData } from './identity.js';
import { ExecutionManager } from './execution.js';
import { NginxManager } from './nginx.js';
import { AgentMessage, ServerMessageSchema } from '@server-flow/shared';

const CONFIG_DIR = path.join(os.homedir(), '.server-flow');
const REG_FILE = path.join(CONFIG_DIR, 'registration.json');

const fastify = Fastify({ logger: false });
const identity = getOrGenerateIdentity();

const args = process.argv.slice(2);
const tokenIndex = args.indexOf('--token');
const registrationToken = tokenIndex !== -1 ? args[tokenIndex + 1] : null;

const urlIndex = args.indexOf('--url');
const controlPlaneUrl = urlIndex !== -1 ? args[urlIndex + 1] : 'http://localhost:3000';

function saveRegistration(data: any) {
    fs.writeFileSync(REG_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function isRegistered() {
    return fs.existsSync(REG_FILE);
}

// Durable Reconnection Logic
function connectToControlPlane() {
    const wsBaseUrl = controlPlaneUrl.replace('http', 'ws');
    console.log(`📡 Attempting connection to ${wsBaseUrl}/api/connect...`);

    const ws = new WebSocket(`${wsBaseUrl}/api/connect`);

    // Safety timeout if connection hangs
    const connectionTimeout = setTimeout(() => {
        console.log('⌛ Connection attempt timed out. Retrying...');
        ws.terminate();
    }, 10000);

    ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('🔗 Connected to Control Plane');
        if (registrationToken && !isRegistered()) {
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
                console.log('✅ Agent Authorized and Ready');
            }
            else if (msg.type === 'REGISTERED') {
                console.log('✨ Server Registered Successfully');
                saveRegistration({ serverId: msg.serverId });
            }
            else if (msg.type === 'DEPLOY') {
                const executor = new ExecutionManager((d, s) => {
                    ws.send(JSON.stringify({ type: 'LOG_STREAM', data: d, stream: s, repoUrl: msg.repoUrl }));
                });
                ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: 'cloning' }));
                executor.deploy(msg).then(({ success, buildSkipped, healthCheckFailed }) => {
                    let finalStatus = success ? (buildSkipped ? 'build_skipped' : 'success') : 'failure';
                    if (healthCheckFailed) {
                        finalStatus = 'rollback';
                        ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: 'health_check_failed' }));
                    }
                    ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: finalStatus }));
                });
            }
            else if (msg.type === 'PROVISION_DOMAIN') {
                const nginx = new NginxManager((d, s) => {
                    ws.send(JSON.stringify({ type: 'LOG_STREAM', data: d, stream: s, repoUrl: msg.repoUrl }));
                });
                ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: 'provisioning_nginx' }));
                nginx.provision(msg).then(ok => {
                    ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: ok ? 'nginx_ready' : 'failure' }));
                });
            }
        } catch (err) { }
    });

    ws.on('close', () => {
        console.log('❌ Connection lost. Reconnecting in 5s...');
        setTimeout(connectToControlPlane, 5000);
    });

    ws.on('error', (err) => {
        console.error('⚠️ WebSocket Error:', err.message);
    });
}

const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '127.0.0.1' });
        connectToControlPlane();
    } catch (err) {
        process.exit(1);
    }
};

start();
