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

// Import mail installers directly (for configureMailStack with custom domain)
import { installPostfix, installDovecot, installRspamd, installOpendkim, installClamav, installSpfPolicyd } from './installers/services/mail.js';

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
// SERVICE CLEANUP CONFIGURATION
// ============================================

/**
 * Configuration de nettoyage pour chaque service
 * - packages : Liste des packages à purger
 * - user : Utilisateur système à supprimer (optionnel)
 * - group : Groupe système à supprimer (optionnel)
 * - dataDirs : Répertoires de données à supprimer en mode purge
 * - configDirs : Répertoires de configuration à supprimer
 */
const SERVICE_CLEANUP_CONFIG: Partial<Record<ServiceType, {
    packages: string[];
    user?: string;
    group?: string;
    dataDirs?: string[];
    configDirs?: string[];
}>> = {
    clamav: {
        packages: ['clamav', 'clamav-daemon', 'clamav-freshclam', 'clamav-base', 'clamdscan', 'libclamav11'],
        user: 'clamav',
        group: 'clamav',
        dataDirs: ['/var/lib/clamav', '/var/log/clamav', '/var/run/clamav'],
        configDirs: ['/etc/clamav']
    },
    postfix: {
        packages: ['postfix', 'postfix-policyd-spf-python', 'libsasl2-modules'],
        user: 'postfix',
        group: 'postfix',
        dataDirs: ['/var/spool/postfix', '/var/lib/postfix'],
        configDirs: ['/etc/postfix']
    },
    dovecot: {
        packages: ['dovecot-core', 'dovecot-imapd', 'dovecot-pop3d', 'dovecot-lmtpd', 'dovecot-sieve'],
        user: 'dovecot',
        group: 'dovecot',
        dataDirs: ['/var/lib/dovecot', '/var/run/dovecot'],
        configDirs: ['/etc/dovecot']
    },
    rspamd: {
        packages: ['rspamd'],
        user: '_rspamd',
        group: '_rspamd',
        dataDirs: ['/var/lib/rspamd', '/var/log/rspamd'],
        configDirs: ['/etc/rspamd']
    },
    opendkim: {
        packages: ['opendkim', 'opendkim-tools'],
        user: 'opendkim',
        group: 'opendkim',
        dataDirs: [],
        configDirs: ['/etc/opendkim', '/etc/opendkim.conf']
    },
    bind9: {
        packages: ['bind9', 'bind9utils', 'bind9-doc', 'bind9-host'],
        user: 'bind',
        group: 'bind',
        dataDirs: ['/var/cache/bind', '/var/lib/bind'],
        configDirs: ['/etc/bind']
    },
    netdata: {
        packages: ['netdata'],
        user: 'netdata',
        group: 'netdata',
        dataDirs: ['/var/lib/netdata', '/var/cache/netdata', '/var/log/netdata'],
        configDirs: ['/etc/netdata']
    },
    nginx: {
        packages: ['nginx', 'nginx-common', 'nginx-full', 'nginx-light', 'nginx-extras'],
        // www-data est un utilisateur système partagé, on ne le supprime pas
        dataDirs: ['/var/log/nginx', '/var/cache/nginx'],
        configDirs: ['/etc/nginx']
    },
    vsftpd: {
        packages: ['vsftpd', 'vsftpd-dbg'],
        user: 'ftp',
        group: 'ftp',
        dataDirs: [],
        configDirs: ['/etc/vsftpd.conf', '/etc/vsftpd']
    },
    proftpd: {
        packages: ['proftpd', 'proftpd-basic', 'proftpd-core'],
        user: 'proftpd',
        group: 'proftpd',
        dataDirs: ['/var/run/proftpd'],
        configDirs: ['/etc/proftpd']
    }
};

/**
 * **cleanupServiceArtifacts()** - Nettoie complètement les artefacts d'un service
 *
 * Cette fonction effectue un nettoyage profond après la désinstallation :
 * 1. Supprime les fichiers dpkg info résiduels
 * 2. Nettoie les entrées dans statoverride
 * 3. Supprime l'utilisateur/groupe système
 * 4. Supprime les répertoires de données et config
 *
 * @param packagePrefix - Préfixe des packages (ex: "clamav", "postfix")
 * @param user - Nom de l'utilisateur système à supprimer
 * @param group - Nom du groupe système à supprimer
 * @param dataDirs - Répertoires de données à supprimer
 * @param configDirs - Répertoires de config à supprimer
 * @param onLog - Fonction de logging
 */
