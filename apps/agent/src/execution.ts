import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import { DiffAnalyzer } from './diff.js';
import { ProcessManager } from './process.js';

const APPS_DIR = path.join(os.homedir(), '.server-flow', 'apps');

// Multi-runtime support
type RuntimeType = 'nodejs' | 'python' | 'go' | 'rust' | 'ruby' | 'docker' | 'static';

interface ProjectInfo {
    type: RuntimeType;
    framework?: string;           // e.g., 'fastapi', 'django', 'rails'
    packageManager?: string;      // e.g., 'pip', 'poetry', 'bundler'
    installCommands: string[][];  // [['pip', 'install', '-r', 'requirements.txt']]
    buildCommands: string[][];    // [['npm', 'run', 'build']]
    startCommand: string[];       // ['npm', 'start'] or ['uvicorn', 'main:app']
    interpreter?: string;         // For PM2: 'python', 'ruby', etc.
}

// Python framework detection
function detectPythonFramework(workDir: string): { framework: string; wsgi: string } {
    const reqPath = path.join(workDir, 'requirements.txt');
    const pyprojectPath = path.join(workDir, 'pyproject.toml');
    const files = fs.readdirSync(workDir);

    let content = '';
    if (fs.existsSync(reqPath)) {
        content = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
    } else if (fs.existsSync(pyprojectPath)) {
        content = fs.readFileSync(pyprojectPath, 'utf-8').toLowerCase();
    }

    // FastAPI / Starlette
    if (content.includes('fastapi') || content.includes('starlette')) {
        // Try to find the app entrypoint
        const mainFiles = ['main.py', 'app.py', 'api.py', 'server.py'];
        for (const f of mainFiles) {
            if (files.includes(f)) {
                const appContent = fs.readFileSync(path.join(workDir, f), 'utf-8');
                const match = appContent.match(/(\w+)\s*=\s*FastAPI\(/);
                const appName = match ? match[1] : 'app';
                return { framework: 'fastapi', wsgi: `${f.replace('.py', '')}:${appName}` };
            }
        }
        return { framework: 'fastapi', wsgi: 'main:app' };
    }

    // Django
    if (content.includes('django') || files.includes('manage.py')) {
        // Find wsgi.py
        for (const f of files) {
            const wsgiPath = path.join(workDir, f, 'wsgi.py');
            if (fs.existsSync(wsgiPath)) {
                return { framework: 'django', wsgi: `${f}.wsgi:application` };
            }
        }
        return { framework: 'django', wsgi: 'project.wsgi:application' };
    }

    // Flask
    if (content.includes('flask')) {
        const mainFiles = ['app.py', 'main.py', 'wsgi.py', 'application.py'];
        for (const f of mainFiles) {
            if (files.includes(f)) {
                return { framework: 'flask', wsgi: `${f.replace('.py', '')}:app` };
            }
        }
        return { framework: 'flask', wsgi: 'app:app' };
    }

    return { framework: 'generic', wsgi: 'main:app' };
}

// Python package manager detection
function detectPythonPackageManager(workDir: string): string {
    if (fs.existsSync(path.join(workDir, 'pyproject.toml'))) {
        const content = fs.readFileSync(path.join(workDir, 'pyproject.toml'), 'utf-8');
        if (content.includes('[tool.poetry]')) return 'poetry';
        if (content.includes('[tool.pdm]')) return 'pdm';
    }
    if (fs.existsSync(path.join(workDir, 'Pipfile'))) return 'pipenv';
    return 'pip';
}

// Rust binary name from Cargo.toml
function getRustBinaryName(workDir: string): string {
    const cargoPath = path.join(workDir, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
        const content = fs.readFileSync(cargoPath, 'utf-8');
        const match = content.match(/name\s*=\s*"([^"]+)"/);
        if (match) return match[1];
    }
    return 'app';
}

