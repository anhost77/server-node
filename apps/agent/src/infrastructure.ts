/**
 * Infrastructure Manager for Server Configuration
 * Story 7.7 - Dashboard-Driven Server Configuration
 *
 * Handles:
 * - Auto-detection of installed runtimes and databases
 * - Installation of runtimes (Python, Go, Docker, Rust, Ruby)
 * - Configuration of databases (PostgreSQL, MySQL, Redis)
 * - System information gathering
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// Check if running as root
const IS_ROOT = process.getuid?.() === 0;

/**
 * Run a command as another user (e.g., postgres)
 * - If root: use `su - user -c "command"`
 * - If not root: use `sudo -u user command`
 */
function runAsUser(user: string, command: string): { cmd: string; args: string[] } {
    if (IS_ROOT) {
        // Use su when running as root (no sudo needed)
        return { cmd: 'su', args: ['-', user, '-c', command] };
    } else {
        // Use sudo when running as non-root user
        return { cmd: 'sudo', args: ['-u', user, ...command.split(' ')] };
    }
}

/**
 * Get prefix for privileged commands
 * - If root: no prefix needed
 * - If not root: use sudo
 */
function getPrivilegedPrefix(): string[] {
    return IS_ROOT ? [] : ['sudo'];
}

// Types
export type RuntimeType = 'nodejs' | 'python' | 'go' | 'docker' | 'rust' | 'ruby';
export type DatabaseType = 'postgresql' | 'mysql' | 'redis';

// Protected runtimes that cannot be removed (required by the agent)
const PROTECTED_RUNTIMES: RuntimeType[] = ['nodejs', 'python'];
// Note: Python is protected because it may be used by monitoring scripts and system tools

// Log file path
const LOG_DIR = path.join(os.homedir(), '.server-flow', 'logs');
const INFRASTRUCTURE_LOG_FILE = path.join(LOG_DIR, 'infrastructure.log');

// Credentials storage (secured with chmod 600)
const CREDENTIALS_DIR = path.join(os.homedir(), '.server-flow', 'credentials');

interface DatabaseCredentials {
    rootPassword: string;
    createdAt: string;
}

/**
 * Store database root credentials securely
 */
function storeDbCredentials(dbType: DatabaseType, credentials: DatabaseCredentials): void {
    if (!fs.existsSync(CREDENTIALS_DIR)) {
        fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
    }
    const filePath = path.join(CREDENTIALS_DIR, `${dbType}.json`);
    fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

/**
 * Retrieve stored database root credentials
 */
function getDbCredentials(dbType: DatabaseType): DatabaseCredentials | null {
    const filePath = path.join(CREDENTIALS_DIR, `${dbType}.json`);
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            return null;
        }
    }
    return null;
}

export interface RuntimeInfo {
    type: RuntimeType;
    installed: boolean;
    version?: string;
    latestVersion?: string;
    updateAvailable?: boolean;
    estimatedSize: string;
}

export interface DatabaseInfo {
    type: DatabaseType;
    installed: boolean;
    running: boolean;
    version?: string;
}

export interface SystemInfo {
    os: string;
    osVersion: string;
    cpu: number;
    ram: string;
    disk: string;
    uptime: string;
}

export interface ServerStatus {
    runtimes: RuntimeInfo[];
    databases: DatabaseInfo[];
    system: SystemInfo;
}

type LogFn = (message: string, stream: 'stdout' | 'stderr') => void;

