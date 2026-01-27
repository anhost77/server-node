/**
 * @file apps/agent/src/infrastructure/types.ts
 * @description Types et interfaces pour le gestionnaire d'infrastructure.
 * Ce fichier définit tous les types utilisés pour décrire les runtimes,
 * bases de données, services et l'état du système.
 *
 * @fonctions_principales
 * - RuntimeType : Types de runtimes supportés (nodejs, python, go, etc.)
 * - DatabaseType : Types de bases de données (postgresql, mysql, redis)
 * - ServiceType : Types de services (nginx, haproxy, fail2ban, etc.)
 * - ServerStatus : État complet du serveur
 */

// ============================================
// TYPES DE BASE
// ============================================

export type RuntimeType = 'nodejs' | 'python' | 'php' | 'go' | 'docker' | 'rust' | 'ruby';
export type DatabaseType = 'postgresql' | 'mysql' | 'redis' | 'mongodb';
export type ServiceType =
    | 'nginx' | 'haproxy' | 'keepalived' | 'certbot'
    | 'fail2ban' | 'ufw' | 'wireguard'
    | 'pm2' | 'netdata' | 'loki'
    | 'bind9'
    | 'postfix' | 'dovecot' | 'rspamd' | 'opendkim' | 'clamav' | 'spf-policyd'
    | 'rsync' | 'rclone' | 'restic'
    | 'ssh' | 'cron'
    | 'vsftpd' | 'proftpd'
    | 'nfs';

// ============================================
// PROTECTED RESOURCES
// ============================================

/**
 * Runtimes protégés qui ne peuvent pas être supprimés
 * (nécessaires au fonctionnement de l'agent)
 */
export const PROTECTED_RUNTIMES: RuntimeType[] = ['nodejs', 'python'];

/**
 * Services protégés qui ne peuvent pas être supprimés
 * (services système essentiels)
 */
export const PROTECTED_SERVICES: ServiceType[] = ['ssh', 'cron'];

// ============================================
// INFORMATIONS RUNTIME
// ============================================

export interface RuntimeInfo {
    type: RuntimeType;
    installed: boolean;
    version?: string;
    latestVersion?: string;
    updateAvailable?: boolean;
    estimatedSize: string;
}

// ============================================
// INFORMATIONS DATABASE
// ============================================

export interface DatabaseInfo {
    type: DatabaseType;
    installed: boolean;
    running: boolean;
    version?: string;
}

export interface DatabaseCredentials {
    rootPassword: string;
    createdAt: string;
}

/**
 * Options de sécurité pour la configuration des bases de données
 */
export interface DbSecurityOptions {
    // MySQL/MariaDB specific
    setRootPassword?: boolean;
    removeAnonymousUsers?: boolean;
    disableRemoteRoot?: boolean;
    removeTestDb?: boolean;
    // PostgreSQL specific
    configureHba?: boolean;
    // Redis specific
    enableProtectedMode?: boolean;
    // Common to all
    bindLocalhost?: boolean;
}

// ============================================
// INFORMATIONS SERVICE
// ============================================

export interface ServiceInfo {
    type: ServiceType;
    installed: boolean;
    running: boolean;
    version?: string;
    protected?: boolean; // Services système qui ne peuvent pas être supprimés
}

// ============================================
// INFORMATIONS SYSTÈME
// ============================================

export interface SystemInfo {
    os: string;
    osVersion: string;
    cpu: number;
    ram: string;
    disk: string;
    uptime: string;
}

// ============================================
// STATUS GLOBAL DU SERVEUR
// ============================================

export interface ServerStatus {
    runtimes: RuntimeInfo[];
    databases: DatabaseInfo[];
    services: ServiceInfo[];
    system: SystemInfo;
}

// ============================================
// TYPES UTILITAIRES
// ============================================

/**
 * Fonction de log pour suivre les opérations d'installation
 */
export type LogFn = (message: string, stream: 'stdout' | 'stderr') => void;

/**
 * Résultat d'une opération d'installation
 */
export interface InstallResult {
    success: boolean;
    version?: string;
    error?: string;
}

/**
 * Résultat d'une opération de configuration de base de données
 */
export interface DatabaseConfigResult {
    success: boolean;
    connectionString?: string;
    error?: string;
}

/**
 * Résultat d'une mise à jour
 */
export interface UpdateResult {
    success: boolean;
    oldVersion?: string;
    newVersion?: string;
    error?: string;
}

/**
 * Résultat d'une opération simple (start, stop, remove)
 */
export interface OperationResult {
    success: boolean;
    error?: string;
}
