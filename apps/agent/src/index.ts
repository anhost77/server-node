import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getOrGenerateIdentity, signData, regenerateIdentity } from './identity.js';
import { ExecutionManager } from './execution.js';
import { NginxManager } from './nginx.js';
import { ProcessManager } from './process.js';
import { SystemMonitor } from './monitor.js';
import { InfrastructureManager, type RuntimeType, type DatabaseType } from './infrastructure.js';
import { AgentMessage, ServerMessageSchema } from '@server-flow/shared';
import {
    verifyCommand,
    saveCPPublicKey,
    hasCPPublicKey,
    requiresSignature,
    isProtocolMessage,
    type SignedCommand
} from './security/verifier.js';

const CONFIG_DIR = path.join(os.homedir(), '.server-flow');
const REG_FILE = path.join(CONFIG_DIR, 'registration.json');
const BUNDLE_DIR = path.join(os.homedir(), '.server-flow', 'agent-bundle');

// Read agent version from package.json
function getAgentVersion(): string {
    try {
        const pkgPath = path.join(BUNDLE_DIR, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            return pkg.version || '0.0.0';
        }
    } catch { }
    return '0.0.0';
}

const AGENT_VERSION = getAgentVersion();

const fastify = Fastify({ logger: false });
const identity = getOrGenerateIdentity();
// Global process manager for lifecycle actions
let activeWs: WebSocket | null = null;
const processManager = new ProcessManager((data, stream) => {
    if (activeWs && activeWs.readyState === WebSocket.OPEN && currentServerId) {
        activeWs.send(JSON.stringify({
            type: 'SYSTEM_LOG',
            serverId: currentServerId,
            data,
            stream,
            source: 'application'
        }));
    }
});
processManager.startLogStreaming();

const args = process.argv.slice(2);
// ... existing args logic ...
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

function loadRegistration() {
    if (fs.existsSync(REG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(REG_FILE, 'utf-8'));
        } catch (e) { return null; }
    }
    return null;
}

// System Monitor with log streaming
let currentServerId: string | null = loadRegistration()?.serverId || null;
let healthCheckInterval: NodeJS.Timeout | null = null;

