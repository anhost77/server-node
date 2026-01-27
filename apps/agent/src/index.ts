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
import { InfrastructureManager, type RuntimeType, type DatabaseType, type ServiceType } from './infrastructure.js';
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
        // Try flat bundle structure first (new structure: package.json at root)
        const rootPkgPath = path.join(BUNDLE_DIR, 'package.json');
        if (fs.existsSync(rootPkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
            return pkg.version || '0.0.0';
        }
        // Fallback to nested structure (old structure: apps/agent/package.json)
        const agentPkgPath = path.join(BUNDLE_DIR, 'apps', 'agent', 'package.json');
        if (fs.existsSync(agentPkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(agentPkgPath, 'utf-8'));
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
                        const { spawn } = await import('node:child_process');
                        const { exec } = await import('node:child_process');
                        const { promisify } = await import('node:util');
                        const execAsync = promisify(exec);

                        // Helper to send log lines
                        const sendLog = (data: string, stream: 'stdout' | 'stderr' = 'stdout') => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({
                                    type: 'AGENT_UPDATE_LOG',
                                    serverId: currentServerId,
                                    data,
                                    stream
                                }));
                            }
                        };

                        // Helper to run command with streaming output
                        const runWithLogs = (cmd: string, args: string[], cwd?: string): Promise<void> => {
                            return new Promise((resolve, reject) => {
                                sendLog(`$ ${cmd} ${args.join(' ')}\n`);
                                const proc = spawn(cmd, args, { cwd: cwd || '/tmp', shell: true });

                                proc.stdout?.on('data', (data) => {
                                    sendLog(data.toString());
                                });

                                proc.stderr?.on('data', (data) => {
                                    sendLog(data.toString(), 'stderr');
                                });

                                proc.on('close', (code) => {
                                    if (code === 0) {
                                        resolve();
                                    } else {
                                        reject(new Error(`Command exited with code ${code}`));
                                    }
                                });

                                proc.on('error', reject);
                            });
                        };

                        sendStatus('downloading', 'Downloading latest agent bundle...');
                        sendLog('📦 Downloading agent bundle...\n');

                        // Download new bundle
                        const bundleUrl = `${controlPlaneUrl}/agent-bundle.tar.gz`;
                        const tempBundle = path.join(os.tmpdir(), 'agent-bundle-update.tar.gz');

                        await runWithLogs('curl', ['-L', '--progress-bar', `"${bundleUrl}"`, '-o', `"${tempBundle}"`]);
                        sendLog('✅ Download complete\n');

                        sendStatus('installing', 'Installing update...');
                        sendLog('\n📂 Extracting bundle...\n');

                        // Backup current bundle (just in case)
                        const backupDir = path.join(os.homedir(), '.server-flow', 'agent-bundle-backup');
                        if (fs.existsSync(BUNDLE_DIR)) {
                            if (fs.existsSync(backupDir)) {
                                fs.rmSync(backupDir, { recursive: true });
                            }
                            fs.renameSync(BUNDLE_DIR, backupDir);
                            sendLog('📁 Backed up old version\n');
                        }

                        // Extract new bundle
                        fs.mkdirSync(BUNDLE_DIR, { recursive: true });
                        // Use /tmp as cwd to avoid getcwd() errors when bundle dir changes
                        await runWithLogs('tar', ['-xzf', `"${tempBundle}"`, '-C', `"${BUNDLE_DIR}"`, '--no-same-owner']);
                        fs.unlinkSync(tempBundle);
                        sendLog('✅ Extraction complete\n');

                        // Preserve @server-flow/shared before cleaning node_modules
                        // (this package is bundled locally, not available on npm)
                        const nodeModulesDir = path.join(BUNDLE_DIR, 'node_modules');
                        const sharedPkgDir = path.join(nodeModulesDir, '@server-flow', 'shared');
                        const sharedBackupDir = path.join(os.tmpdir(), 'server-flow-shared-backup');

                        // Backup @server-flow/shared if it exists in the extracted bundle
                        if (fs.existsSync(sharedPkgDir)) {
                            sendLog('📦 Preserving @server-flow/shared...\n');
                            if (fs.existsSync(sharedBackupDir)) {
                                fs.rmSync(sharedBackupDir, { recursive: true });
                            }
                            fs.cpSync(sharedPkgDir, sharedBackupDir, { recursive: true });
                        }

                        // Clean node_modules before install (pnpm structure breaks npm)
                        if (fs.existsSync(nodeModulesDir)) {
                            sendLog('🧹 Cleaning old node_modules...\n');
                            fs.rmSync(nodeModulesDir, { recursive: true });
                        }

                        // Install dependencies (use cwd option, not cd command, to avoid getcwd errors)
                        sendStatus('installing', 'Installing dependencies...');
                        sendLog('\n📥 Installing dependencies...\n');

                        try {
                            await runWithLogs('pnpm', ['install', '--prod', '--ignore-scripts'], BUNDLE_DIR);
                        } catch {
                            // Fallback to npm if pnpm fails
                            sendLog('⚠️ pnpm failed, trying npm...\n');
                            await runWithLogs('npm', ['install', '--omit=dev', '--ignore-scripts'], BUNDLE_DIR);
                        }
                        sendLog('✅ Dependencies installed\n');

                        // Restore @server-flow/shared from backup
                        const sharedDest = path.join(nodeModulesDir, '@server-flow', 'shared');
                        if (fs.existsSync(sharedBackupDir) && !fs.existsSync(sharedDest)) {
                            sendLog('🔗 Restoring @server-flow/shared...\n');
                            fs.mkdirSync(path.join(nodeModulesDir, '@server-flow'), { recursive: true });
                            fs.cpSync(sharedBackupDir, sharedDest, { recursive: true });
                            fs.rmSync(sharedBackupDir, { recursive: true });
                            sendLog('✅ Shared package restored\n');
                        }

                        // Read new version
                        const newVersion = getAgentVersion();
                        sendLog(`\n🆕 New version: ${newVersion}\n`);

                        // Update systemd service file to match new bundle structure
                        sendLog('\n🔧 Updating systemd service configuration...\n');
                        const systemdServicePath = '/etc/systemd/system/server-flow-agent.service';
                        const newServiceContent = `[Unit]
Description=ServerFlow Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${BUNDLE_DIR}
ExecStart=/usr/bin/node ${BUNDLE_DIR}/dist/index.js --url ${controlPlaneUrl}
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;
                        try {
                            // Write new service file
                            await execAsync(`echo '${newServiceContent.replace(/'/g, "'\\''")}' | sudo tee ${systemdServicePath} > /dev/null`);
                            await execAsync('sudo systemctl daemon-reload');
                            sendLog('✅ Systemd service updated\n');
                        } catch (svcErr: any) {
                            sendLog(`⚠️ Warning: Could not update systemd service: ${svcErr.message}\n`, 'stderr');
                        }

                        sendStatus('restarting', 'Restarting agent...', newVersion);
                        sendLog('\n🔄 Restarting agent service...\n');

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

            // Handle GET_INFRASTRUCTURE_LOGS (read logs from file)
            if (raw.type === 'GET_INFRASTRUCTURE_LOGS') {
                const lines = raw.lines as number | undefined;
                const logs = InfrastructureManager.readLogs(lines);
                ws.send(JSON.stringify({
                    type: 'INFRASTRUCTURE_LOGS_RESPONSE',
                    serverId: currentServerId,
                    logs,
                    logFilePath: InfrastructureManager.getLogFilePath()
                }));
                return;
            }

            // Handle CLEAR_INFRASTRUCTURE_LOGS (clear logs file)
            if (raw.type === 'CLEAR_INFRASTRUCTURE_LOGS') {
                InfrastructureManager.clearLogs();
                ws.send(JSON.stringify({
                    type: 'INFRASTRUCTURE_LOGS_CLEARED',
                    serverId: currentServerId
                }));
                return;
            }

            // Handle GET_SERVICE_LOGS (read logs for a specific service/runtime)
            if (raw.type === 'GET_SERVICE_LOGS') {
                const service = raw.service as string;
                const lines = raw.lines as number | undefined;
                const logs = InfrastructureManager.readServiceLogs(service, lines);
                const hasLogs = InfrastructureManager.hasServiceLogs(service);
                ws.send(JSON.stringify({
                    type: 'SERVICE_LOGS_RESPONSE',
                    serverId: currentServerId,
                    service,
                    logs,
                    logFilePath: InfrastructureManager.getServiceLogFilePath(service),
                    hasLogs
                }));
                return;
            }

            // Handle REMOVE_RUNTIME (Story 7.7 Extension)
            if (raw.type === 'REMOVE_RUNTIME') {
                const runtime = raw.runtime as RuntimeType;
                const purge = raw.purge as boolean;
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
                infraManager.uninstallRuntime(runtime, purge).then(result => {
                    ws.send(JSON.stringify({
                        type: 'RUNTIME_REMOVED',
                        serverId: currentServerId,
                        runtime,
                        success: result.success,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle REMOVE_DATABASE (Story 7.7 Extension)
            if (raw.type === 'REMOVE_DATABASE') {
                const database = raw.database as DatabaseType;
                const purge = raw.purge as boolean;
                const removeData = raw.removeData as boolean;
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
                infraManager.removeDatabase(database, purge, removeData).then(result => {
                    ws.send(JSON.stringify({
                        type: 'DATABASE_REMOVED',
                        serverId: currentServerId,
                        database,
                        success: result.success,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle RECONFIGURE_DATABASE (Story 7.7 Extension)
            if (raw.type === 'RECONFIGURE_DATABASE') {
                const database = raw.database as DatabaseType;
                const dbName = raw.dbName as string;
                const resetPassword = raw.resetPassword as boolean;
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
                infraManager.reconfigureDatabase(database, dbName, resetPassword).then(result => {
                    ws.send(JSON.stringify({
                        type: 'DATABASE_RECONFIGURED',
                        serverId: currentServerId,
                        database,
                        success: result.success,
                        connectionString: result.connectionString,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle INSTALL_SERVICE (Network, Security, Monitoring services)
            if (raw.type === 'INSTALL_SERVICE') {
                const service = raw.service as ServiceType;
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
                infraManager.installService(service).then(result => {
                    ws.send(JSON.stringify({
                        type: 'SERVICE_INSTALLED',
                        serverId: currentServerId,
                        service,
                        success: result.success,
                        version: result.version,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle CONFIGURE_MAIL_STACK - Installation et configuration complète de la stack mail
            if (raw.type === 'CONFIGURE_MAIL_STACK') {
                const config = raw.config as {
                    domain: string;
                    hostname: string;
                    services: string[];
                    security: { tls: string; dkimKeySize: number; spf: boolean; dmarc: boolean };
                };
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
                infraManager.configureMailStack(config).then(result => {
                    ws.send(JSON.stringify({
                        type: 'MAIL_STACK_CONFIGURED',
                        serverId: currentServerId,
                        success: result.success,
                        dkimPublicKey: result.dkimPublicKey,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle CONFIGURE_DNS_STACK - Installation et configuration complète du serveur DNS
            if (raw.type === 'CONFIGURE_DNS_STACK') {
                const config = raw.config as {
                    architecture: 'primary' | 'primary-secondary' | 'cache' | 'split-horizon';
                    hostname: string;
                    forwarders: string[];
                    localNetwork: string;
                    zones: Array<{ name: string; type: 'master' | 'forward'; ttl: number }>;
                    createReverseZone: boolean;
                    security: {
                        dnssec: { enabled: boolean; algorithm: string; autoRotate: boolean };
                        tsig: { enabled: boolean };
                        rrl: { enabled: boolean; responsesPerSecond: number; window: number };
                        logging: boolean;
                    };
                    serverIp: string;
                };
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
                infraManager.configureDnsStack(config).then(() => {
                    ws.send(JSON.stringify({
                        type: 'DNS_STACK_CONFIGURED',
                        serverId: currentServerId,
                        success: true
                    }));
                }).catch((error: Error) => {
                    ws.send(JSON.stringify({
                        type: 'DNS_STACK_CONFIGURED',
                        serverId: currentServerId,
                        success: false,
                        error: error.message
                    }));
                });
                return;
            }

            // Handle REMOVE_SERVICE
            if (raw.type === 'REMOVE_SERVICE') {
                const service = raw.service as ServiceType;
                const purge = raw.purge as boolean;
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
                infraManager.removeService(service, purge).then(result => {
                    ws.send(JSON.stringify({
                        type: 'SERVICE_REMOVED',
                        serverId: currentServerId,
                        service,
                        success: result.success,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle START_SERVICE
            if (raw.type === 'START_SERVICE') {
                const service = raw.service as ServiceType;
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
                infraManager.startService(service).then(result => {
                    ws.send(JSON.stringify({
                        type: 'SERVICE_STARTED',
                        serverId: currentServerId,
                        service,
                        success: result.success,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle STOP_SERVICE
            if (raw.type === 'STOP_SERVICE') {
                const service = raw.service as ServiceType;
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
                infraManager.stopService(service).then(result => {
                    ws.send(JSON.stringify({
                        type: 'SERVICE_STOPPED',
                        serverId: currentServerId,
                        service,
                        success: result.success,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle START_DATABASE
            if (raw.type === 'START_DATABASE') {
                const database = raw.database as DatabaseType;
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
                infraManager.startDatabase(database).then(result => {
                    ws.send(JSON.stringify({
                        type: 'DATABASE_STARTED',
                        serverId: currentServerId,
                        database,
                        success: result.success,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle STOP_DATABASE
            if (raw.type === 'STOP_DATABASE') {
                const database = raw.database as DatabaseType;
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
                infraManager.stopDatabase(database).then(result => {
                    ws.send(JSON.stringify({
                        type: 'DATABASE_STOPPED',
                        serverId: currentServerId,
                        database,
                        success: result.success,
                        error: result.error
                    }));
                });
                return;
            }

            // Handle SHUTDOWN_AGENT (server deletion from dashboard)
            if (raw.type === 'SHUTDOWN_AGENT') {
                const action = raw.action as 'stop' | 'uninstall';
                console.log(`🛑 Received SHUTDOWN_AGENT command (action: ${action})`);

                // Send acknowledgment before shutting down
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'AGENT_SHUTDOWN_ACK',
                        serverId: currentServerId,
                        action
                    }));
                }

                (async () => {
                    try {
                        const { exec } = await import('node:child_process');
                        const { promisify } = await import('node:util');
                        const execAsync = promisify(exec);

                        // Close WebSocket connection
                        ws.close();

                        if (action === 'uninstall') {
                            // Full uninstall: remove everything
                            console.log('🗑️ Uninstalling ServerFlow Agent...');

                            // Stop and disable the systemd service
                            try {
                                await execAsync('sudo systemctl stop server-flow-agent');
                                await execAsync('sudo systemctl disable server-flow-agent');
                                await execAsync('sudo rm -f /etc/systemd/system/server-flow-agent.service');
                                await execAsync('sudo systemctl daemon-reload');
                            } catch (e) {
                                console.log('Note: systemd cleanup may have partially failed');
                            }

                            // Stop all pm2 processes managed by this agent
                            try {
                                await execAsync('pm2 delete all');
                            } catch (e) {
                                // pm2 might not be running
                            }

                            // Remove the .server-flow directory
                            const serverFlowDir = path.join(os.homedir(), '.server-flow');
                            if (fs.existsSync(serverFlowDir)) {
                                fs.rmSync(serverFlowDir, { recursive: true, force: true });
                            }

                            console.log('✅ Uninstall complete');
                        } else {
                            // Just stop: disable service but keep files
                            console.log('⏹️ Stopping ServerFlow Agent...');

                            try {
                                await execAsync('sudo systemctl stop server-flow-agent');
                                await execAsync('sudo systemctl disable server-flow-agent');
                            } catch (e) {
                                // Fallback: just exit
                            }

                            console.log('✅ Agent stopped');
                        }

                        // Exit the process
                        process.exit(0);
                    } catch (err: any) {
                        console.error('Shutdown error:', err.message);
                        process.exit(1);
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
            else if (msg.type === 'UPDATE_RUNTIME') {
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
                infraManager.updateRuntime(runtime).then(result => {
                    ws.send(JSON.stringify({
                        type: 'RUNTIME_UPDATED',
                        serverId: currentServerId,
                        runtime,
                        success: result.success,
                        oldVersion: result.oldVersion,
                        newVersion: result.newVersion,
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