// Ruby framework detection
function detectRubyFramework(workDir: string): string {
    const files = fs.readdirSync(workDir);
    if (files.includes('config.ru') && fs.existsSync(path.join(workDir, 'config', 'application.rb'))) {
        return 'rails';
    }
    if (files.includes('config.ru')) return 'rack';
    return 'sinatra';
}

// Main detection function
function detectProjectType(workDir: string, port: number): ProjectInfo {
    const files = fs.readdirSync(workDir);

    // Priority 1: Docker (explicit containerization)
    if (files.includes('Dockerfile')) {
        return {
            type: 'docker',
            installCommands: [],
            buildCommands: [['docker', 'build', '-t', 'app:latest', '.']],
            startCommand: ['docker', 'run', '-d', '-p', `${port}:${port}`, '--name', 'app', 'app:latest']
        };
    }

    // Priority 2: Node.js
    if (files.includes('package.json')) {
        const pkgPath = path.join(workDir, 'package.json');
        try {
            const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const hasStart = Boolean(pkgJson.scripts?.start);
            const hasBuild = Boolean(pkgJson.scripts?.build);

            return {
                type: 'nodejs',
                installCommands: [['pnpm', 'install', '--frozen-lockfile']],
                buildCommands: hasBuild ? [['npm', 'run', 'build']] : [],
                startCommand: hasStart ? ['npm', 'start'] : ['npx', 'serve', '-s', '.', '-l', String(port)]
            };
        } catch {
            return {
                type: 'nodejs',
                installCommands: [['pnpm', 'install']],
                buildCommands: [],
                startCommand: ['npx', 'serve', '-s', '.', '-l', String(port)]
            };
        }
    }

    // Priority 3: Go
    if (files.includes('go.mod')) {
        return {
            type: 'go',
            installCommands: [['go', 'mod', 'download']],
            buildCommands: [['go', 'build', '-o', 'app', '.']],
            startCommand: ['./app']
        };
    }

    // Priority 4: Rust
    if (files.includes('Cargo.toml')) {
        const binaryName = getRustBinaryName(workDir);
        return {
            type: 'rust',
            installCommands: [['cargo', 'fetch']],
            buildCommands: [['cargo', 'build', '--release']],
            startCommand: [`./target/release/${binaryName}`]
        };
    }

    // Priority 5: Python
    if (files.includes('requirements.txt') || files.includes('pyproject.toml') || files.includes('Pipfile')) {
        const pkgManager = detectPythonPackageManager(workDir);
        const { framework, wsgi } = detectPythonFramework(workDir);

        let installCmds: string[][] = [];
        let startCmd: string[] = [];

        // Install commands based on package manager
        switch (pkgManager) {
            case 'poetry':
                installCmds = [['poetry', 'install', '--no-dev']];
                break;
            case 'pipenv':
                installCmds = [['pipenv', 'install', '--deploy']];
                break;
            case 'pdm':
                installCmds = [['pdm', 'install', '--prod']];
                break;
            default: // pip
                installCmds = [
                    ['python', '-m', 'venv', '.venv'],
                    ['.venv/bin/pip', 'install', '-r', 'requirements.txt']
                ];
        }

        // Start command based on framework
        switch (framework) {
            case 'fastapi':
                startCmd = ['uvicorn', wsgi, '--host', '0.0.0.0', '--port', String(port)];
                break;
            case 'django':
                startCmd = ['gunicorn', wsgi, '--bind', `0.0.0.0:${port}`];
                break;
            case 'flask':
                startCmd = ['gunicorn', wsgi, '--bind', `0.0.0.0:${port}`];
                break;
            default:
                startCmd = ['python', 'main.py'];
        }

        return {
            type: 'python',
            framework,
            packageManager: pkgManager,
            interpreter: 'python',
            installCommands: installCmds,
            buildCommands: [], // Python typically doesn't have a build step
            startCommand: startCmd
        };
    }

    // Priority 6: Ruby
    if (files.includes('Gemfile')) {
        const framework = detectRubyFramework(workDir);

        let buildCmds: string[][] = [];
        let startCmd: string[] = [];

        if (framework === 'rails') {
            buildCmds = [['bundle', 'exec', 'rails', 'assets:precompile']];
            startCmd = ['bundle', 'exec', 'puma', '-C', 'config/puma.rb'];
        } else {
            startCmd = ['bundle', 'exec', 'rackup', '-p', String(port), '-o', '0.0.0.0'];
        }

        return {
            type: 'ruby',
            framework,
            packageManager: 'bundler',
            interpreter: 'ruby',
            installCommands: [['bundle', 'install', '--deployment', '--without', 'development', 'test']],
            buildCommands: buildCmds,
            startCommand: startCmd
        };
    }

    // Default: Static site
    return {
        type: 'static',
        installCommands: [],
        buildCommands: [],
        startCommand: ['npx', 'serve', '-s', '.', '-l', String(port)]
    };
}