/**
 * Security options for database configuration
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

export class InfrastructureManager {
    private onLog: LogFn;
    private currentService: string | null = null;

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
     * Read logs for a specific service (runtime or database)
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

        // Return last N lines
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
    // PUBLIC API
    // ============================================

    /**
     * Get complete server status including runtimes, databases, and system info
     */
    async getServerStatus(): Promise<ServerStatus> {
        return {
            runtimes: await this.detectRuntimes(),
            databases: await this.detectDatabases(),
            system: await this.getSystemInfo()
        };
    }

    /**
     * Install a runtime
     */
    async installRuntime(type: RuntimeType): Promise<{ success: boolean; version?: string; error?: string }> {
        // Set current service for logging
        this.setCurrentService(type);
        this.onLog(`\n📦 Installing ${type}...\n`, 'stdout');

        try {
            let version: string;
            switch (type) {
                case 'python':
                    version = await this.installPython();
                    break;
                case 'go':
                    version = await this.installGo();
                    break;
                case 'docker':
                    version = await this.installDocker();
                    break;
                case 'rust':
                    version = await this.installRust();
                    break;
                case 'ruby':
                    version = await this.installRuby();
                    break;
                default:
                    throw new Error(`Unknown runtime: ${type}`);
            }
            this.onLog(`\n✅ ${type} ${version} installed successfully\n`, 'stdout');
            this.setCurrentService(null);
            return { success: true, version };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to install ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * Configure a database (returns connection string, password NOT stored)
     */
    async configureDatabase(type: DatabaseType, dbName: string, securityOptions?: DbSecurityOptions): Promise<{
        success: boolean;
        connectionString?: string;
        error?: string;
    }> {
        // Set current service for logging
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
            let connectionString: string;
            switch (type) {
                case 'postgresql':
                    connectionString = await this.configurePostgresql(dbName, opts);
                    break;
                case 'mysql':
                    connectionString = await this.configureMysql(dbName, opts);
                    break;
                case 'redis':
                    connectionString = await this.configureRedis(opts);
                    break;
                default:
                    throw new Error(`Unknown database: ${type}`);
            }
            this.onLog(`\n✅ ${type} configured successfully\n`, 'stdout');
            // SECURITY: Connection string is returned via WebSocket result only
            // NEVER log credentials to files!
            this.setCurrentService(null);
            return { success: true, connectionString };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to configure ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * Update a runtime to the latest version
     */
    async updateRuntime(type: RuntimeType): Promise<{
        success: boolean;
        oldVersion?: string;
        newVersion?: string;
        error?: string;
    }> {
        // Set current service for logging
        this.setCurrentService(type);
        this.onLog(`\n🔄 Updating ${type}...\n`, 'stdout');

        try {
            // Get current version
            const checks: Record<RuntimeType, { cmd: string; args: string[] }> = {
                nodejs: { cmd: 'node', args: ['--version'] },
                python: { cmd: 'python3', args: ['--version'] },
                go: { cmd: 'go', args: ['version'] },
                docker: { cmd: 'docker', args: ['--version'] },
                rust: { cmd: 'rustc', args: ['--version'] },
                ruby: { cmd: 'ruby', args: ['--version'] }
            };
            const check = checks[type];
            const oldVersion = await this.getCommandVersion(check.cmd, check.args) || 'unknown';

            let newVersion: string;
            switch (type) {
                case 'nodejs':
                    newVersion = await this.updateNodejs();
                    break;
                case 'python':
                    newVersion = await this.updatePython();
                    break;
                case 'go':
                    newVersion = await this.updateGo();
                    break;
                case 'docker':
                    newVersion = await this.updateDocker();
                    break;
                case 'rust':
                    newVersion = await this.updateRust();
                    break;
                case 'ruby':
                    newVersion = await this.updateRuby();
                    break;
                default:
                    throw new Error(`Unknown runtime: ${type}`);
            }

            this.onLog(`\n✅ ${type} updated: ${oldVersion} → ${newVersion}\n`, 'stdout');
            this.setCurrentService(null);
            return { success: true, oldVersion, newVersion };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to update ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    // ============================================
    // RUNTIME/DATABASE REMOVAL
    // ============================================

    /**
     * Uninstall a runtime
     * @param type - Runtime to remove
     * @param purge - If true, also remove configuration files
     */
    async uninstallRuntime(type: RuntimeType, purge: boolean): Promise<{ success: boolean; error?: string }> {
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
            const removeCmd = purge ? 'purge' : 'remove';

            switch (type) {
                case 'python':
                    await this.runCommand('apt-get', [removeCmd, '-y', 'python3', 'python3-pip', 'python3-venv']);
                    break;

                case 'go':
                    // Go is installed manually, remove from /usr/local
                    if (fs.existsSync('/usr/local/go')) {
                        await this.runCommand('rm', ['-rf', '/usr/local/go']);
                    }
                    if (fs.existsSync('/etc/profile.d/go.sh')) {
                        await this.runCommandSilent('rm', ['/etc/profile.d/go.sh']);
                    }
                    this.onLog(`Removed Go from /usr/local/go\n`, 'stdout');
                    break;

                case 'docker':
                    // Stop all containers first
                    try {
                        const containers = await this.runCommandSilent('docker', ['ps', '-aq']);
                        if (containers.trim()) {
                            this.onLog(`Stopping all containers...\n`, 'stdout');
                            await this.runCommand('docker', ['stop', ...containers.trim().split('\n')]);
                        }
                    } catch {
                        // Ignore if no containers
                    }
                    await this.runCommand('systemctl', ['stop', 'docker']);
                    await this.runCommand('apt-get', [removeCmd, '-y', 'docker.io', 'docker-compose']);
                    break;

                case 'rust':
                    // Rust uses rustup, remove via rustup or manually
                    const rustupPath = `${os.homedir()}/.cargo/bin/rustup`;
                    if (fs.existsSync(rustupPath)) {
                        await this.runCommand(rustupPath, ['self', 'uninstall', '-y']);
                    } else {
                        // Manual removal
                        const cargoDir = `${os.homedir()}/.cargo`;
                        const rustupDir = `${os.homedir()}/.rustup`;
                        if (fs.existsSync(cargoDir)) {
                            await this.runCommand('rm', ['-rf', cargoDir]);
                        }
                        if (fs.existsSync(rustupDir)) {
                            await this.runCommand('rm', ['-rf', rustupDir]);
                        }
                    }
                    break;

                case 'ruby':
                    await this.runCommand('apt-get', [removeCmd, '-y', 'ruby', 'ruby-dev', 'ruby-bundler']);
                    break;

                default:
                    throw new Error(`Unknown runtime: ${type}`);
            }

            // Clean up unused packages
            await this.runCommand('apt-get', ['autoremove', '-y']);

            this.onLog(`\n✅ ${type} removed successfully\n`, 'stdout');
            this.setCurrentService(null);
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to remove ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * Remove a database
     * @param type - Database to remove
     * @param purge - If true, also remove configuration files
     * @param removeData - If true, delete data directory (IRREVERSIBLE!)
     */
    async removeDatabase(type: DatabaseType, purge: boolean, removeData: boolean): Promise<{ success: boolean; error?: string }> {
        this.setCurrentService(type);
        this.onLog(`\n🗑️ Removing ${type}${purge ? ' (with purge)' : ''}${removeData ? ' [INCLUDING DATA]' : ''}...\n`, 'stdout');

        if (removeData) {
            this.onLog(`⚠️ WARNING: Data directory will be PERMANENTLY deleted!\n`, 'stderr');
        }

        try {
            const removeCmd = purge ? 'purge' : 'remove';

            switch (type) {
                case 'postgresql':
                    await this.runCommand('systemctl', ['stop', 'postgresql']);
                    // Remove ALL postgresql packages (metapackages + versioned packages + clients + common)
                    await this.runCommand('apt-get', [removeCmd, '-y',
                        'postgresql', 'postgresql-contrib', 'postgresql-common',
                        'postgresql-client-common', 'postgresql-*']);
                    if (removeData && fs.existsSync('/var/lib/postgresql')) {
                        this.onLog(`Deleting /var/lib/postgresql...\n`, 'stderr');
                        await this.runCommand('rm', ['-rf', '/var/lib/postgresql']);
                    }
                    break;

                case 'mysql':
                    await this.runCommand('systemctl', ['stop', 'mariadb']);
                    // Remove ALL mysql/mariadb packages
                    await this.runCommand('apt-get', [removeCmd, '-y',
                        'default-mysql-server', 'default-mysql-client',
                        'mariadb-server', 'mariadb-client', 'mariadb-common',
                        'mysql-common', 'mysql-*', 'mariadb-*']);
                    if (removeData && fs.existsSync('/var/lib/mysql')) {
                        this.onLog(`Deleting /var/lib/mysql...\n`, 'stderr');
                        await this.runCommand('rm', ['-rf', '/var/lib/mysql']);
                    }
                    break;

                case 'redis':
                    await this.runCommand('systemctl', ['stop', 'redis-server']);
                    await this.runCommand('apt-get', [removeCmd, '-y', 'redis-server']);
                    if (removeData && fs.existsSync('/var/lib/redis')) {
                        this.onLog(`Deleting /var/lib/redis...\n`, 'stderr');
                        await this.runCommand('rm', ['-rf', '/var/lib/redis']);
                    }
                    break;

                default:
                    throw new Error(`Unknown database: ${type}`);
            }

            // Clean up unused packages
            await this.runCommand('apt-get', ['autoremove', '-y']);

            this.onLog(`\n✅ ${type} removed successfully\n`, 'stdout');
            this.setCurrentService(null);
            return { success: true };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to remove ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    /**
     * Reconfigure a database (new password or new database)
     * @param type - Database type
     * @param dbName - Database/user name
     * @param resetPassword - If true, only reset password; if false, create new database
     */
    async reconfigureDatabase(type: DatabaseType, dbName: string, resetPassword: boolean): Promise<{
        success: boolean;
        connectionString?: string;
        error?: string;
    }> {
        this.setCurrentService(type);
        const action = resetPassword ? 'Resetting password' : 'Creating new database';
        this.onLog(`\n🔄 ${action} for ${type}: ${dbName}...\n`, 'stdout');

        try {
            // Generate new secure password
            const password = crypto.randomBytes(24).toString('base64url');
            const user = `${dbName}_user`;
            let connectionString: string;

            switch (type) {
                case 'postgresql':
                    if (resetPassword) {
                        // Reset password for existing user
                        this.onLog(`Resetting password for user ${user}...\n`, 'stdout');
                        const alterUser = runAsUser('postgres', `psql -c "ALTER USER ${user} WITH PASSWORD '${password}';"`);
                        await this.runCommand(alterUser.cmd, alterUser.args);
                    } else {
                        // Create new database and user
                        this.onLog(`Creating user ${user}...\n`, 'stdout');
                        const createUser = runAsUser('postgres', `psql -c "CREATE USER ${user} WITH PASSWORD '${password}';"`);
                        await this.runCommand(createUser.cmd, createUser.args);

                        this.onLog(`Creating database ${dbName}...\n`, 'stdout');
                        const createDb = runAsUser('postgres', `psql -c "CREATE DATABASE ${dbName} OWNER ${user};"`);
                        await this.runCommand(createDb.cmd, createDb.args);

                        this.onLog(`Granting privileges...\n`, 'stdout');
                        const grantPrivs = runAsUser('postgres', `psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${user};"`);
                        await this.runCommand(grantPrivs.cmd, grantPrivs.args);
                    }
                    connectionString = `postgresql://${user}:${password}@localhost:5432/${dbName}`;
                    break;

                case 'mysql':
                    if (resetPassword) {
                        // Reset password for existing user - use runCommand to see output
                        this.onLog(`Resetting password for user ${user}...\n`, 'stdout');
                        await this.runCommand('mysql', ['-e',
                            `ALTER USER '${user}'@'localhost' IDENTIFIED BY '${password}'; FLUSH PRIVILEGES;`
                        ]);
                    } else {
                        // Create new database and user - use runCommand to see output
                        this.onLog(`Creating database ${dbName}...\n`, 'stdout');
                        await this.runCommand('mysql', ['-e',
                            `CREATE DATABASE IF NOT EXISTS ${dbName};`
                        ]);
                        this.onLog(`Creating user ${user}...\n`, 'stdout');
                        await this.runCommand('mysql', ['-e',
                            `CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}';`
                        ]);
                        this.onLog(`Granting privileges...\n`, 'stdout');
                        await this.runCommand('mysql', ['-e',
                            `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${user}'@'localhost'; FLUSH PRIVILEGES;`
                        ]);
                    }
                    connectionString = `mysql://${user}:${password}@localhost:3306/${dbName}`;
                    break;

                case 'redis':
                    // Redis only has password reset (no multiple databases)
                    const configPath = '/etc/redis/redis.conf';
                    if (fs.existsSync(configPath)) {
                        let config = fs.readFileSync(configPath, 'utf-8');
                        // Remove existing requirepass
                        config = config.replace(/^requirepass .+$/m, '');
                        // Add new password
                        config += `\nrequirepass ${password}\n`;
                        fs.writeFileSync(configPath, config);
                    }
                    await this.runCommand('systemctl', ['restart', 'redis-server']);
                    connectionString = `redis://:${password}@localhost:6379`;
                    break;

                default:
                    throw new Error(`Unknown database: ${type}`);
            }

            this.onLog(`\n✅ ${type} reconfigured successfully\n`, 'stdout');
            // SECURITY: Connection string is returned via WebSocket result only
            // NEVER log credentials to files!
            this.setCurrentService(null);
            return { success: true, connectionString };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to reconfigure ${type}: ${err.message}\n`, 'stderr');
            this.setCurrentService(null);
            return { success: false, error: err.message };
        }
    }

    // ============================================
    // AUTO-DETECTION
    // ============================================

    private async detectRuntimes(): Promise<RuntimeInfo[]> {
        const runtimes: RuntimeInfo[] = [
            { type: 'nodejs', installed: false, estimatedSize: 'Installed' },
            { type: 'python', installed: false, estimatedSize: '~200MB' },
            { type: 'go', installed: false, estimatedSize: '~500MB' },
            { type: 'docker', installed: false, estimatedSize: '~500MB' },
            { type: 'rust', installed: false, estimatedSize: '~1GB' },
            { type: 'ruby', installed: false, estimatedSize: '~300MB' }
        ];

        // Check each runtime
        const checks: Record<RuntimeType, { cmd: string; args: string[] }> = {
            nodejs: { cmd: 'node', args: ['--version'] },
            python: { cmd: 'python3', args: ['--version'] },
            go: { cmd: 'go', args: ['version'] },
            docker: { cmd: 'docker', args: ['--version'] },
            rust: { cmd: 'rustc', args: ['--version'] },
            ruby: { cmd: 'ruby', args: ['--version'] }
        };

        for (const runtime of runtimes) {
            const check = checks[runtime.type];
            const version = await this.getCommandVersion(check.cmd, check.args);
            if (version) {
                runtime.installed = true;
                runtime.version = version;
                runtime.estimatedSize = 'Installed';

                // Check for updates
                const latestVersion = await this.getLatestVersion(runtime.type);
                if (latestVersion) {
                    runtime.latestVersion = latestVersion;
                    runtime.updateAvailable = this.compareVersions(version, latestVersion) < 0;
                }
            }
        }

        return runtimes;
    }

    /**
     * Get the latest available version for a runtime
     */
    private async getLatestVersion(type: RuntimeType): Promise<string | null> {
        try {
            switch (type) {
                case 'nodejs':
                    return await this.getLatestNodeVersion();
                case 'python':
                    return await this.getLatestAptVersion('python3');
                case 'go':
                    return await this.getLatestGoVersion();
                case 'docker':
                    return await this.getLatestAptVersion('docker.io');
                case 'rust':
                    return await this.getLatestRustVersion();
                case 'ruby':
                    return await this.getLatestAptVersion('ruby');
                default:
                    return null;
            }
        } catch {
            return null;
        }
    }

    /**
     * Get latest version from apt-cache policy
     */
    private async getLatestAptVersion(pkg: string): Promise<string | null> {
        try {
            const output = await this.runCommandSilent('apt-cache', ['policy', pkg]);
            // Parse "Candidate: X.X.X-Y" line
            const match = output.match(/Candidate:\s+(\d+\.\d+(\.\d+)?)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    /**
     * Get latest Node.js LTS version from nodejs.org
     */
    private async getLatestNodeVersion(): Promise<string | null> {
        try {
            const output = await this.runCommandSilent('curl', ['-s', 'https://nodejs.org/dist/index.json']);
            const versions = JSON.parse(output);
            // Find latest LTS version
            const lts = versions.find((v: { lts: string | boolean }) => v.lts !== false);
            if (lts && lts.version) {
                return lts.version.replace('v', '');
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Get latest Go version from go.dev
     */
    private async getLatestGoVersion(): Promise<string | null> {
        try {
            const output = await this.runCommandSilent('curl', ['-s', 'https://go.dev/VERSION?m=text']);
            // Response is like "go1.22.0"
            const match = output.match(/go(\d+\.\d+(\.\d+)?)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    /**
     * Get latest Rust version using rustup or from web
     */
    private async getLatestRustVersion(): Promise<string | null> {
        try {
            // Try rustup check first
            const cargoPath = `${os.homedir()}/.cargo/bin/rustup`;
            if (fs.existsSync(cargoPath)) {
                const output = await this.runCommandSilent(cargoPath, ['check']);
                // Parse "stable - Update available : X.X.X -> Y.Y.Y" or "stable - Up to date : X.X.X"
                const updateMatch = output.match(/stable.*?(\d+\.\d+\.\d+)\s*$/m);
                if (updateMatch) return updateMatch[1];
            }
            // Fallback: fetch from Rust website
            const output = await this.runCommandSilent('curl', ['-s', 'https://static.rust-lang.org/dist/channel-rust-stable.toml']);
            const match = output.match(/version\s*=\s*"(\d+\.\d+\.\d+)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    /**
     * Compare two version strings
     * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
     */
    private compareVersions(v1: string, v2: string): number {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        const len = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < len; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 < p2) return -1;
            if (p1 > p2) return 1;
        }
        return 0;
    }

    private async detectDatabases(): Promise<DatabaseInfo[]> {
        const databases: DatabaseInfo[] = [
            { type: 'postgresql', installed: false, running: false },
            { type: 'mysql', installed: false, running: false },
            { type: 'redis', installed: false, running: false }
        ];

        // Check PostgreSQL
        const pgVersion = await this.getCommandVersion('psql', ['--version']);
        if (pgVersion) {
            databases[0].installed = true;
            databases[0].version = pgVersion;
            databases[0].running = await this.isServiceRunning('postgresql');
        }

        // Check MySQL
        const mysqlVersion = await this.getCommandVersion('mysql', ['--version']);
        if (mysqlVersion) {
            databases[1].installed = true;
            databases[1].version = mysqlVersion;
            databases[1].running = await this.isServiceRunning('mysql');
        }

        // Check Redis
        const redisVersion = await this.getCommandVersion('redis-server', ['--version']);
        if (redisVersion) {
            databases[2].installed = true;
            databases[2].version = redisVersion;
            databases[2].running = await this.isServiceRunning('redis');
        }

        return databases;
    }

    private async getSystemInfo(): Promise<SystemInfo> {
        // Get OS info
        let osName = 'Linux';
        let osVersion = '';
        try {
            if (fs.existsSync('/etc/os-release')) {
                const content = fs.readFileSync('/etc/os-release', 'utf-8');
                const nameMatch = content.match(/^PRETTY_NAME="(.+)"/m);
                if (nameMatch) {
                    osName = nameMatch[1];
                }
                const versionMatch = content.match(/^VERSION_ID="(.+)"/m);
                if (versionMatch) {
                    osVersion = versionMatch[1];
                }
            }
        } catch { }

        // Get RAM
        const totalMem = os.totalmem();
        const ram = `${Math.round(totalMem / (1024 * 1024 * 1024))}GB`;

        // Get disk usage
        let disk = 'Unknown';
        try {
            const result = await this.runCommandSilent('df', ['-h', '/']);
            const lines = result.split('\n');
            if (lines.length >= 2) {
                const parts = lines[1].split(/\s+/);
                if (parts.length >= 5) {
                    disk = `${parts[2]} / ${parts[1]} (${parts[4]})`;
                }
            }
        } catch { }

        // Get uptime
        const uptimeSeconds = os.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = `${days}d ${hours}h ${minutes}m`;

        return {
            os: osName,
            osVersion,
            cpu: os.cpus().length,
            ram,
            disk,
            uptime
        };
    }

    // ============================================
    // RUNTIME INSTALLERS
    // ============================================

    private async installPython(): Promise<string> {
        await this.runCommand('apt-get', ['update']);
        await this.runCommand('apt-get', ['install', '-y',
            'python3', 'python3-pip', 'python3-venv',
            'python3-dev', 'build-essential'
        ]);
        // Install common WSGI servers globally
        await this.runCommand('pip3', ['install', '--break-system-packages', 'uvicorn', 'gunicorn']);
        return await this.getCommandVersion('python3', ['--version']) || 'Unknown';
    }

    private async installGo(): Promise<string> {
        const GO_VERSION = '1.22.0';
        const ARCH = os.arch() === 'x64' ? 'amd64' : 'arm64';

        this.onLog(`📥 Downloading Go ${GO_VERSION}...\n`, 'stdout');

        // Download Go tarball
        await this.runCommand('wget', [
            '-q', '--show-progress',
            `https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz`,
            '-O', '/tmp/go.tar.gz'
        ]);

        // Remove old Go installation if exists
        await this.runCommandSilent('rm', ['-rf', '/usr/local/go']);

        // Extract
        this.onLog(`📦 Extracting...\n`, 'stdout');
        await this.runCommand('tar', ['-C', '/usr/local', '-xzf', '/tmp/go.tar.gz']);

        // Add to PATH
        const profileContent = 'export PATH=$PATH:/usr/local/go/bin\n';
        fs.writeFileSync('/etc/profile.d/go.sh', profileContent);

        // Clean up
        await this.runCommandSilent('rm', ['/tmp/go.tar.gz']);

        return GO_VERSION;
    }

    private async installDocker(): Promise<string> {
        await this.runCommand('apt-get', ['update']);
        await this.runCommand('apt-get', ['install', '-y',
            'docker.io', 'docker-compose'
        ]);
        await this.runCommand('systemctl', ['enable', 'docker']);
        await this.runCommand('systemctl', ['start', 'docker']);

        // Add current user to docker group
        const user = os.userInfo().username;
        if (user !== 'root') {
            await this.runCommandSilent('usermod', ['-aG', 'docker', user]);
        }

        return await this.getCommandVersion('docker', ['--version']) || 'Unknown';
    }

    private async installRust(): Promise<string> {
        this.onLog(`📥 Downloading rustup...\n`, 'stdout');

        // Download rustup installer
        await this.runCommand('curl', [
            '--proto', '=https', '--tlsv1.2', '-sSf',
            'https://sh.rustup.rs', '-o', '/tmp/rustup.sh'
        ]);

        // Install Rust (non-interactive)
        await this.runCommand('sh', ['/tmp/rustup.sh', '-y', '--default-toolchain', 'stable']);

        // Add to PATH for current session
        const cargoPath = `${os.homedir()}/.cargo/bin`;
        process.env.PATH = `${cargoPath}:${process.env.PATH}`;

        // Clean up
        await this.runCommandSilent('rm', ['/tmp/rustup.sh']);

        return await this.getCommandVersion(`${cargoPath}/rustc`, ['--version']) || 'stable';
    }

    private async installRuby(): Promise<string> {
        await this.runCommand('apt-get', ['update']);
        // Include build-essential for compiling native gems like puma
        await this.runCommand('apt-get', ['install', '-y',
            'ruby', 'ruby-dev', 'ruby-bundler', 'build-essential'
        ]);
        // Install common Ruby gems
        await this.runCommand('gem', ['install', 'puma', 'bundler', '--no-document']);

        return await this.getCommandVersion('ruby', ['--version']) || 'Unknown';
    }

    // ============================================
    // RUNTIME UPDATERS
    // ============================================

    private async updateNodejs(): Promise<string> {
        this.onLog(`📥 Updating Node.js via nvm...\n`, 'stdout');

        // Check if nvm is installed
        const nvmDir = `${os.homedir()}/.nvm`;
        if (fs.existsSync(nvmDir)) {
            // Source nvm and install latest LTS
            await this.runCommand('bash', ['-c',
                `. ${nvmDir}/nvm.sh && nvm install --lts && nvm use --lts && nvm alias default lts/*`
            ]);
        } else {
            // Fallback to NodeSource repo update
            this.onLog(`Installing via NodeSource (nvm not found)...\n`, 'stdout');
            await this.runCommand('curl', ['-fsSL', 'https://deb.nodesource.com/setup_lts.x', '-o', '/tmp/nodesource_setup.sh']);
            await this.runCommand('bash', ['/tmp/nodesource_setup.sh']);
            await this.runCommand('apt-get', ['install', '-y', 'nodejs']);
            await this.runCommandSilent('rm', ['/tmp/nodesource_setup.sh']);
        }

        return await this.getCommandVersion('node', ['--version']) || 'Unknown';
    }

    private async updatePython(): Promise<string> {
        await this.runCommand('apt-get', ['update']);
        await this.runCommand('apt-get', ['upgrade', '-y', 'python3', 'python3-pip']);
        return await this.getCommandVersion('python3', ['--version']) || 'Unknown';
    }

    private async updateGo(): Promise<string> {
        // Fetch latest version
        const latestVersion = await this.getLatestGoVersion() || '1.22.0';
        const ARCH = os.arch() === 'x64' ? 'amd64' : 'arm64';

        this.onLog(`📥 Downloading Go ${latestVersion}...\n`, 'stdout');

        // Download latest Go tarball
        await this.runCommand('wget', [
            '-q', '--show-progress',
            `https://go.dev/dl/go${latestVersion}.linux-${ARCH}.tar.gz`,
            '-O', '/tmp/go.tar.gz'
        ]);

        // Remove old Go installation
        await this.runCommandSilent('rm', ['-rf', '/usr/local/go']);

        // Extract new version
        this.onLog(`📦 Extracting...\n`, 'stdout');
        await this.runCommand('tar', ['-C', '/usr/local', '-xzf', '/tmp/go.tar.gz']);

        // Clean up
        await this.runCommandSilent('rm', ['/tmp/go.tar.gz']);

        return latestVersion;
    }

    private async updateDocker(): Promise<string> {
        await this.runCommand('apt-get', ['update']);
        await this.runCommand('apt-get', ['upgrade', '-y', 'docker.io', 'docker-compose']);
        await this.runCommand('systemctl', ['restart', 'docker']);
        return await this.getCommandVersion('docker', ['--version']) || 'Unknown';
    }

    private async updateRust(): Promise<string> {
        const cargoPath = `${os.homedir()}/.cargo/bin`;
        const rustupPath = `${cargoPath}/rustup`;

        if (fs.existsSync(rustupPath)) {
            // Use rustup to update
            await this.runCommand(rustupPath, ['update', 'stable']);
        } else {
            // Reinstall if rustup not available
            this.onLog(`Rustup not found, reinstalling...\n`, 'stdout');
            await this.runCommand('curl', [
                '--proto', '=https', '--tlsv1.2', '-sSf',
                'https://sh.rustup.rs', '-o', '/tmp/rustup.sh'
            ]);
            await this.runCommand('sh', ['/tmp/rustup.sh', '-y', '--default-toolchain', 'stable']);
            await this.runCommandSilent('rm', ['/tmp/rustup.sh']);
        }

        process.env.PATH = `${cargoPath}:${process.env.PATH}`;
        return await this.getCommandVersion(`${cargoPath}/rustc`, ['--version']) || 'Unknown';
    }

    private async updateRuby(): Promise<string> {
        await this.runCommand('apt-get', ['update']);
        await this.runCommand('apt-get', ['upgrade', '-y', 'ruby', 'ruby-dev']);
        await this.runCommand('gem', ['update', '--system']);
        return await this.getCommandVersion('ruby', ['--version']) || 'Unknown';
    }

    // ============================================
    // DATABASE CONFIGURATION
    // ============================================

    private async configurePostgresql(dbName: string, opts: DbSecurityOptions): Promise<string> {
        // Generate secure credentials
        const password = crypto.randomBytes(24).toString('base64url');
        const user = `${dbName}_user`;

        // Install if not present
        const isInstalled = await this.commandExists('psql');
        if (!isInstalled) {
            await this.runCommand('apt-get', ['update']);
            await this.runCommand('apt-get', ['install', '-y', 'postgresql', 'postgresql-contrib']);
            await this.runCommand('systemctl', ['enable', 'postgresql']);
            await this.runCommand('systemctl', ['start', 'postgresql']);
            // Wait for PostgreSQL to start
            await this.sleep(2000);
        }

        // Apply security options
        if (opts.bindLocalhost) {
            this.onLog(`🔒 Configuring PostgreSQL to listen only on localhost...\n`, 'stdout');
            // PostgreSQL default is localhost only, but ensure it's set
            const configPath = '/etc/postgresql';
            try {
                // Find the actual config directory (version-specific)
                const versions = fs.readdirSync(configPath);
                for (const version of versions) {
                    const confFile = `${configPath}/${version}/main/postgresql.conf`;
                    if (fs.existsSync(confFile)) {
                        let config = fs.readFileSync(confFile, 'utf-8');
                        // Ensure listen_addresses is localhost only
                        if (!config.includes("listen_addresses = 'localhost'")) {
                            config = config.replace(/^#?listen_addresses\s*=.*$/m, "listen_addresses = 'localhost'");
                            fs.writeFileSync(confFile, config);
                            this.onLog(`  Updated ${confFile}\n`, 'stdout');
                        }
                    }
                }
            } catch (e) {
                this.onLog(`  Warning: Could not update postgresql.conf\n`, 'stderr');
            }
        }

        if (opts.configureHba) {
            this.onLog(`🔒 Configuring pg_hba.conf for secure authentication...\n`, 'stdout');
            // Configure pg_hba.conf for md5/scram-sha-256 authentication
            const configPath = '/etc/postgresql';
            try {
                const versions = fs.readdirSync(configPath);
                for (const version of versions) {
                    const hbaFile = `${configPath}/${version}/main/pg_hba.conf`;
                    if (fs.existsSync(hbaFile)) {
                        let hba = fs.readFileSync(hbaFile, 'utf-8');
                        // Ensure local connections use scram-sha-256 or md5
                        if (hba.includes('trust') && !hba.includes('# trust disabled')) {
                            hba = hba.replace(/local\s+all\s+all\s+trust/g, 'local   all             all                                     scram-sha-256');
                            hba = hba.replace(/host\s+all\s+all\s+127\.0\.0\.1\/32\s+trust/g, 'host    all             all             127.0.0.1/32            scram-sha-256');
                            hba = hba.replace(/host\s+all\s+all\s+::1\/128\s+trust/g, 'host    all             all             ::1/128                 scram-sha-256');
                            fs.writeFileSync(hbaFile, hba);
                            this.onLog(`  Updated ${hbaFile}\n`, 'stdout');
                        }
                    }
                }
                // Reload PostgreSQL to apply changes
                await this.runCommand('systemctl', ['reload', 'postgresql']);
            } catch (e) {
                this.onLog(`  Warning: Could not update pg_hba.conf\n`, 'stderr');
            }
        }

        // Create user and database (use su if root, sudo if not)
        this.onLog(`Creating user ${user}...\n`, 'stdout');
        const createUser = runAsUser('postgres', `psql -c "CREATE USER ${user} WITH PASSWORD '${password}';"`);
        await this.runCommandSilent(createUser.cmd, createUser.args);

        this.onLog(`Creating database ${dbName}...\n`, 'stdout');
        const createDb = runAsUser('postgres', `psql -c "CREATE DATABASE ${dbName} OWNER ${user};"`);
        await this.runCommandSilent(createDb.cmd, createDb.args);

        this.onLog(`Granting privileges...\n`, 'stdout');
        const grantPrivs = runAsUser('postgres', `psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${user};"`);
        await this.runCommandSilent(grantPrivs.cmd, grantPrivs.args);

        return `postgresql://${user}:${password}@localhost:5432/${dbName}`;
    }

    private async configureMysql(dbName: string, opts: DbSecurityOptions): Promise<string> {
        // Generate secure credentials for the app user
        const password = crypto.randomBytes(24).toString('base64url');
        const user = `${dbName}_user`;

        // Check if MySQL is already secured (we have stored root credentials)
        let storedCreds = getDbCredentials('mysql');

        // Install if not present (use default-mysql-server for Debian 11+ compatibility)
        const isInstalled = await this.commandExists('mysql');
        if (!isInstalled) {
            this.onLog(`📥 Installing MariaDB (MySQL-compatible)...\n`, 'stdout');
            await this.runCommand('apt-get', ['update']);
            // default-mysql-server installs MariaDB on Debian 11+
            await this.runCommand('apt-get', ['install', '-y', 'default-mysql-server', 'default-mysql-client']);
            await this.runCommand('systemctl', ['enable', 'mariadb']);
            await this.runCommand('systemctl', ['start', 'mariadb']);
            await this.sleep(2000);

            // Generate root password if security option enabled
            const rootPassword = opts.setRootPassword ? crypto.randomBytes(24).toString('base64url') : '';

            // Apply security options
            if (opts.setRootPassword) {
                this.onLog(`🔒 Setting root password...\n`, 'stdout');
                // MariaDB on Debian uses unix_socket auth by default for root
                // Use mariadb-admin to set password (works with unix_socket)
                await this.runCommand('mariadb-admin', ['-u', 'root', 'password', rootPassword]);
            }

            // For subsequent operations, use root password if set
            const mysqlAuthInit = opts.setRootPassword ? ['-u', 'root', `-p${rootPassword}`] : ['-u', 'root'];

            if (opts.removeAnonymousUsers) {
                this.onLog(`🔒 Removing anonymous users...\n`, 'stdout');
                await this.runCommand('mysql', [...mysqlAuthInit, '-e',
                    `DELETE FROM mysql.user WHERE User='';`
                ]);
            }

            if (opts.disableRemoteRoot) {
                this.onLog(`🔒 Disabling remote root login...\n`, 'stdout');
                await this.runCommand('mysql', [...mysqlAuthInit, '-e',
                    `DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');`
                ]);
            }

            if (opts.removeTestDb) {
                this.onLog(`🔒 Removing test database...\n`, 'stdout');
                await this.runCommand('mysql', [...mysqlAuthInit, '-e',
                    `DROP DATABASE IF EXISTS test;`
                ]);
                await this.runCommand('mysql', [...mysqlAuthInit, '-e',
                    `DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';`
                ]);
            }

            if (opts.bindLocalhost) {
                this.onLog(`🔒 Configuring MySQL to listen only on localhost...\n`, 'stdout');
                // Check for MariaDB config location
                const configPaths = ['/etc/mysql/mariadb.conf.d/50-server.cnf', '/etc/mysql/my.cnf'];
                for (const configPath of configPaths) {
                    if (fs.existsSync(configPath)) {
                        let config = fs.readFileSync(configPath, 'utf-8');
                        // Ensure bind-address is localhost
                        if (!config.includes('bind-address = 127.0.0.1')) {
                            config = config.replace(/^#?bind-address\s*=.*$/m, 'bind-address = 127.0.0.1');
                            fs.writeFileSync(configPath, config);
                            this.onLog(`  Updated ${configPath}\n`, 'stdout');
                        }
                        break;
                    }
                }
            }

            await this.runCommand('mysql', [...mysqlAuthInit, '-e', 'FLUSH PRIVILEGES;']);

            // Store credentials securely if root password was set
            if (opts.setRootPassword) {
                storeDbCredentials('mysql', {
                    rootPassword,
                    createdAt: new Date().toISOString()
                });
                storedCreds = { rootPassword, createdAt: new Date().toISOString() };
                this.onLog(`✅ MySQL secured. Root credentials stored in ~/.server-flow/credentials/\n`, 'stdout');
            }

            // Restart MySQL to apply bind-address change
            if (opts.bindLocalhost) {
                await this.runCommand('systemctl', ['restart', 'mariadb']);
                await this.sleep(2000);
            }
        }

        // Use stored root credentials for operations (always use -u root for MariaDB unix_socket)
        const mysqlAuth = storedCreds ? ['-u', 'root', `-p${storedCreds.rootPassword}`] : ['-u', 'root'];

        // Create user and database
        this.onLog(`Creating database ${dbName}...\n`, 'stdout');
        await this.runCommand('mysql', [...mysqlAuth, '-e',
            `CREATE DATABASE IF NOT EXISTS ${dbName};`
        ]);
        this.onLog(`Creating user ${user}...\n`, 'stdout');
        await this.runCommand('mysql', [...mysqlAuth, '-e',
            `CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}';`
        ]);
        this.onLog(`Granting privileges...\n`, 'stdout');
        await this.runCommand('mysql', [...mysqlAuth, '-e',
            `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${user}'@'localhost';`
        ]);
        await this.runCommand('mysql', [...mysqlAuth, '-e', 'FLUSH PRIVILEGES;']);

        return `mysql://${user}:${password}@localhost:3306/${dbName}`;
    }

    private async configureRedis(opts: DbSecurityOptions): Promise<string> {
        // Generate secure password
        const password = crypto.randomBytes(24).toString('base64url');

        // Install if not present
        const isInstalled = await this.commandExists('redis-server');
        if (!isInstalled) {
            this.onLog(`📥 Installing Redis...\n`, 'stdout');
            await this.runCommand('apt-get', ['update']);
            await this.runCommand('apt-get', ['install', '-y', 'redis-server']);
            await this.runCommand('systemctl', ['enable', 'redis-server']);
        }

        // Configure Redis security options
        const configPath = '/etc/redis/redis.conf';
        if (fs.existsSync(configPath)) {
            let config = fs.readFileSync(configPath, 'utf-8');

            // Set password (requirepass)
            this.onLog(`🔒 Setting Redis password...\n`, 'stdout');
            config = config.replace(/^#?requirepass\s+.*$/m, '');
            config += `\nrequirepass ${password}\n`;

            if (opts.bindLocalhost) {
                this.onLog(`🔒 Configuring Redis to listen only on localhost...\n`, 'stdout');
                // Ensure bind is set to localhost only
                config = config.replace(/^#?bind\s+.*$/m, 'bind 127.0.0.1 ::1');
            }

            if (opts.enableProtectedMode) {
                this.onLog(`🔒 Enabling Redis protected mode...\n`, 'stdout');
                // Protected mode prevents external access when no password is set
                // Even with password, it's good to keep it enabled
                config = config.replace(/^#?protected-mode\s+.*$/m, 'protected-mode yes');
            }

            fs.writeFileSync(configPath, config);
            this.onLog(`  Updated ${configPath}\n`, 'stdout');
        }

        await this.runCommand('systemctl', ['restart', 'redis-server']);

        return `redis://:${password}@localhost:6379`;
    }

    // ============================================
    // HELPERS
    // ============================================

    private async runCommand(cmd: string, args: string[], stdin?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const user = os.userInfo().username;
            const hostname = os.hostname();
            const promptChar = user === 'root' ? '#' : '$';
            this.onLog(`${user}@${hostname}:~${promptChar} ${cmd} ${args.join(' ')}\n`, 'stdout');

            const proc = spawn(cmd, args, {
                env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }
            });

            if (stdin) {
                proc.stdin.write(stdin);
                proc.stdin.end();
            }

            proc.stdout.on('data', (data) => {
                this.onLog(data.toString(), 'stdout');
            });

            proc.stderr.on('data', (data) => {
                this.onLog(data.toString(), 'stderr');
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }

    private async runCommandSilent(cmd: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(cmd, args, {
                env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `Command failed with code ${code}`));
                }
            });

            proc.on('error', reject);
        });
    }

    private async getCommandVersion(cmd: string, args: string[]): Promise<string | null> {
        try {
            const output = await this.runCommandSilent(cmd, args);
            // Extract version number from output
            const match = output.match(/(\d+\.\d+(\.\d+)?)/);
            return match ? match[1] : output.trim().split('\n')[0];
        } catch {
            return null;
        }
    }

    private async commandExists(cmd: string): Promise<boolean> {
        try {
            await this.runCommandSilent('which', [cmd]);
            return true;
        } catch {
            return false;
        }
    }

    private async isServiceRunning(service: string): Promise<boolean> {
        try {
            const result = await this.runCommandSilent('systemctl', ['is-active', service]);
            return result.trim() === 'active';
        } catch {
            return false;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
