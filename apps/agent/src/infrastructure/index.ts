/**
 * @file apps/agent/src/infrastructure/index.ts
 * @description Gestionnaire d'infrastructure principal.
 * Ce fichier orchestre toutes les opérations d'infrastructure : détection,
 * installation, mise à jour et suppression des runtimes, bases de données et services.
 *
 * Story 7.7 - Dashboard-Driven Server Configuration
 *
 * @dependencies
 * - fs : Pour les opérations sur le système de fichiers
 * - os : Pour les informations système
 * - path : Pour la gestion des chemins
 *
 * @security
 * - Les credentials ne sont JAMAIS loggés
 * - Les fichiers de log sont stockés de manière sécurisée
 * - Les opérations privilégiées utilisent su/sudo selon le contexte
 *
 * @fonctions_principales
 * - getServerStatus() : Retourne l'état complet du serveur (avec cache)
 * - installRuntime() : Installe un runtime (Python, Go, Docker, etc.)
 * - configureDatabase() : Configure une base de données avec credentials
 * - installService() : Installe un service (nginx, pm2, etc.)
 * - startService/stopService() : Contrôle des services
 * - updateRuntime() : Met à jour un runtime
 * - removeService/removeDatabase/uninstallRuntime() : Suppression
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Re-export types for external use
export type {
    RuntimeType,
    DatabaseType,
    ServiceType,
    RuntimeInfo,
    DatabaseInfo,
    ServiceInfo,
    SystemInfo,
    ServerStatus,
    DbSecurityOptions,
    LogFn,
    InstallResult,
    DatabaseConfigResult,
    UpdateResult,
    OperationResult
} from './types.js';

export { PROTECTED_RUNTIMES, PROTECTED_SERVICES } from './types.js';

import type {
    RuntimeType,
    DatabaseType,
    ServiceType,
    ServerStatus,
    DbSecurityOptions,
    LogFn,
    InstallResult,
    DatabaseConfigResult,
    UpdateResult,
    OperationResult
} from './types.js';

import { PROTECTED_RUNTIMES, PROTECTED_SERVICES } from './types.js';

// Import helpers
import { runCommand, runCommandSilent, getCommandVersion } from './helpers.js';

// Import detection functions
import { detectRuntimes, detectDatabases, detectServices, getSystemInfo } from './detection/index.js';

// Import installers
import { runtimeInstallers, runtimeUpdaters, uninstallRuntime } from './installers/runtimes.js';
import { databaseConfigurators, removeDatabase, reconfigureDatabase } from './installers/databases.js';
import { serviceInstallers } from './installers/services/index.js';

// ============================================
// CONSTANTS
// ============================================

const LOG_DIR = path.join(os.homedir(), '.server-flow', 'logs');
const INFRASTRUCTURE_LOG_FILE = path.join(LOG_DIR, 'infrastructure.log');

// ============================================
// SERVICE NAME MAPPING
// ============================================

const SERVICE_NAMES: Record<ServiceType, string> = {
    nginx: 'nginx',
    haproxy: 'haproxy',
    keepalived: 'keepalived',
    certbot: 'certbot.timer',
    fail2ban: 'fail2ban',
    ufw: 'ufw',
    wireguard: 'wg-quick@wg0',
    pm2: 'pm2-root',
    netdata: 'netdata',
    loki: 'loki',
    bind9: 'named',
    postfix: 'postfix',
    dovecot: 'dovecot',
    rspamd: 'rspamd',
    opendkim: 'opendkim',
    clamav: 'clamav-daemon',
    'spf-policyd': '', // SPF policy runs via Postfix, not standalone
    rsync: '',
    rclone: '',
    restic: '',
    ssh: 'ssh',
    cron: 'cron',
    vsftpd: 'vsftpd',
    proftpd: 'proftpd',
    nfs: 'nfs-kernel-server'
};

const DATABASE_SERVICE_NAMES: Record<DatabaseType, string> = {
    postgresql: 'postgresql',
    mysql: 'mysql',
    redis: 'redis-server',
    mongodb: 'mongod'
};

// ============================================
// INFRASTRUCTURE MANAGER CLASS
// ============================================

/**
 * **InfrastructureManager** - Gestionnaire d'infrastructure serveur
 *
 * Cette classe est le point d'entrée principal pour toutes les opérations
 * d'infrastructure. Elle gère :
 * - La détection des runtimes, bases de données et services installés
 * - L'installation et la mise à jour des composants
 * - La configuration sécurisée des bases de données
 * - Le contrôle des services (start/stop)
 * - La suppression des composants
 *
 * Un cache statique de 5 secondes évite les détections répétées lors de
 * requêtes fréquentes (une nouvelle instance est créée à chaque message WebSocket).
 */