export interface DeployContext {
    repoUrl: string;
    commitHash?: string;
    branch?: string;
    env?: Record<string, string>;
}

export class ExecutionManager {
    private processManager: ProcessManager;

    constructor(private onLog: (data: string, stream: 'stdout' | 'stderr') => void) {
        if (!fs.existsSync(APPS_DIR)) {
            fs.mkdirSync(APPS_DIR, { recursive: true });
        }
        this.processManager = new ProcessManager(onLog);
    }

    private async runCommand(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<number | null> {
        return new Promise((resolve) => {
            const displayCmd = `${cmd} ${args.join(' ')}`;
            console.log(`[RUN] ${displayCmd} in ${cwd}`);
            this.onLog(`\n$ ${displayCmd}\n`, 'stdout');

            const isWin = process.platform === 'win32';
            const exe = isWin && (cmd === 'pnpm' || cmd === 'npm') ? `${cmd}.cmd` : cmd;

            const proc = spawn(exe, args, {
                cwd,
                shell: false,
                env: { ...process.env, ...env, NODE_ENV: 'production' }
            });

            proc.stdout?.on('data', (data) => this.onLog(data.toString(), 'stdout'));
            proc.stderr?.on('data', (data) => this.onLog(data.toString(), 'stderr'));
            proc.on('close', (code) => resolve(code));
            proc.on('error', (err) => {
                this.onLog(`Process Error (${cmd}): ${err.message}\n`, 'stderr');
                resolve(1);
            });
        });
    }

    private async verifyAppHealth(port: number, timeoutMs = 15000): Promise<boolean> {
        this.onLog(`🔍 Checking app health on port ${port}...\n`, 'stdout');
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            const connected = await new Promise<boolean>((resolve) => {
                const socket = net.connect(port, 'localhost');
                socket.on('connect', () => { socket.end(); resolve(true); });
                socket.on('error', () => resolve(false));
            });

            if (connected) return true;
            await new Promise(r => setTimeout(r, 1000));
        }
        return false;
    }

    // Helper to convert startCommand array to string for PM2
    private formatStartCommand(cmd: string[]): string {
        return cmd.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ');
    }

    // Run install/build steps for a project
    private async runProjectSetup(projectInfo: ProjectInfo, workDir: string, env?: Record<string, string>): Promise<boolean> {
        // Run install commands
        for (const cmd of projectInfo.installCommands) {
            if (cmd.length === 0) continue;
            const code = await this.runCommand(cmd[0], cmd.slice(1), workDir, env);
            if (code !== 0) {
                this.onLog(`\n❌ Install failed: ${cmd.join(' ')}\n`, 'stderr');
                return false;
            }
        }

        // Run build commands
        for (const cmd of projectInfo.buildCommands) {
            if (cmd.length === 0) continue;
            const code = await this.runCommand(cmd[0], cmd.slice(1), workDir, env);
            if (code !== 0) {
                this.onLog(`\n❌ Build failed: ${cmd.join(' ')}\n`, 'stderr');
                return false;
            }
        }

        return true;
    }