// Durable Reconnection Logic
function connectToControlPlane() {
    const wsBaseUrl = controlPlaneUrl.replace('http', 'ws');
    console.log(`📡 Attempting connection to ${wsBaseUrl}/api/connect...`);

    const ws = new WebSocket(`${wsBaseUrl}/api/connect`);
    activeWs = ws;

    // System monitor with WebSocket logging
    const monitor = new SystemMonitor((data, stream, source) => {
        if (ws.readyState === WebSocket.OPEN && currentServerId) {
            ws.send(JSON.stringify({
                type: 'SYSTEM_LOG',
                serverId: currentServerId,
                data,
                stream,
                source
            }));
        }
    }, controlPlaneUrl);

    // Safety timeout if connection hangs
    const connectionTimeout = setTimeout(() => {
        console.log('⌛ Connection attempt timed out. Retrying...');
        monitor.logConnection('error', 'Connection timeout');
        ws.terminate();
    }, 10000);

    ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('🔗 Connected to Control Plane');
        monitor.logConnection('connecting', 'Establishing secure channel...');

        if (registrationToken && !isRegistered()) {
            ws.send(JSON.stringify({ type: 'REGISTER', token: registrationToken, pubKey: identity.publicKey, version: AGENT_VERSION }));
        } else {
            ws.send(JSON.stringify({ type: 'CONNECT', pubKey: identity.publicKey, version: AGENT_VERSION }));
        }
    });

    ws.on('message', (data) => {
        try {
            const raw = JSON.parse(data.toString());

            // Handle CP_KEY_ROTATION (update stored CP public key)
            if (raw.type === 'CP_KEY_ROTATION' && raw.payload?.newPublicKey) {
                // Verify this command first if we have a key
                if (hasCPPublicKey()) {
                    const verification = verifyCommand(raw as SignedCommand);
                    if (!verification.valid) {
                        console.error(`🚨 SECURITY: Rejected CP_KEY_ROTATION - ${verification.error}`);
                        return;
                    }
                }
                saveCPPublicKey(raw.payload.newPublicKey);
                console.log('🔐 CP public key updated via rotation');
                return;
            }

            // Handle REGENERATE_IDENTITY (for key rotation)
            if (raw.type === 'REGENERATE_IDENTITY' && raw.payload?.registrationToken) {
                // Verify this command first
                if (hasCPPublicKey()) {
                    const verification = verifyCommand(raw as SignedCommand);
                    if (!verification.valid) {
                        console.error(`🚨 SECURITY: Rejected REGENERATE_IDENTITY - ${verification.error}`);
                        return;
                    }
                }
                console.log('🔐 Regenerating agent identity...');
                const newIdentity = regenerateIdentity();
                // Clear registration and reconnect
                if (fs.existsSync(REG_FILE)) fs.unlinkSync(REG_FILE);
                currentServerId = null;
                // Re-register with new identity
                ws.send(JSON.stringify({
                    type: 'REGISTER',
                    token: raw.payload.registrationToken,
                    pubKey: newIdentity.publicKey
                }));
                return;
            }

            // Verify signed commands (DEPLOY, APP_ACTION, etc.)
            if (requiresSignature(raw.type)) {
                if (hasCPPublicKey()) {
                    const verification = verifyCommand(raw as SignedCommand);
                    if (!verification.valid) {
                        console.error(`🚨 SECURITY: Rejected command ${raw.type} - ${verification.error}`);
                        ws.send(JSON.stringify({
                            type: 'SECURITY_ALERT',
                            reason: verification.error,
                            rejectedCommand: raw.type
                        }));
                        return;
                    }
                    console.log(`✅ Verified command: ${raw.type}`);
                } else {
                    console.log(`⚠️ No CP key stored - accepting command ${raw.type} without verification`);
                }
                // For signed commands, the actual data is in payload
                if (raw.payload) {
                    Object.assign(raw, raw.payload);
                }
            }

            // Handle GET_LOGS separately (not in Zod schema - internal MCP message)
            if (raw.type === 'GET_LOGS') {
                (async () => {
                    const { requestId, logType, lines, filter } = raw;
                    const { exec } = await import('node:child_process');
                    const { promisify } = await import('node:util');
                    const execAsync = promisify(exec);

                    const logPaths: Record<string, string> = {
                        'nginx-access': '/var/log/nginx/access.log',
                        'nginx-error': '/var/log/nginx/error.log',
                        'system': '/var/log/syslog'
                    };

                    try {
                        let logs = '';
                        if (logType === 'pm2') {
                            const { stdout } = await execAsync(`pm2 logs --lines ${lines} --nostream 2>&1 || echo "PM2 not available"`);
                            logs = stdout;
                        } else {
                            const logPath = logPaths[logType];
                            if (logPath && fs.existsSync(logPath)) {
                                const grepCmd = filter ? ` | grep -i "${filter.replace(/"/g, '\\"')}"` : '';
                                const { stdout } = await execAsync(`tail -n ${lines} "${logPath}"${grepCmd} 2>&1`);
                                logs = stdout;
                            } else {
                                logs = `Log file not found: ${logPath || logType}`;
                            }
                        }

                        ws.send(JSON.stringify({
                            type: 'LOG_RESPONSE',
                            requestId,
                            logs: logs.slice(0, 50000)
                        }));
                    } catch (err: any) {
                        ws.send(JSON.stringify({
                            type: 'LOG_RESPONSE',
                            requestId,
                            error: `Failed to read logs: ${err.message}`
                        }));
                    }
                })();
                return;
            }

            // Handle UPDATE_AGENT (self-update mechanism)
            if (raw.type === 'UPDATE_AGENT') {
                const sendStatus = (status: string, message?: string, newVersion?: string) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'AGENT_UPDATE_STATUS',
                            serverId: currentServerId,
                            status,
                            message,
                            newVersion
                        }));
                    }
                };

                (async () => {
                    try {
                        const { exec } = await import('node:child_process');
                        const { promisify } = await import('node:util');
                        const execAsync = promisify(exec);

                        sendStatus('downloading', 'Downloading latest agent bundle...');

                        // Download new bundle
                        const bundleUrl = `${controlPlaneUrl}/agent-bundle.tar.gz`;
                        const tempBundle = path.join(os.tmpdir(), 'agent-bundle-update.tar.gz');

                        await execAsync(`curl -L --progress-bar "${bundleUrl}" -o "${tempBundle}"`);

                        sendStatus('installing', 'Installing update...');

                        // Backup current bundle (just in case)
                        const backupDir = path.join(os.homedir(), '.server-flow', 'agent-bundle-backup');
                        if (fs.existsSync(BUNDLE_DIR)) {
                            if (fs.existsSync(backupDir)) {
                                fs.rmSync(backupDir, { recursive: true });
                            }
                            fs.renameSync(BUNDLE_DIR, backupDir);
                        }

                        // Extract new bundle
                        fs.mkdirSync(BUNDLE_DIR, { recursive: true });
                        await execAsync(`tar -xzf "${tempBundle}" -C "${BUNDLE_DIR}" --no-same-owner`);
                        fs.unlinkSync(tempBundle);

                        // Install dependencies
                        await execAsync(`cd "${BUNDLE_DIR}" && pnpm install --prod 2>&1 || npm install --production 2>&1`);

                        // Read new version
                        const newVersion = getAgentVersion();

                        sendStatus('restarting', 'Restarting agent...', newVersion);

                        // Restart via systemd (the service will reconnect automatically)
                        setTimeout(async () => {
                            try {
                                await execAsync('sudo systemctl restart server-flow-agent');
                            } catch {
                                // If systemd fails, try pm2
                                try {
                                    await execAsync('pm2 restart serverflow-agent');
                                } catch {
                                    // Last resort: exit and let systemd restart us
                                    process.exit(0);
                                }
                            }
                        }, 1000);

                    } catch (err: any) {
                        sendStatus('failed', `Update failed: ${err.message}`);
                    }
                })();
                return;
            }

            const parsed = ServerMessageSchema.safeParse(raw);
            if (!parsed.success) {
                console.error('Validation Error:', parsed.error);
                return;
            }
            const msg = parsed.data;

            if (msg.type === 'CHALLENGE') {
                const signature = signData(msg.nonce, identity.privateKey);
                ws.send(JSON.stringify({ type: 'RESPONSE', signature }));
            }
            else if (msg.type === 'AUTHORIZED') {
                console.log('✅ Agent Authorized and Ready');
                monitor.logConnection('connected', 'Agent authorized and ready');

                // Helper to perform health check and send structured metrics
                const doHealthCheck = async () => {
                    const metrics = await monitor.performHealthCheck();
                    if (metrics && ws.readyState === WebSocket.OPEN && currentServerId) {
                        ws.send(JSON.stringify({
                            type: 'SYSTEM_LOG',
                            serverId: currentServerId,
                            data: '', // Empty data, metrics are in dedicated fields
                            stream: 'metrics',
                            source: 'metrics',
                            cpu: metrics.cpu,
                            ram: metrics.ram,
                            disk: metrics.disk,
                            ip: metrics.ip
                        }));
                    }
                };

                // Start health checks every 30 seconds
                if (healthCheckInterval) clearInterval(healthCheckInterval);
                healthCheckInterval = setInterval(() => doHealthCheck(), 30000);

                // Immediate health check
                setTimeout(() => doHealthCheck(), 2000);
            }
            else if (msg.type === 'REGISTERED') {
                console.log('✨ Server Registered Successfully');
                currentServerId = msg.serverId;
                monitor.logStartup();
                monitor.logConnection('connected', `Server registered: ${msg.serverId.slice(0, 12)}`);
                saveRegistration({ serverId: msg.serverId });
                // Save CP public key for command verification
                if (msg.cpPublicKey) {
                    saveCPPublicKey(msg.cpPublicKey);
                    console.log('🔐 CP public key saved for command verification');
                }
            }
            else if (msg.type === 'DEPLOY') {
                const executor = new ExecutionManager((d, s) => {
                    ws.send(JSON.stringify({ type: 'LOG_STREAM', data: d, stream: s, repoUrl: msg.repoUrl }));
                });
                ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: 'cloning' }));
                executor.deploy(msg, msg.port).then(async ({ success, buildSkipped, healthCheckFailed }) => {
                    let finalStatus = success ? (buildSkipped ? 'build_skipped' : 'success') : 'failure';
                    if (healthCheckFailed) {
                        finalStatus = 'rollback';
                    }
                    ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: msg.repoUrl, status: finalStatus }));

                    // After successful deploy, detect actual listening ports
                    if (success && !healthCheckFailed) {
                        const appName = msg.repoUrl.split('/').pop()?.replace('.git', '') || 'unnamed-app';
                        // Wait a bit for the app to fully start
                        setTimeout(async () => {
                            const detectedPorts = await processManager.getAppPorts(appName);
                            if (detectedPorts.length > 0) {
                                ws.send(JSON.stringify({
                                    type: 'DETECTED_PORTS',
                                    appId: msg.appId,
                                    repoUrl: msg.repoUrl,
                                    ports: detectedPorts
                                }));
                            }
                        }, 3000);
                    }
                });
            }
            else if (msg.type === 'APP_ACTION') {
                const { action, repoUrl } = msg;
                const appName = repoUrl.split('/').pop()?.replace('.git', '') || 'unnamed-app';

                ws.send(JSON.stringify({ type: 'LOG_STREAM', data: `Triggering ${action} for ${appName}...\n`, stream: 'stdout', repoUrl }));

                let promise;
                if (action === 'START') promise = processManager.startApp(appName, ''); // empty cwd for existing
                else if (action === 'STOP') promise = processManager.stopApp(appName);
                else if (action === 'RESTART') promise = processManager.restartApp(appName);
                else if (action === 'DELETE') promise = processManager.deleteApp(appName);

                promise?.then(() => {
                    ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl, status: `${action.toLowerCase()}_success` }));
                }).catch(err => {
                    ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl, status: `${action.toLowerCase()}_failed` }));
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
            else if (msg.type === 'DELETE_PROXY') {
                const nginx = new NginxManager((d, s) => {
                    if (ws.readyState === WebSocket.OPEN && currentServerId) {
                        ws.send(JSON.stringify({ type: 'SYSTEM_LOG', serverId: currentServerId, data: d, stream: s, source: 'nginx' }));
                    }
                });
                nginx.deleteConfig(msg.domain);
            }
            else if (msg.type === 'SERVICE_ACTION') {
                const { service, action } = msg;
                const logToWs = (d: string, s: 'stdout' | 'stderr') => {
                    if (ws.readyState === WebSocket.OPEN && currentServerId) {
                        ws.send(JSON.stringify({ type: 'SYSTEM_LOG', serverId: currentServerId, data: d, stream: s, source: service }));
                    }
                };
                const sendStatus = (status: string) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'STATUS_UPDATE', repoUrl: `service:${service}`, status }));
                    }
                };

                if (service === 'nginx') {
                    const nginx = new NginxManager(logToWs);
                    let promise: Promise<boolean>;
                    if (action === 'start') promise = nginx.start();
                    else if (action === 'stop') promise = nginx.stop();
                    else if (action === 'restart') promise = nginx.restart();
                    else promise = Promise.resolve(false);

                    promise.then(ok => {
                        sendStatus(ok ? `${action}_success` : `${action}_failed`);
                        if (action === 'restart' && ok) monitor.performHealthCheck();
                    });
                }
                else if (service === 'pm2') {
                    const actionStr = action as string;
                    logToWs(`🔧 ${actionStr.charAt(0).toUpperCase() + actionStr.slice(1)}ing PM2...\n`, 'stdout');
                    const pm2Action = actionStr === 'restart' ? 'restart all' : (actionStr === 'stop' ? 'stop all' : 'resurrect');
                    processManager.runPm2Command(pm2Action).then((ok: boolean) => {
                        logToWs(ok ? `✅ PM2 ${actionStr} completed\n` : `❌ PM2 ${actionStr} failed\n`, ok ? 'stdout' : 'stderr');
                        sendStatus(ok ? `${actionStr}_success` : `${actionStr}_failed`);
                    });
                }
            }
            // ============================================
            // Infrastructure Handlers (Story 7.7)
            // ============================================
            else if (msg.type === 'GET_SERVER_STATUS') {
                const infraManager = new InfrastructureManager((message, stream) => {
                    if (ws.readyState === WebSocket.OPEN && currentServerId) {
                        ws.send(JSON.stringify({
                            type: 'INFRASTRUCTURE_LOG',
                            serverId: currentServerId,
                            message,
                            stream
                        }));
                    }
                });
                infraManager.getServerStatus().then(status => {
                    ws.send(JSON.stringify({
                        type: 'SERVER_STATUS_RESPONSE',
                        serverId: currentServerId,
                        status
                    }));
                });
            }
            else if (msg.type === 'INSTALL_RUNTIME') {
                const runtime = msg.runtime as RuntimeType;
                const infraManager = new InfrastructureManager((message, stream) => {
                    if (ws.readyState === WebSocket.OPEN && currentServerId) {
                        ws.send(JSON.stringify({
                            type: 'INFRASTRUCTURE_LOG',
                            serverId: currentServerId,
                            message,
                            stream
                        }));
                    }
                });
                infraManager.installRuntime(runtime).then(result => {
                    ws.send(JSON.stringify({
                        type: 'RUNTIME_INSTALLED',
                        serverId: currentServerId,
                        runtime,
                        success: result.success,
                        version: result.version,
                        error: result.error
                    }));
                });
            }
            else if (msg.type === 'CONFIGURE_DATABASE') {
                const database = msg.database as DatabaseType;
                const dbName = msg.dbName;
                const infraManager = new InfrastructureManager((message, stream) => {
                    if (ws.readyState === WebSocket.OPEN && currentServerId) {
                        ws.send(JSON.stringify({
                            type: 'INFRASTRUCTURE_LOG',
                            serverId: currentServerId,
                            message,
                            stream
                        }));
                    }
                });
                infraManager.configureDatabase(database, dbName).then(result => {
                    ws.send(JSON.stringify({
                        type: 'DATABASE_CONFIGURED',
                        serverId: currentServerId,
                        database,
                        success: result.success,
                        connectionString: result.connectionString,
                        error: result.error
                    }));
                });
            }
        } catch (err) { }
    });

    ws.on('close', () => {
        console.log('❌ Connection lost. Reconnecting in 5s...');
        monitor.logConnection('disconnected', 'Connection lost, reconnecting...');

        // Stop health checks
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
        }

        setTimeout(connectToControlPlane, 5000);
    });

    ws.on('error', (err) => {
        console.error('⚠️ WebSocket Error:', err.message);
        monitor.logConnection('error', `WebSocket error: ${err.message}`);
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