export class InfrastructureManager {
    private onLog: LogFn;
    private currentService: string | null = null;

    // Cache STATIQUE pour éviter les détections répétées (TTL: 5 secondes)
    private static statusCache: ServerStatus | null = null;
    private static statusCacheTimestamp: number = 0;
    private static readonly STATUS_CACHE_TTL_MS = 5000;

    constructor(onLog: LogFn) {
        // Ensure log directory exists
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        // Wrap onLog to also write to service-specific file
        this.onLog = (message: string, stream: 'stdout' | 'stderr') => {
            // Write to service-specific file if we have a current service
            if (this.currentService) {
                const timestamp = new Date().toISOString();
                const logLine = `[${timestamp}] [${stream}] ${message}`;
                const logFile = path.join(LOG_DIR, `${this.currentService}.log`);
                fs.appendFileSync(logFile, logLine);
            }

            // Also write to global infrastructure log
            const timestamp = new Date().toISOString();
            const logLine = `[${timestamp}] [${stream}] ${message}`;
            fs.appendFileSync(INFRASTRUCTURE_LOG_FILE, logLine);

            // Call original callback
            onLog(message, stream);
        };
    }

    /**
     * Set the current service being installed/updated (for log file naming)
     */
    setCurrentService(service: string | null): void {
        this.currentService = service;
    }

    /**
     * Get the path to the infrastructure log file
     */
    static getLogFilePath(): string {
        return INFRASTRUCTURE_LOG_FILE;
    }

    /**
     * Get the path to a service-specific log file
     */
    static getServiceLogFilePath(service: string): string {
        return path.join(LOG_DIR, `${service}.log`);
    }

    /**
     * Read the infrastructure logs from the file
     * @param lines Number of lines to read from the end (default: all)
     */
    static readLogs(lines?: number): string {
        if (!fs.existsSync(INFRASTRUCTURE_LOG_FILE)) {
            return '';
        }

        const content = fs.readFileSync(INFRASTRUCTURE_LOG_FILE, 'utf-8');

        if (!lines) {
            return content;
        }

        // Return last N lines
        const allLines = content.split('\n');
        return allLines.slice(-lines).join('\n');
    }

    /**
     * Read logs for a specific service
     */
    static readServiceLogs(service: string, lines?: number): string {
        const logFile = path.join(LOG_DIR, `${service}.log`);
        if (!fs.existsSync(logFile)) {
            return '';
        }

        const content = fs.readFileSync(logFile, 'utf-8');

        if (!lines) {
            return content;
        }

        const allLines = content.split('\n');
        return allLines.slice(-lines).join('\n');
    }

    /**
     * Clear the infrastructure logs
     */
    static clearLogs(): void {
        if (fs.existsSync(INFRASTRUCTURE_LOG_FILE)) {
            fs.writeFileSync(INFRASTRUCTURE_LOG_FILE, '');
        }
    }