    async deploy(context: DeployContext, appPort = 3000): Promise<{ success: boolean, buildSkipped: boolean, healthCheckFailed: boolean }> {
        const repoName = context.repoUrl.split('/').pop()?.replace('.git', '') || 'unnamed-app';
        const workDir = path.join(APPS_DIR, repoName);
        let buildSkipped = false;
        let healthCheckFailed = false;

        try {
            // 1. Get Current stable Commit
            let oldHash = '';
            if (fs.existsSync(path.join(workDir, '.git'))) {
                try {
                    oldHash = execSync('git rev-parse HEAD', { cwd: workDir }).toString().trim();
                } catch (e) { }
            }

            // 2. Prepare Directory / Update code
            if (!fs.existsSync(path.join(workDir, '.git'))) {
                if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
                fs.mkdirSync(workDir, { recursive: true });
                await this.runCommand('git', ['clone', context.repoUrl, '.'], workDir);
            } else {
                await this.runCommand('git', ['fetch', '--all'], workDir);
            }

            // 3. Checkout target
            const target = context.commitHash || context.branch || 'main';
            await this.runCommand('git', ['checkout', '-f', target], workDir);

            // 4. Detect project type (multi-runtime support)
            const projectInfo = detectProjectType(workDir, appPort);
            const runtimeEmoji = {
                nodejs: '📦', python: '🐍', go: '🐹', rust: '🦀',
                ruby: '💎', docker: '🐳', static: '📄'
            };
            this.onLog(`\n${runtimeEmoji[projectInfo.type] || '📦'} ${projectInfo.type.toUpperCase()} project detected`, 'stdout');
            if (projectInfo.framework) {
                this.onLog(` (${projectInfo.framework})`, 'stdout');
            }
            this.onLog('\n', 'stdout');

            // 5. Hot-Path Analysis (skip build if no relevant changes)
            const isNoRelevantChange = DiffAnalyzer.shouldSkipBuild(workDir, oldHash, context.commitHash || target);

            if (isNoRelevantChange && oldHash !== '') {
                this.onLog(`\n⚡ Hot-Path Triggered. Skipping Build.\n`, 'stdout');
                buildSkipped = true;
            } else if (projectInfo.type === 'static') {
                this.onLog(`\n📄 Static site - no build required\n`, 'stdout');
                buildSkipped = true;
            } else {
                // 6. Run install & build
                const setupSuccess = await this.runProjectSetup(projectInfo, workDir, context.env);
                if (!setupSuccess) {
                    return { success: false, buildSkipped, healthCheckFailed };
                }
            }

            // 7. Start the application
            const startCmd = this.formatStartCommand(projectInfo.startCommand);
            this.onLog(`\n🚀 Starting application ${repoName}...\n`, 'stdout');
            this.onLog(`   Command: ${startCmd}\n`, 'stdout');

            await this.processManager.startApp(repoName, workDir, context.env, startCmd);

            // 8. HEALTH CHECK
            const isHealthy = await this.verifyAppHealth(appPort);

            if (!isHealthy) {
                this.onLog(`\n🚨 HEALTH CHECK FAILED. Initiating Rollback...\n`, 'stderr');
                healthCheckFailed = true;

                if (oldHash) {
                    await this.runCommand('git', ['checkout', '-f', oldHash], workDir);
                    const rollbackProjectInfo = detectProjectType(workDir, appPort);
                    await this.runProjectSetup(rollbackProjectInfo, workDir, context.env);
                    const rollbackCmd = this.formatStartCommand(rollbackProjectInfo.startCommand);
                    await this.processManager.startApp(repoName, workDir, context.env, rollbackCmd);
                    this.onLog(`\n↩️ Rollback Successful.\n`, 'stdout');
                } else {
                    await this.processManager.stopApp(repoName);
                }
                return { success: false, buildSkipped, healthCheckFailed };
            }

            this.onLog(`\n✨ Deployment Successful and Verified\n`, 'stdout');
            return { success: true, buildSkipped, healthCheckFailed };

        } catch (err: any) {
            this.onLog(`Critical Deployment Error: ${err.message}\n`, 'stderr');
            return { success: false, buildSkipped, healthCheckFailed };
        }
    }
}
