import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import { DiffAnalyzer } from './diff.js';
import { ProcessManager } from './process.js';

const APPS_DIR = path.join(os.homedir(), '.server-flow', 'apps');

type ProjectType = 'nodejs' | 'static';

interface ProjectInfo {
    type: ProjectType;
    startScript: string;
    hasStartScript: boolean;
}

function detectProjectType(workDir: string, port: number): ProjectInfo {
    const pkgPath = path.join(workDir, 'package.json');

    if (fs.existsSync(pkgPath)) {
        try {
            const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const hasStart = Boolean(pkgJson.scripts?.start);
            return {
                type: 'nodejs',
                hasStartScript: hasStart,
                startScript: hasStart ? 'npm start' : `npx serve -s . -l ${port}`
            };
        } catch {
            return { type: 'nodejs', hasStartScript: false, startScript: `npx serve -s . -l ${port}` };
        }
    }

    // No package.json = static site
    return { type: 'static', hasStartScript: false, startScript: `npx serve -s . -l ${port}` };
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

            // 4. Hot-Path Analysis
            const isNoRelevantChange = DiffAnalyzer.shouldSkipBuild(workDir, oldHash, context.commitHash || target);

            if (isNoRelevantChange && oldHash !== '') {
                this.onLog(`\n⚡ Hot-Path Triggered. Skipping Build.\n`, 'stdout');
                buildSkipped = true;
            } else {
                // 5. Check project type and Install & Build if needed
                const hasPackageJson = fs.existsSync(path.join(workDir, 'package.json'));

                if (hasPackageJson) {
                    this.onLog(`\n📦 Node.js project detected\n`, 'stdout');
                    await this.runCommand('pnpm', ['install', '--frozen-lockfile'], workDir);

                    // Check if build script exists
                    try {
                        const pkgJson = JSON.parse(fs.readFileSync(path.join(workDir, 'package.json'), 'utf-8'));
                        if (pkgJson.scripts?.build) {
                            const buildCode = await this.runCommand('npm', ['run', 'build'], workDir, context.env);
                            if (buildCode !== 0) {
                                this.onLog(`\n❌ Build failed with exit code ${buildCode}\n`, 'stderr');
                                return { success: false, buildSkipped, healthCheckFailed };
                            }
                        } else {
                            this.onLog(`\n⏭️ No build script found, skipping build step\n`, 'stdout');
                        }
                    } catch (e) {
                        this.onLog(`\n⚠️ Could not parse package.json, attempting build anyway\n`, 'stderr');
                        const buildCode = await this.runCommand('npm', ['run', 'build'], workDir, context.env);
                        if (buildCode !== 0) {
                            this.onLog(`\n❌ Build failed with exit code ${buildCode}\n`, 'stderr');
                            return { success: false, buildSkipped, healthCheckFailed };
                        }
                    }
                } else {
                    this.onLog(`\n📄 Static site detected (no package.json)\n`, 'stdout');
                    buildSkipped = true;
                }
            }

            // 6. Detect project type and determine start script
            const projectInfo = detectProjectType(workDir, appPort);
            this.onLog(`\n🚀 Starting application ${repoName} (${projectInfo.type})...\n`, 'stdout');

            if (!projectInfo.hasStartScript) {
                this.onLog(`📡 Using static server: ${projectInfo.startScript}\n`, 'stdout');
            }

            await this.processManager.startApp(repoName, workDir, context.env, projectInfo.startScript);

            // 7. HEALTH CHECK
            const isHealthy = await this.verifyAppHealth(appPort);

            if (!isHealthy) {
                this.onLog(`\n🚨 HEALTH CHECK FAILED. Initiating Rollback...\n`, 'stderr');
                healthCheckFailed = true;

                if (oldHash) {
                    await this.runCommand('git', ['checkout', '-f', oldHash], workDir);
                    const hasPackageJson = fs.existsSync(path.join(workDir, 'package.json'));
                    if (hasPackageJson) {
                        await this.runCommand('pnpm', ['install'], workDir);
                        try {
                            const pkgJson = JSON.parse(fs.readFileSync(path.join(workDir, 'package.json'), 'utf-8'));
                            if (pkgJson.scripts?.build) {
                                await this.runCommand('npm', ['run', 'build'], workDir);
                            }
                        } catch (e) {
                            await this.runCommand('npm', ['run', 'build'], workDir);
                        }
                    }
                    const rollbackProjectInfo = detectProjectType(workDir, appPort);
                    await this.processManager.startApp(repoName, workDir, context.env, rollbackProjectInfo.startScript);
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
