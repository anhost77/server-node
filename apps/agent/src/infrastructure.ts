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

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

// Types
export type RuntimeType = 'nodejs' | 'python' | 'go' | 'docker' | 'rust' | 'ruby';
export type DatabaseType = 'postgresql' | 'mysql' | 'redis';

export interface RuntimeInfo {
    type: RuntimeType;
    installed: boolean;
    version?: string;
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

export class InfrastructureManager {
    private onLog: LogFn;

    constructor(onLog: LogFn) {
        this.onLog = onLog;
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
            return { success: true, version };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to install ${type}: ${err.message}\n`, 'stderr');
            return { success: false, error: err.message };
        }
    }

    /**
     * Configure a database (returns connection string, password NOT stored)
     */
    async configureDatabase(type: DatabaseType, dbName: string): Promise<{
        success: boolean;
        connectionString?: string;
        error?: string;
    }> {
        this.onLog(`\n🗄️ Configuring ${type} database: ${dbName}...\n`, 'stdout');

        try {
            let connectionString: string;
            switch (type) {
                case 'postgresql':
                    connectionString = await this.configurePostgresql(dbName);
                    break;
                case 'mysql':
                    connectionString = await this.configureMysql(dbName);
                    break;
                case 'redis':
                    connectionString = await this.configureRedis();
                    break;
                default:
                    throw new Error(`Unknown database: ${type}`);
            }
            this.onLog(`\n✅ ${type} configured successfully\n`, 'stdout');
            this.onLog(`\n🔐 Connection string (copy this, it won't be stored):\n`, 'stdout');
            this.onLog(`${connectionString}\n`, 'stdout');
            return { success: true, connectionString };
        } catch (err: any) {
            this.onLog(`\n❌ Failed to configure ${type}: ${err.message}\n`, 'stderr');
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
            }
        }

        return runtimes;
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
        await this.runCommand('apt-get', ['install', '-y',
            'ruby', 'ruby-dev', 'ruby-bundler'
        ]);
        // Install common Ruby gems
        await this.runCommand('gem', ['install', 'puma', 'bundler', '--no-document']);

        return await this.getCommandVersion('ruby', ['--version']) || 'Unknown';
    }

    // ============================================
    // DATABASE CONFIGURATION
    // ============================================

    private async configurePostgresql(dbName: string): Promise<string> {
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

        // Create user and database
        await this.runCommandSilent('sudo', ['-u', 'postgres', 'psql', '-c',
            `CREATE USER ${user} WITH PASSWORD '${password}';`
        ]);
        await this.runCommandSilent('sudo', ['-u', 'postgres', 'psql', '-c',
            `CREATE DATABASE ${dbName} OWNER ${user};`
        ]);
        await this.runCommandSilent('sudo', ['-u', 'postgres', 'psql', '-c',
            `GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${user};`
        ]);

        return `postgresql://${user}:${password}@localhost:5432/${dbName}`;
    }

    private async configureMysql(dbName: string): Promise<string> {
        // Generate secure credentials
        const password = crypto.randomBytes(24).toString('base64url');
        const user = `${dbName}_user`;

        // Install if not present
        const isInstalled = await this.commandExists('mysql');
        if (!isInstalled) {
            // Set root password non-interactively
            const rootPassword = crypto.randomBytes(24).toString('base64url');
            await this.runCommand('debconf-set-selections', [],
                `mysql-server mysql-server/root_password password ${rootPassword}\n` +
                `mysql-server mysql-server/root_password_again password ${rootPassword}`
            );
            await this.runCommand('apt-get', ['update']);
            await this.runCommand('apt-get', ['install', '-y', 'mysql-server']);
            await this.runCommand('systemctl', ['enable', 'mysql']);
            await this.runCommand('systemctl', ['start', 'mysql']);
            await this.sleep(2000);
        }

        // Create user and database
        await this.runCommandSilent('mysql', ['-e',
            `CREATE DATABASE IF NOT EXISTS ${dbName};`
        ]);
        await this.runCommandSilent('mysql', ['-e',
            `CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${password}';`
        ]);
        await this.runCommandSilent('mysql', ['-e',
            `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${user}'@'localhost';`
        ]);
        await this.runCommandSilent('mysql', ['-e', 'FLUSH PRIVILEGES;']);

        return `mysql://${user}:${password}@localhost:3306/${dbName}`;
    }

    private async configureRedis(): Promise<string> {
        // Generate secure password
        const password = crypto.randomBytes(24).toString('base64url');

        // Install if not present
        const isInstalled = await this.commandExists('redis-server');
        if (!isInstalled) {
            await this.runCommand('apt-get', ['update']);
            await this.runCommand('apt-get', ['install', '-y', 'redis-server']);
            await this.runCommand('systemctl', ['enable', 'redis-server']);
        }

        // Configure password
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

        return `redis://:${password}@localhost:6379`;
    }

    // ============================================
    // HELPERS
    // ============================================

    private async runCommand(cmd: string, args: string[], stdin?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.onLog(`$ ${cmd} ${args.join(' ')}\n`, 'stdout');

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
