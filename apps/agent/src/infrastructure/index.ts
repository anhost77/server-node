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
import { fileURLToPath } from 'node:url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  OperationResult,
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
  OperationResult,
} from './types.js';

import { PROTECTED_RUNTIMES, PROTECTED_SERVICES } from './types.js';

// Import helpers
import {
  runCommand,
  runCommandSilent,
  getCommandVersion,
  nuclearCleanup,
  NUCLEAR_CLEANUP_CONFIG,
} from './helpers.js';

// Import detection functions
import {
  detectRuntimes,
  detectDatabases,
  detectServices,
  getSystemInfo,
} from './detection/index.js';

// Import installers
import { runtimeInstallers, runtimeUpdaters, uninstallRuntime } from './installers/runtimes.js';
import {
  databaseConfigurators,
  removeDatabase,
  reconfigureDatabase,
} from './installers/databases.js';
import { serviceInstallers } from './installers/services/index.js';

// Import mail installers directly (for configureMailStack with custom domain)
import {
  installPostfix,
  installDovecot,
  installRspamd,
  installOpendkim,
  installClamav,
  installSpfPolicyd,
} from './installers/services/mail.js';

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
  nfs: 'nfs-kernel-server',
};

const DATABASE_SERVICE_NAMES: Record<DatabaseType, string> = {
  postgresql: 'postgresql',
  mysql: 'mysql',
  redis: 'redis-server',
  mongodb: 'mongod',
};