    /**
     * Clear logs for a specific service
     */
    static clearServiceLogs(service: string): void {
        const logFile = path.join(LOG_DIR, `${service}.log`);
        if (fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, '');
        }
    }

    /**
     * Check if logs exist for a specific service
     */
    static hasServiceLogs(service: string): boolean {
        const logFile = path.join(LOG_DIR, `${service}.log`);
        if (!fs.existsSync(logFile)) {
            return false;
        }
        const stats = fs.statSync(logFile);
        return stats.size > 0;
    }

    // ============================================
    // PUBLIC API - STATUS
    // ============================================

    /**
     * **getServerStatus()** - Retourne l'état complet du serveur
     *
     * Utilise un cache de 5 secondes pour éviter les détections répétées.
     *
     * @param forceRefresh - Force une nouvelle détection même si le cache est valide
     */
    async getServerStatus(forceRefresh = false): Promise<ServerStatus> {
        const now = Date.now();
        const cacheAge = now - InfrastructureManager.statusCacheTimestamp;

        // Retourne le cache si valide et pas de forceRefresh
        if (!forceRefresh && InfrastructureManager.statusCache && cacheAge < InfrastructureManager.STATUS_CACHE_TTL_MS) {
            return InfrastructureManager.statusCache;
        }

        // Effectue la détection complète
        const status: ServerStatus = {
            runtimes: await detectRuntimes(),
            databases: await detectDatabases(),
            services: await detectServices(),
            system: await getSystemInfo()
        };

        // Met à jour le cache statique
        InfrastructureManager.statusCache = status;
        InfrastructureManager.statusCacheTimestamp = now;

        return status;
    }

    /**
     * Invalide le cache du status serveur
     */
    invalidateStatusCache(): void {
        InfrastructureManager.statusCache = null;
        InfrastructureManager.statusCacheTimestamp = 0;
    }

    // ============================================
    // PUBLIC API - RUNTIMES
    // ============================================

    /**
     * **installRuntime()** - Installe un runtime
     */
    async installRuntime(type: RuntimeType): Promise<InstallResult> {
        if (type === 'nodejs') {
            return { success: false, error: 'Node.js is already installed (required by the agent)' };
        }

        this.setCurrentService(type);
        this.onLog(`\n📦 Installing ${type}...\n`, 'stdout');

        try {
            const installer = runtimeInstallers[type];
            if (!installer) {
                throw new Error(`Unknown runtime: ${type}`);
            }

            const version = await installer(this.onLog);
            this.onLog(`\n✅ ${type} ${version} installed successfully\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true, version };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to install ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * **updateRuntime()** - Met à jour un runtime
     */
    async updateRuntime(type: RuntimeType): Promise<UpdateResult> {
        this.setCurrentService(type);
        this.onLog(`\n🔄 Updating ${type}...\n`, 'stdout');

        try {
            // Get current version
            const checks: Record<RuntimeType, { cmd: string; args: string[] }> = {
                nodejs: { cmd: 'node', args: ['--version'] },
                python: { cmd: 'python3', args: ['--version'] },
                php: { cmd: 'php', args: ['--version'] },
                go: { cmd: 'go', args: ['version'] },
                docker: { cmd: 'docker', args: ['--version'] },
                rust: { cmd: 'rustc', args: ['--version'] },
                ruby: { cmd: 'ruby', args: ['--version'] }
            };
            const check = checks[type];
            const oldVersion = await getCommandVersion(check.cmd, check.args) || 'unknown';

            const updater = runtimeUpdaters[type];
            if (!updater) {
                throw new Error(`Unknown runtime: ${type}`);
            }

            const newVersion = await updater(this.onLog);

            this.onLog(`\n✅ ${type} updated: ${oldVersion} → ${newVersion}\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true, oldVersion, newVersion };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to update ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * **uninstallRuntime()** - Désinstalle un runtime
     */
    async uninstallRuntime(type: RuntimeType, purge: boolean): Promise<OperationResult> {
        // Check if runtime is protected
        if (PROTECTED_RUNTIMES.includes(type)) {
            return {
                success: false,
                error: `Cannot remove ${type}: required by the server agent. Removing this runtime would make the server inaccessible.`
            };
        }

        this.setCurrentService(type);
        this.onLog(`\n🗑️ Removing ${type}${purge ? ' (with purge)' : ''}...\n`, 'stdout');

        try {
            await uninstallRuntime(type, purge, this.onLog);
            this.onLog(`\n✅ ${type} removed successfully\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to remove ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    // ============================================
    // PUBLIC API - DATABASES
    // ============================================

    /**
     * **configureDatabase()** - Configure une base de données
     *
     * Retourne la connection string via le résultat (JAMAIS loggée !)
     */
    async configureDatabase(type: DatabaseType, dbName: string, securityOptions?: DbSecurityOptions): Promise<DatabaseConfigResult> {
        this.setCurrentService(type);
        this.onLog(`\n🗄️ Configuring ${type} database: ${dbName}...\n`, 'stdout');

        // Default to secure options if not provided
        const opts: DbSecurityOptions = securityOptions || {
            setRootPassword: true,
            removeAnonymousUsers: true,
            disableRemoteRoot: true,
            removeTestDb: true,
            configureHba: true,
            enableProtectedMode: true,
            bindLocalhost: true
        };

        try {
            if (type === 'mongodb') {
                throw new Error('MongoDB configuration not implemented yet');
            }

            const configurator = databaseConfigurators[type];
            if (!configurator) {
                throw new Error(`Unknown database: ${type}`);
            }

            const connectionString = await configurator(dbName, opts, this.onLog);
            this.onLog(`\n✅ ${type} configured successfully\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true, connectionString };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to configure ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * **removeDatabase()** - Supprime une base de données
     */
    async removeDatabase(type: DatabaseType, purge: boolean, removeData: boolean): Promise<OperationResult> {
        this.setCurrentService(type);
        this.onLog(`\n🗑️ Removing ${type}${purge ? ' (with purge)' : ''}${removeData ? ' [INCLUDING DATA]' : ''}...\n`, 'stdout');

        try {
            await removeDatabase(type, purge, removeData, this.onLog);
            this.onLog(`\n✅ ${type} removed successfully\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to remove ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * **reconfigureDatabase()** - Reconfigure une base de données
     */
    async reconfigureDatabase(type: DatabaseType, dbName: string, resetPassword: boolean): Promise<DatabaseConfigResult> {
        this.setCurrentService(type);
        const action = resetPassword ? 'Resetting password' : 'Creating new database';
        this.onLog(`\n🔄 ${action} for ${type}: ${dbName}...\n`, 'stdout');

        try {
            const connectionString = await reconfigureDatabase(type, dbName, resetPassword, this.onLog);
            this.onLog(`\n✅ ${type} reconfigured successfully\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true, connectionString };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to reconfigure ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * **startDatabase()** - Démarre une base de données
     */
    async startDatabase(type: DatabaseType): Promise<OperationResult> {
        this.onLog(`\n▶️ Starting ${type}...\n`, 'stdout');

        try {
            const serviceName = DATABASE_SERVICE_NAMES[type] || type;
            await runCommand('systemctl', ['start', serviceName], this.onLog);
            this.onLog(`\n✅ ${type} started successfully\n`, 'stdout');
            this.invalidateStatusCache();
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to start ${type}: ${err.message}\n`, 'stderr');
            return { success: false, error: err.message };
        }
    }

    /**
     * **stopDatabase()** - Arrête une base de données
     */
    async stopDatabase(type: DatabaseType): Promise<OperationResult> {
        this.onLog(`\n⏹️ Stopping ${type}...\n`, 'stdout');

        try {
            const serviceName = DATABASE_SERVICE_NAMES[type] || type;
            await runCommand('systemctl', ['stop', serviceName], this.onLog);
            this.onLog(`\n✅ ${type} stopped successfully\n`, 'stdout');
            this.invalidateStatusCache();
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to stop ${type}: ${err.message}\n`, 'stderr');
            return { success: false, error: err.message };
        }
    }

    // ============================================
    // PUBLIC API - SERVICES
    // ============================================

    /**
     * **installService()** - Installe un service
     */
    async installService(type: ServiceType): Promise<InstallResult> {
        this.setCurrentService(type);
        this.onLog(`\n📦 Installing ${type}...\n`, 'stdout');

        try {
            const installer = serviceInstallers[type];
            if (!installer) {
                throw new Error(`Unknown service: ${type}`);
            }

            const version = await installer(this.onLog);
            this.onLog(`\n✅ ${type} ${version} installed successfully\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true, version };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to install ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * **removeService()** - Supprime un service
     */
    async removeService(type: ServiceType, purge: boolean = false): Promise<OperationResult> {
        // Check if service is protected
        if (PROTECTED_SERVICES.includes(type)) {
            this.onLog(`\n⛔ Cannot remove ${type} - it's a protected system service\n`, 'stderr');
            return { success: false, error: `${type} is a protected system service and cannot be removed` };
        }

        this.setCurrentService(type);
        this.onLog(`\n🗑️ Removing ${type}${purge ? ' (with purge)' : ''}...\n`, 'stdout');

        try {
            const removeCmd = purge ? 'purge' : 'remove';
            await this.doRemoveService(type, removeCmd);

            await runCommand('apt-get', ['autoremove', '-y'], this.onLog);
            this.onLog(`\n✅ ${type} removed successfully\n`, 'stdout');
            this.setCurrentService(null);
            this.invalidateStatusCache();
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to remove ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    private async doRemoveService(type: ServiceType, removeCmd: string): Promise<void> {
        switch (type) {
            case 'nginx':
                await runCommand('systemctl', ['stop', 'nginx'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'nginx', 'nginx-common'], this.onLog);
                break;
            case 'haproxy':
                await runCommand('systemctl', ['stop', 'haproxy'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'haproxy'], this.onLog);
                break;
            case 'keepalived':
                await runCommand('systemctl', ['stop', 'keepalived'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'keepalived'], this.onLog);
                break;
            case 'certbot':
                await runCommand('apt-get', [removeCmd, '-y', 'certbot', 'python3-certbot-nginx'], this.onLog);
                break;
            case 'fail2ban':
                await runCommand('systemctl', ['stop', 'fail2ban'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'fail2ban'], this.onLog);
                break;
            case 'ufw':
                await runCommand('ufw', ['disable'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'ufw'], this.onLog);
                break;
            case 'wireguard':
                await runCommand('apt-get', [removeCmd, '-y', 'wireguard', 'wireguard-tools'], this.onLog);
                break;
            case 'pm2':
                await runCommand('npm', ['uninstall', '-g', 'pm2'], this.onLog);
                break;
            case 'netdata':
                await runCommand('systemctl', ['stop', 'netdata'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'netdata'], this.onLog);
                break;
            case 'loki':
                await runCommand('systemctl', ['stop', 'loki'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'loki'], this.onLog);
                break;
            case 'bind9':
                await runCommand('systemctl', ['stop', 'named'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'bind9', 'bind9utils', 'bind9-doc'], this.onLog);
                break;
            case 'postfix':
                await runCommand('systemctl', ['stop', 'postfix'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'postfix', 'postfix-policyd-spf-python'], this.onLog);
                break;
            case 'dovecot':
                await runCommand('systemctl', ['stop', 'dovecot'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'dovecot-core', 'dovecot-imapd', 'dovecot-pop3d', 'dovecot-lmtpd'], this.onLog);
                break;
            case 'rspamd':
                await runCommand('systemctl', ['stop', 'rspamd'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'rspamd'], this.onLog);
                break;
            case 'opendkim':
                await runCommand('systemctl', ['stop', 'opendkim'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'opendkim', 'opendkim-tools'], this.onLog);
                break;
            case 'clamav':
                // Arrêter les services (ignorer les erreurs si déjà arrêtés)
                try {
                    await runCommand('systemctl', ['stop', 'clamav-daemon'], this.onLog);
                } catch { /* Service peut ne pas exister */ }
                try {
                    await runCommand('systemctl', ['stop', 'clamav-freshclam'], this.onLog);
                } catch { /* Service peut ne pas exister */ }

                // Supprimer TOUS les packages ClamAV (y compris les dépendances)
                await runCommand('apt-get', [removeCmd, '-y',
                    'clamav', 'clamav-daemon', 'clamav-freshclam',
                    'clamav-base', 'clamdscan', 'libclamav11'
                ], this.onLog);

                // Nettoyer les fichiers de données pour éviter les problèmes de réinstallation
                const clamavDataDir = '/var/lib/clamav';
                if (fs.existsSync(clamavDataDir)) {
                    // Supprimer mirrors.dat (contient l'état du rate-limiting)
                    const mirrorsFile = `${clamavDataDir}/mirrors.dat`;
                    if (fs.existsSync(mirrorsFile)) {
                        this.onLog(`🧹 Suppression du fichier mirrors.dat (reset rate-limiting)\n`, 'stdout');
                        try { fs.unlinkSync(mirrorsFile); } catch { }
                    }

                    // En mode purge, supprimer aussi les définitions de virus
                    if (removeCmd === 'purge') {
                        this.onLog(`🧹 Suppression des définitions de virus...\n`, 'stdout');
                        try { await runCommandSilent('rm', ['-rf', clamavDataDir]); } catch { }
                    }
                }

                // Nettoyer les fichiers de socket et PID
                try { await runCommandSilent('rm', ['-rf', '/var/run/clamav']); } catch { }
                try { await runCommandSilent('rm', ['-rf', '/var/log/clamav']); } catch { }
                break;
            case 'spf-policyd':
                await runCommand('apt-get', [removeCmd, '-y', 'postfix-policyd-spf-python'], this.onLog);
                break;
            case 'rsync':
                await runCommand('apt-get', [removeCmd, '-y', 'rsync'], this.onLog);
                break;
            case 'rclone':
                await runCommandSilent('rm', ['-f', '/usr/bin/rclone']);
                await runCommandSilent('rm', ['-f', '/usr/local/share/man/man1/rclone.1']);
                await runCommandSilent('rm', ['-f', '/usr/share/man/man1/rclone.1.gz']);
                await runCommandSilent('rm', ['-rf', '/root/.config/rclone']);
                this.onLog(`🗑️ Rclone binary and config removed\n`, 'stdout');
                break;
            case 'restic':
                await runCommand('apt-get', [removeCmd, '-y', 'restic'], this.onLog);
                break;
            case 'vsftpd':
                await runCommand('systemctl', ['stop', 'vsftpd'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'vsftpd', 'vsftpd-dbg'], this.onLog);
                break;
            case 'proftpd':
                await runCommand('systemctl', ['stop', 'proftpd'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'proftpd', 'proftpd-basic', 'proftpd-core'], this.onLog);
                break;
            case 'nfs':
                await runCommand('systemctl', ['stop', 'nfs-kernel-server'], this.onLog);
                await runCommand('apt-get', [removeCmd, '-y', 'nfs-kernel-server', 'nfs-common', 'nfs-utils'], this.onLog);
                break;
            case 'ssh':
            case 'cron':
                throw new Error(`${type} is a protected system service`);
            default:
                throw new Error(`Unknown service: ${type}`);
        }
    }

    /**
     * **startService()** - Démarre un service
     */
    async startService(type: ServiceType): Promise<OperationResult> {
        this.onLog(`\n▶️ Starting ${type}...\n`, 'stdout');

        try {
            const serviceName = SERVICE_NAMES[type] || type;
            if (!serviceName) {
                throw new Error(`${type} is a tool, not a service - it cannot be started`);
            }
            await runCommand('systemctl', ['start', serviceName], this.onLog);
            this.onLog(`\n✅ ${type} started successfully\n`, 'stdout');
            this.invalidateStatusCache();
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to start ${type}: ${err.message}\n`, 'stderr');
            return { success: false, error: err.message };
        }
    }

    /**
     * **stopService()** - Arrête un service
     */
    async stopService(type: ServiceType): Promise<OperationResult> {
        this.onLog(`\n⏹️ Stopping ${type}...\n`, 'stdout');

        try {
            const serviceName = SERVICE_NAMES[type] || type;
            if (!serviceName) {
                throw new Error(`${type} is a tool, not a service - it cannot be stopped`);
            }
            await runCommand('systemctl', ['stop', serviceName], this.onLog);
            this.onLog(`\n✅ ${type} stopped successfully\n`, 'stdout');
            this.invalidateStatusCache();
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to stop ${type}: ${err.message}\n`, 'stderr');
            return { success: false, error: err.message };
        }
    }
}
