import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DiffAnalyzer } from './diff.js';

const APPS_DIR = path.join(os.homedir(), '.server-flow', 'apps');

export interface DeployContext {
    repoUrl: string;
    commitHash: string;
    branch: string;
}

export class ExecutionManager {
    constructor(private onLog: (data: string, stream: 'stdout' | 'stderr') => void) {
        if (!fs.existsSync(APPS_DIR)) {
            fs.mkdirSync(APPS_DIR, { recursive: true });
        }
    }

    private async runCommand(cmd: string, args: string[], cwd: string): Promise<number | null> {
        return new Promise((resolve) => {
            const displayCmd = `${cmd} ${args.join(' ')}`;
            this.onLog(`\n$ ${displayCmd}\n`, 'stdout');

            const isWin = process.platform === 'win32';
            const exe = isWin && (cmd === 'pnpm' || cmd === 'npm') ? `${cmd}.cmd` : cmd;

            const proc = spawn(exe, args, {
                cwd,
                shell: false,
                env: { ...process.env, NODE_ENV: 'production' }
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

    async deploy(context: DeployContext): Promise<{ success: boolean, buildSkipped: boolean }> {
        const repoName = context.repoUrl.split('/').pop()?.replace('.git', '') || 'unnamed-app';
        const workDir = path.join(APPS_DIR, repoName);
        let buildSkipped = false;

        try {
            // 1. Get Current Commit (to compare later)
            let oldHash = '';
            if (fs.existsSync(path.join(workDir, '.git'))) {
                try {
                    oldHash = execSync('git rev-parse HEAD', { cwd: workDir }).toString().trim();
                } catch (e) { }
            }

            // 2. Prepare Directory / Update code
            if (!fs.existsSync(path.join(workDir, '.git'))) {
                this.onLog(`[1/3] Cloning repository ${context.repoUrl}...\n`, 'stdout');
                if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
                fs.mkdirSync(workDir, { recursive: true });
                const cloneCode = await this.runCommand('git', ['clone', context.repoUrl, '.'], workDir);
                if (cloneCode !== 0) return { success: false, buildSkipped };
            } else {
                this.onLog(`[1/3] Fetching updates...\n`, 'stdout');
                await this.runCommand('git', ['fetch', '--all'], workDir);
            }

            // 3. Checkout target
            const target = context.commitHash || context.branch;
            await this.runCommand('git', ['checkout', '-f', target], workDir);

            // 4. Hot-Path Analysis: Did meaningful files change?
            const isNoRelevantChange = DiffAnalyzer.shouldSkipBuild(workDir, oldHash, context.commitHash);

            if (isNoRelevantChange && oldHash !== '') {
                this.onLog(`\n⚡ Hot-Path: No relevant changes detected (only docs/tests/ignored). Skipping Build.\n`, 'stdout');
                buildSkipped = true;
            } else {
                // 5. Install & Build
                this.onLog(`[2/3] Installing dependencies...\n`, 'stdout');
                const installCode = await this.runCommand('pnpm', ['install', '--frozen-lockfile'], workDir);
                if (installCode !== 0) {
                    await this.runCommand('npm', ['install'], workDir);
                }

                this.onLog(`[3/3] Building application...\n`, 'stdout');
                const buildCode = await this.runCommand('npm', ['run', 'build'], workDir);
                if (buildCode !== 0) return { success: false, buildSkipped };
            }

            this.onLog(`\n🚀 Deployment Successful\n`, 'stdout');
            return { success: true, buildSkipped };

        } catch (err: any) {
            this.onLog(`Critical Deployment Error: ${err.message}\n`, 'stderr');
            return { success: false, buildSkipped };
        }
    }
}