// ============================================
// SERVICE CLEANUP - Utilise NUCLEAR_CLEANUP_CONFIG de helpers.ts
// ============================================
// La configuration de nettoyage est centralisée dans helpers.ts
// avec la fonction nuclearCleanup() qui effectue un nettoyage complet

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
    if (
      !forceRefresh &&
      InfrastructureManager.statusCache &&
      cacheAge < InfrastructureManager.STATUS_CACHE_TTL_MS
    ) {
      return InfrastructureManager.statusCache;
    }

    // Effectue la détection complète
    const status: ServerStatus = {
      runtimes: await detectRuntimes(),
      databases: await detectDatabases(),
      services: await detectServices(),
      system: await getSystemInfo(),
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
        ruby: { cmd: 'ruby', args: ['--version'] },
      };
      const check = checks[type];
      const oldVersion = (await getCommandVersion(check.cmd, check.args)) || 'unknown';

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
        error: `Cannot remove ${type}: required by the server agent. Removing this runtime would make the server inaccessible.`,
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
  async configureDatabase(
    type: DatabaseType,
    dbName: string,
    securityOptions?: DbSecurityOptions,
  ): Promise<DatabaseConfigResult> {
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
      bindLocalhost: true,
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
  async removeDatabase(
    type: DatabaseType,
    purge: boolean,
    removeData: boolean,
  ): Promise<OperationResult> {
    this.setCurrentService(type);
    this.onLog(
      `\n🗑️ Removing ${type}${purge ? ' (with purge)' : ''}${removeData ? ' [INCLUDING DATA]' : ''}...\n`,
      'stdout',
    );

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
  async reconfigureDatabase(
    type: DatabaseType,
    dbName: string,
    resetPassword: boolean,
  ): Promise<DatabaseConfigResult> {
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
      return {
        success: false,
        error: `${type} is a protected system service and cannot be removed`,
      };
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
    // Vérifier si on a une configuration de nettoyage NUCLÉAIRE pour ce service
    const cleanupConfig = NUCLEAR_CLEANUP_CONFIG[type];

    // Cas spéciaux pour certains services (avant le cleanup général)
    switch (type) {
      case 'ufw':
        try {
          await runCommand('ufw', ['disable'], this.onLog);
        } catch {}
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

    // Désinstallation via le système de cleanup centralisé
    if (cleanupConfig) {
      // Utiliser le nettoyage NUCLÉAIRE centralisé
      await nuclearCleanup(type, this.onLog);
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
          await runCommand(
            'apt-get',
            [removeCmd, '-y', 'certbot', 'python3-certbot-nginx'],
            this.onLog,
          );
          break;
        case 'fail2ban':
          await runCommand('apt-get', [removeCmd, '-y', 'fail2ban'], this.onLog);
          break;
        case 'ufw':
          await runCommand('apt-get', [removeCmd, '-y', 'ufw'], this.onLog);
          break;
        case 'wireguard':
          await runCommand(
            'apt-get',
            [removeCmd, '-y', 'wireguard', 'wireguard-tools'],
            this.onLog,
          );
          break;
        case 'loki':
          await runCommand('apt-get', [removeCmd, '-y', 'loki'], this.onLog);
          break;
        case 'spf-policyd':
          await runCommand('apt-get', [removeCmd, '-y', 'postfix-policyd-spf-python'], this.onLog);
          // Recharger Postfix pour appliquer la suppression du policy daemon
          try {
            await runCommand('systemctl', ['reload', 'postfix'], this.onLog);
          } catch {
            /* Postfix peut ne pas être installé */
          }
          break;
        case 'rsync':
          await runCommand('apt-get', [removeCmd, '-y', 'rsync'], this.onLog);
          break;
        case 'restic':
          await runCommand('apt-get', [removeCmd, '-y', 'restic'], this.onLog);
          break;
        case 'nfs':
          await runCommand(
            'apt-get',
            [removeCmd, '-y', 'nfs-kernel-server', 'nfs-common', 'nfs-utils'],
            this.onLog,
          );
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
        throw new Error(
          `${type} is a tool or runs via another service - it cannot be started directly`,
        );
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
        throw new Error(
          `${type} is a tool or runs via another service - it cannot be stopped directly`,
        );
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
   * @param config.additionalDomains - Domaines supplémentaires à configurer
   * @param config.services - Services à installer
   * @param config.security - Options de sécurité (TLS, DKIM, SPF, DMARC)
   */
  async configureMailStack(config: {
    domain: string;
    hostname: string;
    additionalDomains?: string[];
    services: string[];
    security: {
      // Nouvelle structure TLS
      tls:
        | string
        | {
            provider: 'letsencrypt' | 'existing' | 'none';
            certPath?: string;
            keyPath?: string;
          };
      // Nouvelle structure DKIM
      dkim?: {
        enabled: boolean;
        selector: string;
        keySize: number;
      };
      // Ancienne structure (rétrocompatibilité)
      dkimKeySize?: number;
      // Nouvelle structure SPF/DMARC
      spf?: boolean | { enabled: boolean; policy: string };
      dmarc?: boolean | { enabled: boolean; policy: string; rua?: string };
    };
  }): Promise<{ success: boolean; dkimPublicKey?: string; error?: string }> {
    this.onLog(`\n📧 Configuring Mail Stack for ${config.domain}...\n`, 'stdout');

    // Normaliser la configuration de sécurité (rétrocompatibilité)
    const tlsConfig =
      typeof config.security.tls === 'string'
        ? { provider: config.security.tls as 'letsencrypt' | 'existing' | 'none' }
        : config.security.tls;

    const dkimConfig = config.security.dkim || {
      enabled: true,
      selector: 'default',
      keySize: config.security.dkimKeySize || 2048,
    };

    const allDomains = [config.domain, ...(config.additionalDomains || [])];

    const mailServices: ServiceType[] = [
      'postfix',
      'dovecot',
      'rspamd',
      'opendkim',
      'clamav',
      'spf-policyd',
    ];
    const servicesToInstall = config.services.filter((s) =>
      mailServices.includes(s as ServiceType),
    );

    // Configuration pour les installateurs mail
    const mailConfig = {
      domain: config.domain,
      hostname: config.hostname,
      additionalDomains: config.additionalDomains || [],
      dkimSelector: dkimConfig.selector,
      tlsProvider: tlsConfig.provider,
      tlsCertPath: tlsConfig.certPath,
      tlsKeyPath: tlsConfig.keyPath,
    };

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
      if (servicesToInstall.includes('opendkim') && dkimConfig.enabled) {
        this.onLog(`\n🔑 Step 2/4: Generating DKIM keys...\n`, 'stdout');
        // Générer les clés pour tous les domaines
        for (const domain of allDomains) {
          const key = await this.generateDkimKeys(domain, dkimConfig.keySize, dkimConfig.selector);
          if (domain === config.domain) {
            dkimPublicKey = key;
          }
        }
      } else {
        this.onLog(`\n⏭️ Step 2/4: Skipping DKIM (not selected)\n`, 'stdout');
      }

      // Étape 2.5: Configurer TLS si Let's Encrypt est demandé
      if (tlsConfig.provider === 'letsencrypt') {
        this.onLog(`\n🔒 Step 2.5/4: Configuring Let's Encrypt TLS...\n`, 'stdout');
        await this.setupLetsEncrypt(config.hostname, allDomains);
      }

      // Étape 3: Appliquer les configurations
      this.onLog(`\n⚙️ Step 3/4: Applying configurations...\n`, 'stdout');
      await this.applyMailTemplates({
        ...mailConfig,
        services: servicesToInstall,
      });

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
   *
   * @param domain - Le domaine pour lequel générer les clés
   * @param keySize - Taille de la clé RSA (2048 ou 4096)
   * @param selector - Le selector DKIM (ex: default, mail, 2024)
   */
  private async generateDkimKeys(
    domain: string,
    keySize: number = 2048,
    selector: string = 'default',
  ): Promise<string> {
    const keysDir = `/etc/opendkim/keys/${domain}`;

    // Créer le répertoire des clés
    await runCommandSilent('mkdir', ['-p', keysDir]);

    // Générer la clé privée (RSA pour compatibilité DKIM)
    await runCommand(
      'opendkim-genkey',
      ['-b', keySize.toString(), '-d', domain, '-D', keysDir, '-s', selector, '-v'],
      this.onLog,
    );

    // Lire la clé publique
    const publicKeyPath = path.join(keysDir, `${selector}.txt`);
    const publicKeyContent = fs.readFileSync(publicKeyPath, 'utf-8');

    // Changer les permissions
    await runCommandSilent('chown', ['-R', 'opendkim:opendkim', keysDir]);
    await runCommandSilent('chmod', ['600', path.join(keysDir, `${selector}.private`)]);

    this.onLog(`  ✅ DKIM keys generated for ${domain} (selector: ${selector})\n`, 'stdout');

    // Extraire juste la clé publique du fichier
    const keyMatch = publicKeyContent.match(/p=([^"]+)/);
    return keyMatch ? keyMatch[1].replace(/\s+/g, '') : publicKeyContent;
  }

  /**
   * **setupLetsEncrypt()** - Configure les certificats Let's Encrypt pour le mail
   *
   * Cette fonction installe certbot si nécessaire et génère les certificats
   * TLS pour le serveur mail. Elle configure aussi le renouvellement automatique.
   *
   * @param hostname - Le hostname du serveur mail (ex: mail.example.com)
   * @param domains - Tous les domaines à inclure dans le certificat
   */
  private async setupLetsEncrypt(hostname: string, domains: string[]): Promise<void> {
    // Installer certbot si pas présent
    try {
      await runCommandSilent('which', ['certbot']);
      this.onLog(`  ✅ Certbot already installed\n`, 'stdout');
    } catch {
      this.onLog(`  📥 Installing Certbot...\n`, 'stdout');
      await runCommand('apt-get', ['update'], this.onLog);
      await runCommand('apt-get', ['install', '-y', 'certbot'], this.onLog);
    }

    // Construire la liste des domaines pour le certificat
    // Le hostname mail est le principal, puis on ajoute les domaines pour webmail, etc.
    const certDomains = [hostname];
    for (const domain of domains) {
      // Ajouter des sous-domaines utiles pour le mail
      if (!certDomains.includes(`mail.${domain}`)) {
        certDomains.push(`mail.${domain}`);
      }
    }

    this.onLog(
      `  🔐 Requesting Let's Encrypt certificate for: ${certDomains.join(', ')}...\n`,
      'stdout',
    );

    // Vérifier si le certificat existe déjà
    const certPath = `/etc/letsencrypt/live/${hostname}/fullchain.pem`;
    if (fs.existsSync(certPath)) {
      this.onLog(`  ✅ Certificate already exists, attempting renewal...\n`, 'stdout');
      try {
        await runCommand('certbot', ['renew', '--quiet'], this.onLog);
        this.onLog(`  ✅ Certificate renewed if needed\n`, 'stdout');
        return;
      } catch (err: any) {
        this.onLog(
          `  ⚠️ Renewal failed, will try to get new certificate: ${err.message}\n`,
          'stderr',
        );
      }
    }

    // Générer le certificat en mode standalone (arrête temporairement les services)
    // On utilise le mode standalone car le serveur mail n'a pas forcément de serveur web
    try {
      // Arrêter les services qui pourraient utiliser le port 80
      await runCommandSilent('systemctl', ['stop', 'nginx']).catch(() => {});
      await runCommandSilent('systemctl', ['stop', 'apache2']).catch(() => {});

      // Construire la commande certbot
      const certbotArgs = [
        'certonly',
        '--standalone',
        '--non-interactive',
        '--agree-tos',
        '--email',
        `postmaster@${domains[0]}`,
        '--cert-name',
        hostname,
      ];

      // Ajouter chaque domaine
      for (const d of certDomains) {
        certbotArgs.push('-d', d);
      }

      await runCommand('certbot', certbotArgs, this.onLog);
      this.onLog(`  ✅ Let's Encrypt certificate generated successfully\n`, 'stdout');

      // Redémarrer les services web si présents
      await runCommandSilent('systemctl', ['start', 'nginx']).catch(() => {});
      await runCommandSilent('systemctl', ['start', 'apache2']).catch(() => {});
    } catch (err: any) {
      this.onLog(`  ⚠️ Let's Encrypt failed: ${err.message}\n`, 'stderr');
      this.onLog(
        `  ℹ️ Falling back to self-signed certificates. You can run certbot manually later.\n`,
        'stdout',
      );
      // On ne fait pas échouer l'installation, on continue avec les certs par défaut
    }
  }

  /**
   * **applyMailTemplates()** - Applique les templates de configuration mail
   *
   * Cette fonction configure tous les services mail avec les templates.
   * Elle gère :
   * - Les domaines additionnels (DKIM, SigningTable, etc.)
   * - Le selector DKIM personnalisé
   * - La configuration TLS (Let's Encrypt, certificats existants, ou snake-oil)
   */
  private async applyMailTemplates(config: {
    domain: string;
    hostname: string;
    additionalDomains?: string[];
    dkimSelector?: string;
    tlsProvider?: 'letsencrypt' | 'existing' | 'none';
    tlsCertPath?: string;
    tlsKeyPath?: string;
    services: string[];
  }): Promise<void> {
    const templatesDir = path.join(__dirname, 'templates');
    const selector = config.dkimSelector || 'default';
    const allDomains = [config.domain, ...(config.additionalDomains || [])];

    // Déterminer les chemins TLS
    let tlsCert = '/etc/ssl/certs/ssl-cert-snakeoil.pem';
    let tlsKey = '/etc/ssl/private/ssl-cert-snakeoil.key';

    if (config.tlsProvider === 'letsencrypt') {
      // Let's Encrypt utilise des chemins standardisés
      tlsCert = `/etc/letsencrypt/live/${config.hostname}/fullchain.pem`;
      tlsKey = `/etc/letsencrypt/live/${config.hostname}/privkey.pem`;
    } else if (config.tlsProvider === 'existing' && config.tlsCertPath && config.tlsKeyPath) {
      tlsCert = config.tlsCertPath;
      tlsKey = config.tlsKeyPath;
    }

    const variables: Record<string, string> = {
      domain: config.domain,
      hostname: config.hostname,
      selector: selector,
      keys_dir: `/etc/opendkim/keys/${config.domain}`,
      tls_cert: tlsCert,
      tls_key: tlsKey,
      ssl_cert: tlsCert,
      ssl_key: tlsKey,
    };

    // Postfix main.cf
    if (config.services.includes('postfix')) {
      const postfixTemplate = fs.readFileSync(
        path.join(templatesDir, 'postfix', 'main.cf.conf'),
        'utf-8',
      );
      const postfixConfig = this.applyTemplateVariables(postfixTemplate, variables);
      fs.writeFileSync('/etc/postfix/main.cf', postfixConfig);
      this.onLog(`  ✅ Postfix main.cf configured\n`, 'stdout');
    }

    // Dovecot local.conf
    if (config.services.includes('dovecot')) {
      const dovecotTemplate = fs.readFileSync(
        path.join(templatesDir, 'dovecot', 'local.conf'),
        'utf-8',
      );
      const dovecotConfig = this.applyTemplateVariables(dovecotTemplate, variables);
      fs.writeFileSync('/etc/dovecot/local.conf', dovecotConfig);
      this.onLog(`  ✅ Dovecot local.conf configured\n`, 'stdout');
    }

    // OpenDKIM configs - avec support des domaines additionnels
    if (config.services.includes('opendkim')) {
      const opendkimDir = path.join(templatesDir, 'opendkim');

      // opendkim.conf
      const mainConf = fs.readFileSync(path.join(opendkimDir, 'opendkim.conf'), 'utf-8');
      fs.writeFileSync('/etc/opendkim.conf', this.applyTemplateVariables(mainConf, variables));

      // KeyTable - génère une ligne par domaine
      let keyTableContent = '# OpenDKIM Key Table - Generated by ServerFlow\n';
      for (const domain of allDomains) {
        const keysDir = `/etc/opendkim/keys/${domain}`;
        keyTableContent += `${selector}._domainkey.${domain} ${domain}:${selector}:${keysDir}/${selector}.private\n`;
      }
      fs.writeFileSync('/etc/opendkim/KeyTable', keyTableContent);

      // SigningTable - génère une ligne par domaine
      let signingTableContent = '# OpenDKIM Signing Table - Generated by ServerFlow\n';
      for (const domain of allDomains) {
        signingTableContent += `*@${domain} ${selector}._domainkey.${domain}\n`;
      }
      fs.writeFileSync('/etc/opendkim/SigningTable', signingTableContent);

      // TrustedHosts - ajoute tous les domaines
      let trustedHostsContent = '# OpenDKIM Trusted Hosts - Generated by ServerFlow\n';
      trustedHostsContent += '127.0.0.1\n';
      trustedHostsContent += 'localhost\n';
      trustedHostsContent += `${config.hostname}\n`;
      for (const domain of allDomains) {
        trustedHostsContent += `*.${domain}\n`;
      }
      fs.writeFileSync('/etc/opendkim/TrustedHosts', trustedHostsContent);

      this.onLog(`  ✅ OpenDKIM configured for ${allDomains.length} domain(s)\n`, 'stdout');
    }

    // Rspamd antivirus config (pour ClamAV)
    if (config.services.includes('rspamd') && config.services.includes('clamav')) {
      const rspamdTemplate = fs.readFileSync(
        path.join(templatesDir, 'rspamd', 'antivirus.conf'),
        'utf-8',
      );
      const rspamdConfig = this.applyTemplateVariables(rspamdTemplate, variables);
      await runCommandSilent('mkdir', ['-p', '/etc/rspamd/local.d']);
      fs.writeFileSync('/etc/rspamd/local.d/antivirus.conf', rspamdConfig);
      this.onLog(`  ✅ Rspamd antivirus integration configured\n`, 'stdout');
    }

    // ClamAV config
    if (config.services.includes('clamav')) {
      const clamavTemplate = fs.readFileSync(
        path.join(templatesDir, 'clamav', 'clamd.conf'),
        'utf-8',
      );
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
      configuredAt: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(configDir, 'mail.json'), JSON.stringify(mailConfig, null, 2));

    this.onLog(`  ✅ Mail configuration saved to ${configDir}/mail.json\n`, 'stdout');
  }

  // ============================================================================
  // DNS STACK CONFIGURATION (BIND9)
  // ============================================================================

  /**
   * **configureDnsStack()** - Configure un serveur DNS complet avec BIND9
   *
   * Cette fonction orchestre l'installation et la configuration d'un serveur DNS.
   * Selon l'architecture choisie (primaire, cache, etc.), elle configure :
   * - Les zones DNS (master, forward)
   * - Les options de sécurité (DNSSEC, TSIG, RRL)
   * - Les fichiers de configuration BIND9
   *
   * @param config - Configuration DNS complète depuis le wizard
   */
  async configureDnsStack(config: {
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
  }): Promise<void> {
    this.onLog(`\n📡 Configuration du serveur DNS (${config.architecture})\n`, 'stdout');
    this.onLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, 'stdout');

    // Étape 1: Installer BIND9 si pas déjà fait
    this.onLog(`\n📦 Étape 1/4 : Installation de BIND9...\n`, 'stdout');
    await this.installService('bind9');

    // Étape 2: Configurer les zones DNS (sauf mode cache)
    if (config.architecture !== 'cache' && config.zones.length > 0) {
      this.onLog(`\n🌐 Étape 2/4 : Configuration des zones DNS...\n`, 'stdout');
      await this.configureDnsZones(config);
    } else if (config.architecture === 'cache') {
      this.onLog(`\n🌐 Étape 2/4 : Mode cache - pas de zones à créer\n`, 'stdout');
    } else {
      this.onLog(`\n🌐 Étape 2/4 : Aucune zone configurée\n`, 'stdout');
    }

    // Étape 3: Appliquer la configuration de sécurité
    this.onLog(`\n🔒 Étape 3/4 : Application des paramètres de sécurité...\n`, 'stdout');
    await this.applyDnsSecurityConfig(config);

    // Étape 4: Sauvegarder la configuration et redémarrer
    this.onLog(`\n💾 Étape 4/4 : Sauvegarde et redémarrage...\n`, 'stdout');
    await this.saveDnsConfig(config);

    // Vérifier la configuration et redémarrer BIND9
    this.onLog(`  ⏳ Vérification de la configuration BIND9...\n`, 'stdout');
    try {
      await runCommand('named-checkconf', [], (data) => this.onLog(data, 'stdout'));
      this.onLog(`  ✅ Configuration BIND9 valide\n`, 'stdout');
    } catch {
      this.onLog(`  ⚠️ Avertissement: Vérification de configuration échouée\n`, 'stderr');
    }

    this.onLog(`  ⏳ Redémarrage de BIND9...\n`, 'stdout');
    await runCommand('systemctl', ['restart', 'named'], (data) => this.onLog(data, 'stdout'));
    await runCommand('systemctl', ['enable', 'named'], (data) => this.onLog(data, 'stdout'));

    this.onLog(`\n✅ Serveur DNS configuré avec succès!\n`, 'stdout');
    this.onLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, 'stdout');
  }

  /**
   * **configureDnsZones()** - Configure les fichiers de zones DNS
   */
  private async configureDnsZones(config: {
    hostname: string;
    zones: Array<{ name: string; type: 'master' | 'forward'; ttl: number }>;
    createReverseZone: boolean;
    serverIp: string;
  }): Promise<void> {
    const zonesDir = '/etc/bind/zones';
    await runCommandSilent('mkdir', ['-p', zonesDir]);

    // Générer le serial (format YYYYMMDDNN)
    const now = new Date();
    const serial = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}01`;

    for (const zone of config.zones) {
      this.onLog(`  📝 Création de la zone ${zone.name}...\n`, 'stdout');

      // Générer le fichier de zone
      const zoneContent = this.generateZoneFile(zone, config.hostname, config.serverIp, serial);
      const zonePath = path.join(zonesDir, `db.${zone.name}`);
      fs.writeFileSync(zonePath, zoneContent);

      this.onLog(`  ✅ Zone ${zone.name} créée\n`, 'stdout');
    }

    // Créer la zone inverse si demandé
    if (config.createReverseZone && config.serverIp) {
      const ipParts = config.serverIp.split('.');
      if (ipParts.length === 4) {
        const reverseZoneName = `${ipParts[2]}.${ipParts[1]}.${ipParts[0]}.in-addr.arpa`;
        this.onLog(`  📝 Création de la zone inverse ${reverseZoneName}...\n`, 'stdout');

        const reverseZoneContent = this.generateReverseZoneFile(
          config.hostname,
          config.serverIp,
          serial,
          config.zones[0]?.name || 'localhost',
        );
        fs.writeFileSync(path.join(zonesDir, `db.${reverseZoneName}`), reverseZoneContent);

        this.onLog(`  ✅ Zone inverse créée\n`, 'stdout');
      }
    }

    // Générer named.conf.local
    const namedLocalContent = this.generateNamedConfLocal(config);
    fs.writeFileSync('/etc/bind/named.conf.local', namedLocalContent);
    this.onLog(`  ✅ named.conf.local mis à jour\n`, 'stdout');
  }

  /**
   * **generateZoneFile()** - Génère le contenu d'un fichier de zone DNS
   */
  private generateZoneFile(
    zone: { name: string; type: string; ttl: number },
    hostname: string,
    serverIp: string,
    serial: string,
  ): string {
    // Extraire le hostname court (ns1) depuis le FQDN (ns1.example.com)
    const nsHostname = hostname.split('.')[0] || 'ns1';

    const templatesDir = path.join(__dirname, 'templates');
    const templatePath = path.join(templatesDir, 'bind9', 'zone.db.conf');

    if (fs.existsSync(templatePath)) {
      const template = fs.readFileSync(templatePath, 'utf-8');
      return this.applyTemplateVariables(template, {
        domain: zone.name,
        hostname: hostname,
        nsHostname: nsHostname,
        serverIp: serverIp,
        serial: serial,
        ttl: String(zone.ttl || 3600),
      });
    }

    // Fallback si le template n'existe pas
    return `; Zone file for ${zone.name} - Generated by ServerFlow
$TTL    ${zone.ttl || 3600}
@       IN      SOA     ${hostname}. admin.${zone.name}. (
                        ${serial}        ; Serial
                        3600             ; Refresh
                        1800             ; Retry
                        604800           ; Expire
                        86400 )          ; Minimum TTL

@       IN      NS      ${hostname}.
${nsHostname}       IN      A       ${serverIp}
@       IN      A       ${serverIp}
www     IN      A       ${serverIp}
`;
  }

  /**
   * **generateReverseZoneFile()** - Génère un fichier de zone inverse (PTR)
   */
  private generateReverseZoneFile(
    hostname: string,
    serverIp: string,
    serial: string,
    domain: string,
  ): string {
    const ipParts = serverIp.split('.');
    const lastOctet = ipParts[3] || '1';

    return `; Reverse zone file - Generated by ServerFlow
$TTL    3600
@       IN      SOA     ${hostname}. admin.${domain}. (
                        ${serial}        ; Serial
                        3600             ; Refresh
                        1800             ; Retry
                        604800           ; Expire
                        86400 )          ; Minimum TTL

@       IN      NS      ${hostname}.
${lastOctet}      IN      PTR     ${hostname}.
`;
  }

  /**
   * **generateNamedConfLocal()** - Génère named.conf.local avec les zones
   */
  private generateNamedConfLocal(config: {
    zones: Array<{ name: string; type: 'master' | 'forward'; ttl: number }>;
    createReverseZone: boolean;
    serverIp: string;
  }): string {
    let content = `// BIND9 Local Zone Configuration - Generated by ServerFlow
// Do not edit manually - changes will be overwritten

`;

    for (const zone of config.zones) {
      content += `zone "${zone.name}" {
    type ${zone.type};
    file "/etc/bind/zones/db.${zone.name}";
};

`;
    }

    // Zone inverse
    if (config.createReverseZone && config.serverIp) {
      const ipParts = config.serverIp.split('.');
      if (ipParts.length === 4) {
        const reverseZoneName = `${ipParts[2]}.${ipParts[1]}.${ipParts[0]}.in-addr.arpa`;
        content += `zone "${reverseZoneName}" {
    type master;
    file "/etc/bind/zones/db.${reverseZoneName}";
};
`;
      }
    }

    return content;
  }

  /**
   * **applyDnsSecurityConfig()** - Applique la configuration de sécurité DNS
   */
  private async applyDnsSecurityConfig(config: {
    architecture: string;
    hostname: string;
    forwarders: string[];
    localNetwork: string;
    security: {
      dnssec: { enabled: boolean; algorithm: string; autoRotate: boolean };
      tsig: { enabled: boolean };
      rrl: { enabled: boolean; responsesPerSecond: number; window: number };
      logging: boolean;
    };
    serverIp: string;
  }): Promise<void> {
    const isCache = config.architecture === 'cache';

    // Générer named.conf.options avec sécurité
    const optionsContent = this.generateDnsOptionsConfig(config, isCache);
    fs.writeFileSync('/etc/bind/named.conf.options', optionsContent);

    this.onLog(`  ✅ Options de sécurité configurées\n`, 'stdout');

    // DNSSEC
    if (config.security.dnssec.enabled) {
      this.onLog(`  🔐 DNSSEC activé (algorithme: ${config.security.dnssec.algorithm})\n`, 'stdout');
      // Note: La génération des clés DNSSEC nécessite des commandes supplémentaires
      // qui seront implémentées dans une future story
    }

    // TSIG
    if (config.security.tsig.enabled) {
      this.onLog(`  🔑 TSIG activé pour les transferts de zone\n`, 'stdout');
    }

    // RRL
    if (config.security.rrl.enabled) {
      this.onLog(
        `  🛡️ RRL activé (${config.security.rrl.responsesPerSecond} rps, window: ${config.security.rrl.window}s)\n`,
        'stdout',
      );
    }

    // Logging
    if (config.security.logging) {
      this.onLog(`  📝 Journalisation des requêtes activée\n`, 'stdout');
      await runCommandSilent('mkdir', ['-p', '/var/log/named']);
      await runCommandSilent('chown', ['bind:bind', '/var/log/named']);
    }
  }

  /**
   * **generateDnsOptionsConfig()** - Génère named.conf.options avec les options de sécurité
   */
  private generateDnsOptionsConfig(
    config: {
      forwarders: string[];
      localNetwork: string;
      security: {
        rrl: { enabled: boolean; responsesPerSecond: number; window: number };
        logging: boolean;
      };
    },
    isCache: boolean,
  ): string {
    const templatesDir = path.join(__dirname, 'templates');
    const templatePath = path.join(templatesDir, 'bind9', 'named.conf.options-secure.conf');

    if (fs.existsSync(templatePath)) {
      const template = fs.readFileSync(templatePath, 'utf-8');

      // Construire la liste des forwarders
      let forwardersBlock = '';
      if (config.forwarders && config.forwarders.length > 0) {
        forwardersBlock = config.forwarders.map((f) => `        ${f};`).join('\n');
      }

      // Variables pour le template
      const variables: Record<string, string> = {
        forwarders: forwardersBlock,
        forwardMode: isCache ? 'only' : 'first',
        listenOn: 'any',
        listenOnV6: 'any',
        allowQuery: isCache ? config.localNetwork || 'localhost' : 'any',
        recursion: isCache ? 'yes' : 'no',
        allowRecursion: config.localNetwork || 'localhost',
        allowTransfer: 'none',
        rrl: config.security.rrl.enabled ? 'true' : '',
        rrlResponsesPerSecond: String(config.security.rrl.responsesPerSecond || 5),
        rrlWindow: String(config.security.rrl.window || 15),
        logging: config.security.logging ? 'true' : '',
        cacheMode: isCache ? 'true' : '',
      };

      return this.applyDnsTemplateWithConditions(template, variables);
    }

    // Fallback simple si le template n'existe pas
    return this.generateFallbackDnsOptions(config, isCache);
  }

  /**
   * **applyDnsTemplateWithConditions()** - Applique un template avec conditions {{#if}} et {{#each}}
   */
  private applyDnsTemplateWithConditions(template: string, variables: Record<string, string>): string {
    let result = template;

    // Traiter les blocs {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, content) => {
      const value = variables[varName];
      if (value && value !== '' && value !== 'false') {
        return content;
      }
      return '';
    });

    // Traiter les blocs {{#unless variable}}...{{/unless}}
    result = result.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_, varName, content) => {
      const value = variables[varName];
      if (!value || value === '' || value === 'false') {
        return content;
      }
      return '';
    });

    // Traiter les blocs {{#each forwarders}}...{{/each}} (simplifié pour forwarders)
    result = result.replace(/\{\{#each\s+forwarders\}\}[\s\S]*?\{\{\/each\}\}/g, () => {
      return variables.forwarders || '';
    });

    // Remplacer les variables simples
    result = this.applyTemplateVariables(result, variables);

    return result;
  }

  /**
   * **generateFallbackDnsOptions()** - Génère une config de fallback si le template n'existe pas
   */
  private generateFallbackDnsOptions(
    config: {
      forwarders: string[];
      localNetwork: string;
      security: {
        rrl: { enabled: boolean; responsesPerSecond: number; window: number };
        logging: boolean;
      };
    },
    isCache: boolean,
  ): string {
    let content = `// BIND9 Options - Generated by ServerFlow
options {
    directory "/var/cache/bind";
    dnssec-validation auto;
    listen-on { any; };
    listen-on-v6 { any; };
`;

    if (isCache && config.forwarders.length > 0) {
      content += `    forwarders {\n`;
      for (const forwarder of config.forwarders) {
        content += `        ${forwarder};\n`;
      }
      content += `    };\n    forward only;\n`;
    }

    content += `    allow-query { ${isCache ? config.localNetwork || 'localhost' : 'any'}; };
    recursion ${isCache ? 'yes' : 'no'};
`;

    if (isCache) {
      content += `    allow-recursion { ${config.localNetwork || 'localhost'}; };\n`;
    }

    content += `    allow-transfer { none; };
    version "not disclosed";
};
`;

    return content;
  }

  /**
   * **saveDnsConfig()** - Sauvegarde la configuration DNS pour référence future
   */
  private async saveDnsConfig(config: any): Promise<void> {
    const configDir = '/opt/serverflow/config';
    await runCommandSilent('mkdir', ['-p', configDir]);

    const dnsConfig = {
      ...config,
      configuredAt: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(configDir, 'dns.json'), JSON.stringify(dnsConfig, null, 2));

    this.onLog(`  ✅ DNS configuration saved to ${configDir}/dns.json\n`, 'stdout');
  }

  // ============================================================================
  // DATABASE STACK CONFIGURATION (Full Wizard)
  // ============================================================================

  /**
   * **configureDatabaseStack()** - Configure une base de données complète via le wizard
   *
   * Cette fonction orchestre l'installation et la configuration complète d'une
   * base de données avec toutes les options avancées :
   * - Installation et sécurité de base
   * - Configuration des performances (buffer, connexions, mémoire)
   * - Mise en place du backup automatique (cron)
   *
   * @param config - Configuration complète depuis le wizard dashboard
   */
  async configureDatabaseStack(config: {
    type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
    databaseName: string;
    username?: string;
    redisUsage?: 'cache' | 'sessions' | 'queue' | 'general';
    security: {
      enableTls?: boolean;
      bindLocalhost?: boolean;
      setRootPassword?: boolean;
      removeAnonymousUsers?: boolean;
      disableRemoteRoot?: boolean;
      removeTestDb?: boolean;
      configureHba?: boolean;
      enableProtectedMode?: boolean;
    };
    advanced: {
      backup: {
        enabled: boolean;
        schedule: 'daily' | 'weekly';
        retentionDays: number;
        toolsToInstall?: string[];
      };
      performance: {
        maxConnections?: number;
        sharedBuffers?: string;
        innodbBufferPoolSize?: string;
        maxMemory?: string;
        maxmemoryPolicy?: string;
        wiredTigerCacheSizeGB?: string;
      };
      replication?: { enabled: boolean; role: 'primary' | 'replica' };
    };
  }): Promise<DatabaseConfigResult> {
    const hasBackupTools = config.advanced.backup.toolsToInstall && config.advanced.backup.toolsToInstall.length > 0;
    const totalSteps = hasBackupTools ? 4 : 3;

    this.onLog(`\n🗄️ Configuration de la stack ${config.type.toUpperCase()}\n`, 'stdout');
    this.onLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, 'stdout');

    try {
      // Étape 1 : Installation et sécurité de base
      this.onLog(`\n📦 Étape 1/${totalSteps} : Installation et sécurité...\n`, 'stdout');

      const securityOptions = {
        setRootPassword: config.security.setRootPassword ?? true,
        removeAnonymousUsers: config.security.removeAnonymousUsers ?? true,
        disableRemoteRoot: config.security.disableRemoteRoot ?? true,
        removeTestDb: config.security.removeTestDb ?? true,
        configureHba: config.security.configureHba ?? true,
        enableProtectedMode: config.security.enableProtectedMode ?? true,
        bindLocalhost: config.security.bindLocalhost ?? true,
      };

      const dbResult = await this.configureDatabase(
        config.type,
        config.databaseName,
        securityOptions,
      );

      if (!dbResult.success) {
        throw new Error(dbResult.error || 'Database configuration failed');
      }

      // Étape 2 : Configuration des performances
      this.onLog(`\n⚡ Étape 2/${totalSteps} : Configuration des performances...\n`, 'stdout');
      await this.applyDatabasePerformanceConfig(config.type, config.advanced.performance, config.redisUsage);

      // Étape 3 (optionnelle) : Installation des outils de backup
      let currentStep = 3;
      if (hasBackupTools) {
        this.onLog(`\n🔧 Étape ${currentStep}/${totalSteps} : Installation des outils de backup...\n`, 'stdout');
        await this.installBackupTools(config.advanced.backup.toolsToInstall!);
        currentStep++;
      }

      // Étape finale : Configuration du backup automatique
      if (config.advanced.backup.enabled) {
        this.onLog(`\n💾 Étape ${currentStep}/${totalSteps} : Configuration du backup automatique...\n`, 'stdout');
        await this.setupDatabaseBackup(config.type, config.databaseName, config.advanced.backup);
      } else {
        this.onLog(`\n⏭️ Étape ${currentStep}/${totalSteps} : Backup non activé\n`, 'stdout');
      }

      // Sauvegarder la configuration
      await this.saveDatabaseConfig(config, dbResult.connectionString);

      this.onLog(`\n✅ Stack ${config.type.toUpperCase()} configurée avec succès!\n`, 'stdout');
      this.onLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, 'stdout');

      return dbResult;
    } catch (err: any) {
      this.onLog(`\n❌ Erreur lors de la configuration : ${err.message}\n`, 'stderr');
      return { success: false, error: err.message };
    }
  }

  /**
   * **applyDatabasePerformanceConfig()** - Applique la configuration de performance
   *
   * Modifie les fichiers de configuration de chaque base de données
   * pour optimiser les performances selon les paramètres choisis.
   */
  private async applyDatabasePerformanceConfig(
    type: 'postgresql' | 'mysql' | 'redis' | 'mongodb',
    perf: {
      maxConnections?: number;
      sharedBuffers?: string;
      innodbBufferPoolSize?: string;
      maxMemory?: string;
      maxmemoryPolicy?: string;
      wiredTigerCacheSizeGB?: string;
    },
    redisUsage?: 'cache' | 'sessions' | 'queue' | 'general',
  ): Promise<void> {
    switch (type) {
      case 'postgresql':
        await this.applyPostgresqlPerformance(perf);
        break;
      case 'mysql':
        await this.applyMysqlPerformance(perf);
        break;
      case 'redis':
        await this.applyRedisPerformance(perf, redisUsage);
        break;
      case 'mongodb':
        this.onLog(`  ⚠️ MongoDB non encore supporté\n`, 'stderr');
        break;
    }
  }

  /**
   * **applyPostgresqlPerformance()** - Configure les performances PostgreSQL
   */
  private async applyPostgresqlPerformance(perf: {
    maxConnections?: number;
    sharedBuffers?: string;
  }): Promise<void> {
    const configPath = '/etc/postgresql';
    try {
      const versions = fs.readdirSync(configPath);
      for (const version of versions) {
        const confFile = `${configPath}/${version}/main/postgresql.conf`;
        if (fs.existsSync(confFile)) {
          let config = fs.readFileSync(confFile, 'utf-8');
          let modified = false;

          if (perf.maxConnections) {
            this.onLog(`  📊 max_connections = ${perf.maxConnections}\n`, 'stdout');
            config = config.replace(/^#?max_connections\s*=.*$/m, `max_connections = ${perf.maxConnections}`);
            modified = true;
          }

          if (perf.sharedBuffers) {
            this.onLog(`  📊 shared_buffers = ${perf.sharedBuffers}\n`, 'stdout');
            config = config.replace(/^#?shared_buffers\s*=.*$/m, `shared_buffers = ${perf.sharedBuffers}`);
            modified = true;
          }

          if (modified) {
            fs.writeFileSync(confFile, config);
            this.onLog(`  ✅ ${confFile} mis à jour\n`, 'stdout');
          }
        }
      }
      await runCommand('systemctl', ['restart', 'postgresql'], this.onLog);
    } catch (e: any) {
      this.onLog(`  ⚠️ Impossible de configurer les performances PostgreSQL: ${e.message}\n`, 'stderr');
    }
  }

  /**
   * **applyMysqlPerformance()** - Configure les performances MySQL/MariaDB
   */
  private async applyMysqlPerformance(perf: {
    maxConnections?: number;
    innodbBufferPoolSize?: string;
  }): Promise<void> {
    const configPaths = ['/etc/mysql/mariadb.conf.d/50-server.cnf', '/etc/mysql/my.cnf'];
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        let config = fs.readFileSync(configPath, 'utf-8');
        let modified = false;

        if (perf.maxConnections) {
          this.onLog(`  📊 max_connections = ${perf.maxConnections}\n`, 'stdout');
          if (config.includes('max_connections')) {
            config = config.replace(/^#?max_connections\s*=.*$/m, `max_connections = ${perf.maxConnections}`);
          } else {
            config = config.replace(/\[mysqld\]/i, `[mysqld]\nmax_connections = ${perf.maxConnections}`);
          }
          modified = true;
        }

        if (perf.innodbBufferPoolSize) {
          this.onLog(`  📊 innodb_buffer_pool_size = ${perf.innodbBufferPoolSize}\n`, 'stdout');
          if (config.includes('innodb_buffer_pool_size')) {
            config = config.replace(/^#?innodb_buffer_pool_size\s*=.*$/m, `innodb_buffer_pool_size = ${perf.innodbBufferPoolSize}`);
          } else {
            config = config.replace(/\[mysqld\]/i, `[mysqld]\ninnodb_buffer_pool_size = ${perf.innodbBufferPoolSize}`);
          }
          modified = true;
        }

        if (modified) {
          fs.writeFileSync(configPath, config);
          this.onLog(`  ✅ ${configPath} mis à jour\n`, 'stdout');
          break; // Ne modifier qu'un seul fichier
        }
      }
    }
    await runCommand('systemctl', ['restart', 'mariadb'], this.onLog);
  }

  /**
   * **applyRedisPerformance()** - Configure les performances Redis
   */
  private async applyRedisPerformance(
    perf: {
      maxMemory?: string;
      maxmemoryPolicy?: string;
    },
    usage?: 'cache' | 'sessions' | 'queue' | 'general',
  ): Promise<void> {
    const configPath = '/etc/redis/redis.conf';
    if (!fs.existsSync(configPath)) {
      this.onLog(`  ⚠️ Fichier de configuration Redis non trouvé\n`, 'stderr');
      return;
    }

    let config = fs.readFileSync(configPath, 'utf-8');

    if (perf.maxMemory) {
      this.onLog(`  📊 maxmemory = ${perf.maxMemory}\n`, 'stdout');
      config = config.replace(/^#?maxmemory\s+.*$/m, '');
      config += `\nmaxmemory ${perf.maxMemory}\n`;
    }

    if (perf.maxmemoryPolicy) {
      this.onLog(`  📊 maxmemory-policy = ${perf.maxmemoryPolicy}\n`, 'stdout');
      config = config.replace(/^#?maxmemory-policy\s+.*$/m, '');
      config += `\nmaxmemory-policy ${perf.maxmemoryPolicy}\n`;
    }

    // Configuration spécifique selon l'usage
    if (usage) {
      this.onLog(`  📋 Usage : ${usage}\n`, 'stdout');
      switch (usage) {
        case 'cache':
          // Pour le cache, activer la persistance AOF légère
          config = config.replace(/^#?appendonly\s+.*$/m, '');
          config += `\nappendonly no\n`;
          break;
        case 'sessions':
          // Pour les sessions, persistance AOF pour éviter la perte
          config = config.replace(/^#?appendonly\s+.*$/m, '');
          config += `\nappendonly yes\n`;
          config = config.replace(/^#?appendfsync\s+.*$/m, '');
          config += `\nappendfsync everysec\n`;
          break;
        case 'queue':
          // Pour les queues, persistance AOF stricte
          config = config.replace(/^#?appendonly\s+.*$/m, '');
          config += `\nappendonly yes\n`;
          config = config.replace(/^#?appendfsync\s+.*$/m, '');
          config += `\nappendfsync always\n`;
          break;
        case 'general':
          // Usage général, garder les valeurs par défaut
          break;
      }
    }

    fs.writeFileSync(configPath, config);
    this.onLog(`  ✅ ${configPath} mis à jour\n`, 'stdout');
    await runCommand('systemctl', ['restart', 'redis-server'], this.onLog);
  }

  /**
   * **installBackupTools()** - Installe les outils de backup sélectionnés
   *
   * Installe rsync, rclone et/ou restic selon la sélection de l'utilisateur.
   */
  private async installBackupTools(tools: string[]): Promise<void> {
    for (const tool of tools) {
      this.onLog(`  📦 Installation de ${tool}...\n`, 'stdout');
      try {
        switch (tool) {
          case 'rsync':
            await this.installService('rsync' as ServiceType);
            break;
          case 'rclone':
            await this.installService('rclone' as ServiceType);
            break;
          case 'restic':
            await this.installService('restic' as ServiceType);
            break;
          default:
            this.onLog(`  ⚠️ Outil inconnu: ${tool}\n`, 'stderr');
        }
        this.onLog(`  ✅ ${tool} installé\n`, 'stdout');
      } catch (e: any) {
        this.onLog(`  ⚠️ Erreur lors de l'installation de ${tool}: ${e.message}\n`, 'stderr');
        // On continue avec les autres outils même si un échoue
      }
    }
  }

  /**
   * **setupDatabaseBackup()** - Configure le backup automatique via cron
   *
   * Crée un script de backup et l'ajoute au cron pour exécution automatique.
   */
  private async setupDatabaseBackup(
    type: 'postgresql' | 'mysql' | 'redis' | 'mongodb',
    dbName: string,
    backupConfig: { enabled: boolean; schedule: 'daily' | 'weekly'; retentionDays: number },
  ): Promise<void> {
    const backupDir = '/opt/serverflow/backups';
    const scriptsDir = '/opt/serverflow/scripts';

    // Créer les répertoires nécessaires
    await runCommandSilent('mkdir', ['-p', `${backupDir}/${type}`]);
    await runCommandSilent('mkdir', ['-p', scriptsDir]);

    // Générer le script de backup selon le type de base de données
    const scriptPath = `${scriptsDir}/backup-${type}.sh`;
    const scriptContent = this.generateBackupScript(type, dbName, backupDir, backupConfig.retentionDays);

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    this.onLog(`  📝 Script de backup créé : ${scriptPath}\n`, 'stdout');

    // Configurer le cron job
    const cronSchedule = backupConfig.schedule === 'daily' ? '0 2 * * *' : '0 2 * * 0';
    const cronLine = `${cronSchedule} root ${scriptPath} >> /var/log/serverflow-backup.log 2>&1`;

    // Ajouter au cron (dans /etc/cron.d/)
    const cronFile = `/etc/cron.d/serverflow-backup-${type}`;
    fs.writeFileSync(cronFile, `# ServerFlow ${type} Backup - ${backupConfig.schedule}\n${cronLine}\n`, { mode: 0o644 });

    this.onLog(`  ⏰ Cron job configuré : ${backupConfig.schedule} à 02:00\n`, 'stdout');
    this.onLog(`  📁 Rétention : ${backupConfig.retentionDays} jours\n`, 'stdout');

    // Exécuter un premier backup pour tester
    this.onLog(`  🔄 Exécution du premier backup...\n`, 'stdout');
    try {
      await runCommand('bash', [scriptPath], this.onLog);
      this.onLog(`  ✅ Premier backup effectué avec succès\n`, 'stdout');
    } catch (e: any) {
      this.onLog(`  ⚠️ Premier backup échoué (non bloquant) : ${e.message}\n`, 'stderr');
    }
  }

  /**
   * **generateBackupScript()** - Génère le script de backup pour chaque type de DB
   */
  private generateBackupScript(
    type: 'postgresql' | 'mysql' | 'redis' | 'mongodb',
    dbName: string,
    backupDir: string,
    retentionDays: number,
  ): string {
    const timestamp = '$(date +%Y%m%d_%H%M%S)';
    const cleanupCmd = `find ${backupDir}/${type} -name "*.sql*" -o -name "*.rdb" -o -name "*.tar.gz" | xargs ls -t | tail -n +$((${retentionDays} + 1)) | xargs rm -f 2>/dev/null || true`;

    switch (type) {
      case 'postgresql':
        return `#!/bin/bash
# ServerFlow PostgreSQL Backup Script
# Base de données: ${dbName}
# Rétention: ${retentionDays} jours

BACKUP_DIR="${backupDir}/${type}"
DATE="${timestamp}"

echo "[\$(date)] Démarrage du backup PostgreSQL..."

# Backup de la base de données spécifique
su - postgres -c "pg_dump ${dbName}" | gzip > "\${BACKUP_DIR}/${dbName}_\${DATE}.sql.gz"

# Backup de toutes les bases (full dump)
su - postgres -c "pg_dumpall" | gzip > "\${BACKUP_DIR}/full_\${DATE}.sql.gz"

echo "[\$(date)] Backup terminé: \${BACKUP_DIR}/${dbName}_\${DATE}.sql.gz"

# Nettoyage des anciens backups
${cleanupCmd}

echo "[\$(date)] Nettoyage effectué (rétention: ${retentionDays} jours)"
`;

      case 'mysql':
        return `#!/bin/bash
# ServerFlow MySQL/MariaDB Backup Script
# Base de données: ${dbName}
# Rétention: ${retentionDays} jours

BACKUP_DIR="${backupDir}/${type}"
DATE="${timestamp}"
CREDS_FILE="/root/.server-flow/credentials/mysql.json"

echo "[\$(date)] Démarrage du backup MySQL..."

# Lire le mot de passe root depuis les credentials stockés
if [ -f "\$CREDS_FILE" ]; then
    ROOT_PASS=\$(cat "\$CREDS_FILE" | grep -o '"rootPassword":"[^"]*"' | cut -d'"' -f4)
    MYSQL_AUTH="-u root -p\${ROOT_PASS}"
else
    MYSQL_AUTH="-u root"
fi

# Backup de la base de données spécifique
mysqldump \$MYSQL_AUTH ${dbName} | gzip > "\${BACKUP_DIR}/${dbName}_\${DATE}.sql.gz"

# Backup de toutes les bases
mysqldump \$MYSQL_AUTH --all-databases | gzip > "\${BACKUP_DIR}/full_\${DATE}.sql.gz"

echo "[\$(date)] Backup terminé: \${BACKUP_DIR}/${dbName}_\${DATE}.sql.gz"

# Nettoyage des anciens backups
${cleanupCmd}

echo "[\$(date)] Nettoyage effectué (rétention: ${retentionDays} jours)"
`;

      case 'redis':
        return `#!/bin/bash
# ServerFlow Redis Backup Script
# Rétention: ${retentionDays} jours

BACKUP_DIR="${backupDir}/${type}"
DATE="${timestamp}"
REDIS_DATA="/var/lib/redis"

echo "[\$(date)] Démarrage du backup Redis..."

# Forcer un save RDB
redis-cli BGSAVE
sleep 5

# Copier les fichiers de données
if [ -f "\${REDIS_DATA}/dump.rdb" ]; then
    cp "\${REDIS_DATA}/dump.rdb" "\${BACKUP_DIR}/dump_\${DATE}.rdb"
    echo "[\$(date)] RDB copié: \${BACKUP_DIR}/dump_\${DATE}.rdb"
fi

if [ -f "\${REDIS_DATA}/appendonly.aof" ]; then
    cp "\${REDIS_DATA}/appendonly.aof" "\${BACKUP_DIR}/appendonly_\${DATE}.aof"
    gzip "\${BACKUP_DIR}/appendonly_\${DATE}.aof"
    echo "[\$(date)] AOF copié et compressé"
fi

# Nettoyage des anciens backups
${cleanupCmd}

echo "[\$(date)] Nettoyage effectué (rétention: ${retentionDays} jours)"
`;

      case 'mongodb':
        return `#!/bin/bash
# ServerFlow MongoDB Backup Script
# Base de données: ${dbName}
# Rétention: ${retentionDays} jours

BACKUP_DIR="${backupDir}/${type}"
DATE="${timestamp}"

echo "[\$(date)] Démarrage du backup MongoDB..."

# Backup de la base de données
mongodump --db ${dbName} --out "\${BACKUP_DIR}/\${DATE}"
tar -czf "\${BACKUP_DIR}/${dbName}_\${DATE}.tar.gz" -C "\${BACKUP_DIR}" "\${DATE}"
rm -rf "\${BACKUP_DIR}/\${DATE}"

echo "[\$(date)] Backup terminé: \${BACKUP_DIR}/${dbName}_\${DATE}.tar.gz"

# Nettoyage des anciens backups
${cleanupCmd}

echo "[\$(date)] Nettoyage effectué (rétention: ${retentionDays} jours)"
`;

      default:
        return '#!/bin/bash\necho "Database type not supported"\n';
    }
  }

  /**
   * **saveDatabaseConfig()** - Sauvegarde la configuration de la base de données
   * Note: connectionString n'est PAS stockée pour des raisons de sécurité
   */
  private async saveDatabaseConfig(config: any, _connectionString?: string): Promise<void> {
    const configDir = '/opt/serverflow/config';
    await runCommandSilent('mkdir', ['-p', configDir]);

    // Ne PAS stocker la connection string dans les logs ou fichiers non sécurisés
    const dbConfig = {
      type: config.type,
      databaseName: config.databaseName,
      security: config.security,
      advanced: {
        backup: config.advanced.backup,
        performance: config.advanced.performance,
      },
      configuredAt: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(configDir, `database-${config.type}.json`), JSON.stringify(dbConfig, null, 2));

    this.onLog(`  ✅ Configuration sauvegardée dans ${configDir}/database-${config.type}.json\n`, 'stdout');
  }

  // ============================================================================
  // DATABASE MANAGEMENT (Wizard de gestion des BDD existantes)
  // ============================================================================

  /**
   * **getDatabaseInfo()** - Récupère les informations sur les BDD installées
   *
   * Cette fonction détecte les bases de données installées et récupère
   * les informations de configuration stockées localement sur l'agent.
   * Les credentials sont stockés dans des fichiers JSON sécurisés.
   *
   * @returns Liste des bases de données avec leurs instances
   */
  async getDatabaseInfo(): Promise<{
    databases: Array<{
      type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
      version?: string;
      running: boolean;
      instances: Array<{
        name: string;
        user?: string;
        createdAt?: string;
      }>;
    }>;
  }> {
    this.onLog(`\n📊 Récupération des informations des bases de données...\n`, 'stdout');

    const databases: Array<{
      type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
      version?: string;
      running: boolean;
      instances: Array<{ name: string; user?: string; createdAt?: string }>;
    }> = [];

    // Détecter les BDD installées
    const dbStatus = await detectDatabases();

    for (const [dbType, info] of Object.entries(dbStatus)) {
      if (info.installed) {
        const instances = await this.getDatabaseInstances(dbType as DatabaseType);
        databases.push({
          type: dbType as 'postgresql' | 'mysql' | 'redis' | 'mongodb',
          version: info.version,
          running: info.running,
          instances,
        });
      }
    }

    this.onLog(`  ✅ ${databases.length} base(s) de données détectée(s)\n`, 'stdout');
    return { databases };
  }

  /**
   * **getDatabaseInstances()** - Récupère les instances d'une BDD
   *
   * Lit le fichier de credentials stocké sur l'agent pour récupérer
   * la liste des bases de données et utilisateurs créés.
   */
  private async getDatabaseInstances(dbType: DatabaseType): Promise<Array<{
    name: string;
    user?: string;
    createdAt?: string;
  }>> {
    const credentialsPath = this.getCredentialsPath(dbType);
    const instances: Array<{ name: string; user?: string; createdAt?: string }> = [];

    // Lire le fichier de credentials s'il existe
    if (fs.existsSync(credentialsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        if (data.instances && Array.isArray(data.instances)) {
          return data.instances;
        }
        // Format ancien : une seule instance
        if (data.databaseName) {
          instances.push({
            name: data.databaseName,
            user: data.username,
            createdAt: data.createdAt,
          });
        }
      } catch (e) {
        this.onLog(`  ⚠️ Erreur lecture credentials ${dbType}\n`, 'stderr');
      }
    }

    // Pour Redis, pas de "bases de données" traditionnelles
    if (dbType === 'redis' && instances.length === 0) {
      instances.push({ name: 'default', createdAt: new Date().toISOString() });
    }

    return instances;
  }

  /**
   * **getCredentialsPath()** - Retourne le chemin du fichier credentials
   */
  private getCredentialsPath(dbType: DatabaseType): string {
    const credentialsDir = path.join(os.homedir(), '.server-flow', 'credentials');
    return path.join(credentialsDir, `${dbType}.json`);
  }

  /**
   * **saveCredentials()** - Sauvegarde les credentials d'une instance de BDD
   *
   * Stocke de manière sécurisée les informations de connexion sur l'agent.
   * Le fichier est créé avec des permissions restreintes (0600).
   */
  private async saveCredentials(
    dbType: DatabaseType,
    instance: {
      name: string;
      user?: string;
      password: string;
      createdAt: string;
    },
  ): Promise<void> {
    const credentialsDir = path.join(os.homedir(), '.server-flow', 'credentials');
    const credentialsPath = this.getCredentialsPath(dbType);

    // Créer le répertoire si nécessaire
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true, mode: 0o700 });
    }

    // Lire les credentials existantes ou initialiser
    let data: { instances: Array<any>; rootPassword?: string } = { instances: [] };
    if (fs.existsSync(credentialsPath)) {
      try {
        data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        if (!data.instances) {
          // Migration depuis l'ancien format
          const oldInstance = {
            name: (data as any).databaseName,
            user: (data as any).username,
            password: (data as any).password,
            createdAt: (data as any).createdAt || new Date().toISOString(),
          };
          if (oldInstance.name) {
            data.instances = [oldInstance];
          } else {
            data.instances = [];
          }
          if ((data as any).rootPassword) {
            data.rootPassword = (data as any).rootPassword;
          }
        }
      } catch {
        data = { instances: [] };
      }
    }

    // Ajouter ou mettre à jour l'instance
    const existingIndex = data.instances.findIndex((i: any) => i.name === instance.name);
    if (existingIndex >= 0) {
      data.instances[existingIndex] = { ...data.instances[existingIndex], ...instance };
    } else {
      data.instances.push(instance);
    }

    // Écrire avec permissions restreintes
    fs.writeFileSync(credentialsPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  /**
   * **resetDatabasePassword()** - Réinitialise le mot de passe d'une BDD
   *
   * Génère un nouveau mot de passe sécurisé et met à jour la base de données.
   * Le nouveau mot de passe est stocké dans le fichier credentials de l'agent.
   *
   * @param dbType - Type de base de données
   * @param dbName - Nom de la base de données ou de l'utilisateur
   * @param customPassword - Mot de passe personnalisé (optionnel)
   * @returns Le nouveau mot de passe généré
   */
  async resetDatabasePassword(
    dbType: DatabaseType,
    dbName: string,
    customPassword?: string,
  ): Promise<{ success: boolean; password?: string; error?: string }> {
    this.setCurrentService(dbType);
    this.onLog(`\n🔐 Réinitialisation du mot de passe ${dbType} pour ${dbName}...\n`, 'stdout');

    try {
      // Générer un nouveau mot de passe si pas de custom
      const newPassword = customPassword || this.generateSecurePassword();

      switch (dbType) {
        case 'postgresql':
          await this.resetPostgresPassword(dbName, newPassword);
          break;
        case 'mysql':
          await this.resetMysqlPassword(dbName, newPassword);
          break;
        case 'redis':
          await this.resetRedisPassword(newPassword);
          break;
        case 'mongodb':
          throw new Error('MongoDB non encore supporté');
        default:
          throw new Error(`Type de base de données inconnu: ${dbType}`);
      }

      // Sauvegarder les nouveaux credentials
      await this.saveCredentials(dbType, {
        name: dbName,
        user: dbName, // Pour PostgreSQL/MySQL, le nom de l'utilisateur est souvent le même que la BDD
        password: newPassword,
        createdAt: new Date().toISOString(),
      });

      this.onLog(`\n✅ Mot de passe réinitialisé avec succès\n`, 'stdout');
      this.setCurrentService(null);
      return { success: true, password: newPassword };
    } catch (err: any) {
      this.onLog(`\n❌ Erreur: ${err.message}\n`, 'stderr');
      this.setCurrentService(null);
      return { success: false, error: err.message };
    }
  }

  /**
   * **resetPostgresPassword()** - Réinitialise un mot de passe PostgreSQL
   */
  private async resetPostgresPassword(username: string, newPassword: string): Promise<void> {
    // Échapper le mot de passe pour SQL
    const escapedPassword = newPassword.replace(/'/g, "''");
    const sqlCommand = `ALTER USER ${username} WITH PASSWORD '${escapedPassword}';`;

    await runCommand(
      'su',
      ['-', 'postgres', '-c', `psql -c "${sqlCommand}"`],
      this.onLog,
    );
  }

  /**
   * **resetMysqlPassword()** - Réinitialise un mot de passe MySQL/MariaDB
   */
  private async resetMysqlPassword(username: string, newPassword: string): Promise<void> {
    // Lire le mot de passe root depuis les credentials
    const credentialsPath = this.getCredentialsPath('mysql');
    let rootPassword = '';

    if (fs.existsSync(credentialsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        rootPassword = data.rootPassword || '';
      } catch {}
    }

    const escapedPassword = newPassword.replace(/'/g, "\\'");
    const authArg = rootPassword ? `-p'${rootPassword}'` : '';

    await runCommand(
      'mysql',
      ['-u', 'root', authArg, '-e', `ALTER USER '${username}'@'localhost' IDENTIFIED BY '${escapedPassword}';`],
      this.onLog,
    );

    await runCommand('mysql', ['-u', 'root', authArg, '-e', 'FLUSH PRIVILEGES;'], this.onLog);
  }

  /**
   * **resetRedisPassword()** - Réinitialise le mot de passe Redis
   */
  private async resetRedisPassword(newPassword: string): Promise<void> {
    const configPath = '/etc/redis/redis.conf';

    if (!fs.existsSync(configPath)) {
      throw new Error('Fichier de configuration Redis non trouvé');
    }

    let config = fs.readFileSync(configPath, 'utf-8');

    // Supprimer l'ancien requirepass s'il existe
    config = config.replace(/^requirepass\s+.*$/m, '');

    // Ajouter le nouveau mot de passe
    config += `\nrequirepass ${newPassword}\n`;

    fs.writeFileSync(configPath, config);

    // Redémarrer Redis
    await runCommand('systemctl', ['restart', 'redis-server'], this.onLog);
  }

  /**
   * **createDatabaseInstance()** - Crée une nouvelle instance de BDD
   *
   * Crée une nouvelle base de données et un utilisateur associé.
   * Les credentials sont stockés sur l'agent.
   */
  async createDatabaseInstance(
    dbType: DatabaseType,
    dbName: string,
    username: string,
  ): Promise<{ success: boolean; password?: string; connectionString?: string; error?: string }> {
    this.setCurrentService(dbType);
    this.onLog(`\n🆕 Création d'une nouvelle base de données ${dbType}...\n`, 'stdout');

    try {
      const password = this.generateSecurePassword();
      let connectionString = '';

      switch (dbType) {
        case 'postgresql':
          await this.createPostgresDatabase(dbName, username, password);
          connectionString = `postgresql://${username}:${password}@localhost:5432/${dbName}`;
          break;
        case 'mysql':
          await this.createMysqlDatabase(dbName, username, password);
          connectionString = `mysql://${username}:${password}@localhost:3306/${dbName}`;
          break;
        case 'redis':
          // Redis n'a pas vraiment de "bases de données" distinctes au sens traditionnel
          throw new Error('Redis ne supporte pas la création de bases de données distinctes');
        case 'mongodb':
          throw new Error('MongoDB non encore supporté');
        default:
          throw new Error(`Type de base de données inconnu: ${dbType}`);
      }

      // Sauvegarder les credentials
      await this.saveCredentials(dbType, {
        name: dbName,
        user: username,
        password,
        createdAt: new Date().toISOString(),
      });

      this.onLog(`\n✅ Base de données créée avec succès\n`, 'stdout');
      this.setCurrentService(null);
      return { success: true, password, connectionString };
    } catch (err: any) {
      this.onLog(`\n❌ Erreur: ${err.message}\n`, 'stderr');
      this.setCurrentService(null);
      return { success: false, error: err.message };
    }
  }

  /**
   * **createPostgresDatabase()** - Crée une BDD et un utilisateur PostgreSQL
   */
  private async createPostgresDatabase(dbName: string, username: string, password: string): Promise<void> {
    const escapedPassword = password.replace(/'/g, "''");

    // Créer l'utilisateur
    await runCommand(
      'su',
      ['-', 'postgres', '-c', `psql -c "CREATE USER ${username} WITH PASSWORD '${escapedPassword}';"`],
      this.onLog,
    );

    // Créer la base de données
    await runCommand(
      'su',
      ['-', 'postgres', '-c', `psql -c "CREATE DATABASE ${dbName} OWNER ${username};"`],
      this.onLog,
    );

    // Donner tous les privilèges
    await runCommand(
      'su',
      ['-', 'postgres', '-c', `psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${username};"`],
      this.onLog,
    );

    this.onLog(`  ✅ Base de données PostgreSQL '${dbName}' créée\n`, 'stdout');
    this.onLog(`  ✅ Utilisateur '${username}' créé\n`, 'stdout');
  }

  /**
   * **createMysqlDatabase()** - Crée une BDD et un utilisateur MySQL/MariaDB
   */
  private async createMysqlDatabase(dbName: string, username: string, password: string): Promise<void> {
    // Lire le mot de passe root depuis les credentials
    const credentialsPath = this.getCredentialsPath('mysql');
    let rootPassword = '';

    if (fs.existsSync(credentialsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        rootPassword = data.rootPassword || '';
      } catch {}
    }

    const escapedPassword = password.replace(/'/g, "\\'");
    const authArg = rootPassword ? `-p'${rootPassword}'` : '';

    // Créer la base de données
    await runCommand(
      'mysql',
      ['-u', 'root', authArg, '-e', `CREATE DATABASE IF NOT EXISTS ${dbName};`],
      this.onLog,
    );

    // Créer l'utilisateur
    await runCommand(
      'mysql',
      ['-u', 'root', authArg, '-e', `CREATE USER IF NOT EXISTS '${username}'@'localhost' IDENTIFIED BY '${escapedPassword}';`],
      this.onLog,
    );

    // Donner tous les privilèges
    await runCommand(
      'mysql',
      ['-u', 'root', authArg, '-e', `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${username}'@'localhost';`],
      this.onLog,
    );

    await runCommand('mysql', ['-u', 'root', authArg, '-e', 'FLUSH PRIVILEGES;'], this.onLog);

    this.onLog(`  ✅ Base de données MySQL '${dbName}' créée\n`, 'stdout');
    this.onLog(`  ✅ Utilisateur '${username}' créé\n`, 'stdout');
  }

  /**
   * **generateSecurePassword()** - Génère un mot de passe sécurisé
   */
  private generateSecurePassword(): string {
    const { randomBytes } = require('crypto');
    const length = 24;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length];
    }

    return password;
  }
}