async function cleanupServiceArtifacts(
    packagePrefix: string,
    user: string | undefined,
    group: string | undefined,
    dataDirs: string[],
    configDirs: string[],
    onLog: LogFn
): Promise<void> {
    // 1. Supprimer les fichiers dpkg info résiduels
    const dpkgInfoDir = '/var/lib/dpkg/info';
    if (fs.existsSync(dpkgInfoDir)) {
        try {
            const files = fs.readdirSync(dpkgInfoDir);
            let deletedCount = 0;
            for (const file of files) {
                if (file.startsWith(packagePrefix)) {
                    try {
                        fs.unlinkSync(`${dpkgInfoDir}/${file}`);
                        deletedCount++;
                    } catch { }
                }
            }
            if (deletedCount > 0) {
                onLog(`   🗑️ ${deletedCount} fichiers dpkg info supprimés\n`, 'stdout');
            }
        } catch { }
    }

    // 2. Nettoyer les entrées dans statoverride
    const statoverrideFile = '/var/lib/dpkg/statoverride';
    if (fs.existsSync(statoverrideFile)) {
        try {
            const content = fs.readFileSync(statoverrideFile, 'utf-8');
            const lines = content.split('\n');
            const cleanedLines = lines.filter(line => !line.includes(packagePrefix));
            if (lines.length !== cleanedLines.length) {
                fs.writeFileSync(statoverrideFile, cleanedLines.join('\n'));
                onLog(`   🧹 Entrées statoverride nettoyées\n`, 'stdout');
            }
        } catch { }
    }

    // 3. Supprimer l'utilisateur et le groupe système
    // On utilise sed car userdel/groupdel peuvent échouer si le nom contient des caractères corrompus
    if (user) {
        try {
            // Supprimer de passwd, shadow, group, gshadow
            await runCommandSilent('bash', ['-c', `sed -i '/^${user}/d' /etc/passwd /etc/shadow 2>/dev/null || true`]);
            onLog(`   👤 Utilisateur ${user} supprimé\n`, 'stdout');
        } catch { }
    }
    if (group) {
        try {
            await runCommandSilent('bash', ['-c', `sed -i '/^${group}/d' /etc/group /etc/gshadow 2>/dev/null || true`]);
            onLog(`   👥 Groupe ${group} supprimé\n`, 'stdout');
        } catch { }
    }

    // 4. Supprimer les répertoires de données
    for (const dir of dataDirs) {
        if (fs.existsSync(dir)) {
            try {
                await runCommandSilent('rm', ['-rf', dir]);
            } catch { }
        }
    }

    // 5. Supprimer les répertoires de configuration
    for (const dir of configDirs) {
        if (fs.existsSync(dir)) {
            try {
                await runCommandSilent('rm', ['-rf', dir]);
            } catch { }
        }
    }

    // 6. Nettoyer le cache debconf pour ce service
    try {
        await runCommandSilent('bash', ['-c', `echo PURGE | debconf-communicate ${packagePrefix} 2>/dev/null || true`]);
    } catch { }
}

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
        // Vérifier si on a une configuration de nettoyage pour ce service
        const cleanupConfig = SERVICE_CLEANUP_CONFIG[type];

        // Arrêter le service si possible
        const serviceName = SERVICE_NAMES[type];
        if (serviceName) {
            try {
                await runCommand('systemctl', ['stop', serviceName], this.onLog);
            } catch { /* Service peut ne pas exister */ }
        }

        // Cas spéciaux pour certains services
        switch (type) {
            case 'clamav':
                // ClamAV a deux services
                try { await runCommandSilent('systemctl', ['stop', 'clamav-freshclam']); } catch { }
                break;
            case 'ufw':
                try { await runCommand('ufw', ['disable'], this.onLog); } catch { }
                break;
            case 'pm2':
                await runCommand('npm', ['uninstall', '-g', 'pm2'], this.onLog);
                return; // PM2 n'utilise pas apt
            case 'rclone':
                await runCommandSilent('rm', ['-f', '/usr/bin/rclone']);
                await runCommandSilent('rm', ['-f', '/usr/local/share/man/man1/rclone.1']);
                await runCommandSilent('rm', ['-f', '/usr/share/man/man1/rclone.1.gz']);
                await runCommandSilent('rm', ['-rf', '/root/.config/rclone']);
                this.onLog(`🗑️ Rclone binary and config removed\n`, 'stdout');
                return; // Rclone n'utilise pas apt
            case 'ssh':
            case 'cron':
                throw new Error(`${type} is a protected system service`);
        }

        // Désinstallation via apt-get
        if (cleanupConfig) {
            // Utiliser la configuration centralisée
            await runCommand('apt-get', [removeCmd, '-y', ...cleanupConfig.packages], this.onLog);

            // Nettoyage complet des artefacts
            this.onLog(`🧹 Nettoyage complet de ${type}...\n`, 'stdout');
            await cleanupServiceArtifacts(
                type, // Préfixe pour dpkg info
                cleanupConfig.user,
                cleanupConfig.group,
                cleanupConfig.dataDirs || [],
                cleanupConfig.configDirs || [],
                this.onLog
            );
        } else {
            // Services sans configuration spéciale - désinstallation simple
            switch (type) {
                case 'haproxy':
                    await runCommand('apt-get', [removeCmd, '-y', 'haproxy'], this.onLog);
                    break;
                case 'keepalived':
                    await runCommand('apt-get', [removeCmd, '-y', 'keepalived'], this.onLog);
                    break;
                case 'certbot':
                    await runCommand('apt-get', [removeCmd, '-y', 'certbot', 'python3-certbot-nginx'], this.onLog);
                    break;
                case 'fail2ban':
                    await runCommand('apt-get', [removeCmd, '-y', 'fail2ban'], this.onLog);
                    break;
                case 'ufw':
                    await runCommand('apt-get', [removeCmd, '-y', 'ufw'], this.onLog);
                    break;
                case 'wireguard':
                    await runCommand('apt-get', [removeCmd, '-y', 'wireguard', 'wireguard-tools'], this.onLog);
                    break;
                case 'loki':
                    await runCommand('apt-get', [removeCmd, '-y', 'loki'], this.onLog);
                    break;
                case 'spf-policyd':
                    await runCommand('apt-get', [removeCmd, '-y', 'postfix-policyd-spf-python'], this.onLog);
                    // Recharger Postfix pour appliquer la suppression du policy daemon
                    try {
                        await runCommand('systemctl', ['reload', 'postfix'], this.onLog);
                    } catch { /* Postfix peut ne pas être installé */ }
                    break;
                case 'rsync':
                    await runCommand('apt-get', [removeCmd, '-y', 'rsync'], this.onLog);
                    break;
                case 'restic':
                    await runCommand('apt-get', [removeCmd, '-y', 'restic'], this.onLog);
                    break;
                case 'nfs':
                    await runCommand('apt-get', [removeCmd, '-y', 'nfs-kernel-server', 'nfs-common', 'nfs-utils'], this.onLog);
                    break;
                default:
                    throw new Error(`Unknown service: ${type}`);
            }
        }
    }

    /**
     * **startService()** - Démarre un service
     */
    async startService(type: ServiceType): Promise<OperationResult> {
        this.onLog(`\n▶️ Starting ${type}...\n`, 'stdout');

        try {
            // Vérifier si ce service a un nom systemd (chaîne vide = pas de service)
            const serviceName = SERVICE_NAMES[type];
            if (!serviceName) {
                throw new Error(`${type} is a tool or runs via another service - it cannot be started directly`);
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
            // Vérifier si ce service a un nom systemd (chaîne vide = pas de service)
            const serviceName = SERVICE_NAMES[type];
            if (!serviceName) {
                throw new Error(`${type} is a tool or runs via another service - it cannot be stopped directly`);
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

    /**
     * **configureMailStack()** - Configure une stack mail complète
     *
     * Cette fonction installe et configure tous les services mail nécessaires
     * pour un serveur de messagerie fonctionnel : Postfix, Dovecot, Rspamd,
     * OpenDKIM, ClamAV et SPF-policyd.
     *
     * @param config - Configuration de la stack mail
     * @param config.domain - Domaine principal (ex: example.com)
     * @param config.hostname - Hostname du serveur mail (ex: mail.example.com)
     * @param config.services - Services à installer
     * @param config.security - Options de sécurité (TLS, DKIM, SPF, DMARC)
     */
    async configureMailStack(config: {
        domain: string;
        hostname: string;
        services: string[];
        security: {
            tls: string;
            dkimKeySize: number;
            spf: boolean;
            dmarc: boolean;
        };
    }): Promise<{ success: boolean; dkimPublicKey?: string; error?: string }> {
        this.onLog(`\n📧 Configuring Mail Stack for ${config.domain}...\n`, 'stdout');

        const mailServices: ServiceType[] = ['postfix', 'dovecot', 'rspamd', 'opendkim', 'clamav', 'spf-policyd'];
        const servicesToInstall = config.services.filter(s => mailServices.includes(s as ServiceType));

        // Configuration pour les installateurs mail
        const mailConfig = { domain: config.domain, hostname: config.hostname };

        try {
            // Étape 1: Installer les services avec le bon domaine
            this.onLog(`\n📦 Step 1/4: Installing mail services...\n`, 'stdout');
            for (const service of servicesToInstall) {
                this.onLog(`\n  → Installing ${service}...\n`, 'stdout');
                try {
                    // Utiliser les installateurs mail spécifiques avec le domaine configuré
                    switch (service) {
                        case 'postfix':
                            await installPostfix(this.onLog, mailConfig);
                            break;
                        case 'dovecot':
                            await installDovecot(this.onLog);
                            break;
                        case 'rspamd':
                            await installRspamd(this.onLog);
                            break;
                        case 'opendkim':
                            await installOpendkim(this.onLog, mailConfig);
                            break;
                        case 'clamav':
                            await installClamav(this.onLog);
                            break;
                        case 'spf-policyd':
                            await installSpfPolicyd(this.onLog);
                            break;
                        default:
                            throw new Error(`Unknown mail service: ${service}`);
                    }
                    this.onLog(`\n✅ ${service} installed successfully\n`, 'stdout');
                } catch (err: any) {
                    throw new Error(`Failed to install ${service}: ${err.message}`);
                }
            }

            // Étape 2: Générer les clés DKIM si OpenDKIM est installé
            let dkimPublicKey: string | undefined;
            if (servicesToInstall.includes('opendkim')) {
                this.onLog(`\n🔑 Step 2/4: Generating DKIM keys...\n`, 'stdout');
                dkimPublicKey = await this.generateDkimKeys(config.domain, config.security.dkimKeySize);
            } else {
                this.onLog(`\n⏭️ Step 2/4: Skipping DKIM (not selected)\n`, 'stdout');
            }

            // Étape 3: Appliquer les configurations
            this.onLog(`\n⚙️ Step 3/4: Applying configurations...\n`, 'stdout');
            await this.applyMailTemplates(config);

            // Étape 4: Redémarrer les services
            this.onLog(`\n🔄 Step 4/4: Restarting services...\n`, 'stdout');
            for (const service of servicesToInstall) {
                if (SERVICE_NAMES[service as ServiceType]) {
                    this.onLog(`  → Restarting ${service}...\n`, 'stdout');
                    await runCommandSilent('systemctl', ['restart', SERVICE_NAMES[service as ServiceType]]);
                }
            }

            // Sauvegarder la configuration
            await this.saveMailConfig(config, dkimPublicKey);

            this.onLog(`\n✅ Mail stack configured successfully!\n`, 'stdout');
            this.invalidateStatusCache();

            return { success: true, dkimPublicKey };
        } catch (err: any) {
            this.onLog(`\n❌ Mail stack configuration failed: ${err.message}\n`, 'stderr');
            return { success: false, error: err.message };
        }
    }

    /**
     * **generateDkimKeys()** - Génère les clés DKIM pour un domaine
     */
    private async generateDkimKeys(domain: string, keySize: number = 2048): Promise<string> {
        const keysDir = `/etc/opendkim/keys/${domain}`;

        // Créer le répertoire des clés
        await runCommandSilent('mkdir', ['-p', keysDir]);

        // Générer la clé privée (RSA pour compatibilité DKIM)
        await runCommand('opendkim-genkey', [
            '-b', keySize.toString(),
            '-d', domain,
            '-D', keysDir,
            '-s', 'default',
            '-v'
        ], this.onLog);

        // Lire la clé publique
        const publicKeyPath = path.join(keysDir, 'default.txt');
        const publicKeyContent = fs.readFileSync(publicKeyPath, 'utf-8');

        // Changer les permissions
        await runCommandSilent('chown', ['-R', 'opendkim:opendkim', keysDir]);
        await runCommandSilent('chmod', ['600', path.join(keysDir, 'default.private')]);

        this.onLog(`  ✅ DKIM keys generated for ${domain}\n`, 'stdout');

        // Extraire juste la clé publique du fichier
        const keyMatch = publicKeyContent.match(/p=([^"]+)/);
        return keyMatch ? keyMatch[1].replace(/\s+/g, '') : publicKeyContent;
    }

    /**
     * **applyMailTemplates()** - Applique les templates de configuration mail
     */
    private async applyMailTemplates(config: {
        domain: string;
        hostname: string;
        services: string[];
        security: { tls: string; dkimKeySize: number; spf: boolean; dmarc: boolean };
    }): Promise<void> {
        const templatesDir = path.join(__dirname, 'templates');
        const variables = {
            domain: config.domain,
            hostname: config.hostname,
            keys_dir: `/etc/opendkim/keys/${config.domain}`
        };

        // Postfix main.cf
        if (config.services.includes('postfix')) {
            const postfixTemplate = fs.readFileSync(path.join(templatesDir, 'postfix', 'main.cf.conf'), 'utf-8');
            const postfixConfig = this.applyTemplateVariables(postfixTemplate, variables);
            fs.writeFileSync('/etc/postfix/main.cf', postfixConfig);
            this.onLog(`  ✅ Postfix main.cf configured\n`, 'stdout');
        }

        // Dovecot local.conf
        if (config.services.includes('dovecot')) {
            const dovecotTemplate = fs.readFileSync(path.join(templatesDir, 'dovecot', 'local.conf'), 'utf-8');
            const dovecotConfig = this.applyTemplateVariables(dovecotTemplate, variables);
            fs.writeFileSync('/etc/dovecot/local.conf', dovecotConfig);
            this.onLog(`  ✅ Dovecot local.conf configured\n`, 'stdout');
        }

        // OpenDKIM configs
        if (config.services.includes('opendkim')) {
            const opendkimDir = path.join(templatesDir, 'opendkim');

            // opendkim.conf
            const mainConf = fs.readFileSync(path.join(opendkimDir, 'opendkim.conf'), 'utf-8');
            fs.writeFileSync('/etc/opendkim.conf', this.applyTemplateVariables(mainConf, variables));

            // KeyTable
            const keyTable = fs.readFileSync(path.join(opendkimDir, 'KeyTable.conf'), 'utf-8');
            fs.writeFileSync('/etc/opendkim/KeyTable', this.applyTemplateVariables(keyTable, variables));

            // SigningTable
            const signingTable = fs.readFileSync(path.join(opendkimDir, 'SigningTable.conf'), 'utf-8');
            fs.writeFileSync('/etc/opendkim/SigningTable', this.applyTemplateVariables(signingTable, variables));

            // TrustedHosts
            const trustedHosts = fs.readFileSync(path.join(opendkimDir, 'TrustedHosts.conf'), 'utf-8');
            fs.writeFileSync('/etc/opendkim/TrustedHosts', this.applyTemplateVariables(trustedHosts, variables));

            this.onLog(`  ✅ OpenDKIM configured\n`, 'stdout');
        }

        // Rspamd antivirus config (pour ClamAV)
        if (config.services.includes('rspamd') && config.services.includes('clamav')) {
            const rspamdTemplate = fs.readFileSync(path.join(templatesDir, 'rspamd', 'antivirus.conf'), 'utf-8');
            const rspamdConfig = this.applyTemplateVariables(rspamdTemplate, variables);
            await runCommandSilent('mkdir', ['-p', '/etc/rspamd/local.d']);
            fs.writeFileSync('/etc/rspamd/local.d/antivirus.conf', rspamdConfig);
            this.onLog(`  ✅ Rspamd antivirus integration configured\n`, 'stdout');
        }

        // ClamAV config
        if (config.services.includes('clamav')) {
            const clamavTemplate = fs.readFileSync(path.join(templatesDir, 'clamav', 'clamd.conf'), 'utf-8');
            const clamavConfig = this.applyTemplateVariables(clamavTemplate, variables);
            fs.writeFileSync('/etc/clamav/clamd.conf', clamavConfig);
            this.onLog(`  ✅ ClamAV configured\n`, 'stdout');
        }
    }

    /**
     * **applyTemplateVariables()** - Remplace les variables {{ var }} dans un template
     */
    private applyTemplateVariables(template: string, variables: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            // Remplace {{ key }} et {{ key | default:value }}
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*(\\|\\s*default:\\s*[^}]+)?\\s*\\}\\}`, 'g');
            result = result.replace(regex, value);
        }
        // Remplace les variables non définies par leur valeur par défaut
        result = result.replace(/\{\{\s*\w+\s*\|\s*default:\s*([^}]+)\s*\}\}/g, '$1');
        return result;
    }

    /**
     * **saveMailConfig()** - Sauvegarde la configuration mail pour référence future
     */
    private async saveMailConfig(config: any, dkimPublicKey?: string): Promise<void> {
        const configDir = '/opt/serverflow/config';
        await runCommandSilent('mkdir', ['-p', configDir]);

        const mailConfig = {
            ...config,
            dkimPublicKey,
            configuredAt: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(configDir, 'mail.json'),
            JSON.stringify(mailConfig, null, 2)
        );

        this.onLog(`  ✅ Mail configuration saved to ${configDir}/mail.json\n`, 'stdout');
    }
}
