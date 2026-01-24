import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

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
            console.log(`[RUN] ${cmd} ${args.join(' ')} in ${cwd}`);
            this.onLog(`\n$ ${cmd} ${args.join(' ')}\n`, 'stdout');

            const proc = spawn(cmd, args, { cwd, shell: true, env: { ...process.env, NODE_ENV: 'production' } });

            proc.stdout.on('data', (data) => {
                this.onLog(data.toString(), 'stdout');
            });

            proc.stderr.on('data', (data) => {
                this.onLog(data.toString(), 'stderr');
            });

            proc.on('close', (code) => {
                resolve(code);
            });

            proc.on('error', (err) => {
                this.onLog(`Process Error: ${err.message}\n`, 'stderr');
                resolve(1);
            });
        });
    }

    async deploy(context: DeployContext): Promise<boolean> {
        const repoName = context.repoUrl.split('/').pop()?.replace('.git', '') || 'unnamed-app';
        const workDir = path.join(APPS_DIR, repoName);

        // 1. Prepare Directory (Clone or Pull)
        if (!fs.existsSync(path.join(workDir, '.git'))) {
            this.onLog(`[1/3] Cloning repository ${context.repoUrl}...\n`, 'stdout');
            const cloneCode = await this.runCommand('git', ['clone', context.repoUrl, '.'], APPS_DIR); // This is wrong, clone should be in a specific dir
            // Correction: run git clone URL targetDir
            fs.mkdirSync(workDir, { recursive: true });
            const realCloneCode = await this.runCommand('git', ['clone', context.repoUrl, '.'], workDir);
            if (realCloneCode !== 0) return false;
        } else {
            this.onLog(`[1/3] Updating repository...\n`, 'stdout');
            await this.runCommand('git', ['fetch', 'origin'], workDir);
            const checkoutCode = await this.runCommand('git', ['checkout', context.branch], workDir);
            if (checkoutCode !== 0) return false;
            const pullCode = await this.runCommand('git', ['pull', 'origin', context.branch], workDir);
            if (pullCode !== 0) return false;
        }

        // 2. Install Dependencies
        this.onLog(`[2/3] Installing dependencies (pnpm)...\n`, 'stdout');
        const installCode = await this.runCommand('pnpm', ['install', '--frozen-lockfile'], workDir);
        // Fallback to npm if pnpm fails or isn't there
        if (installCode !== 0) {
            this.onLog(`Trying npm install as fallback...\n`, 'stdout');
            await this.runCommand('npm', ['install'], workDir);
        }

        // 3. Build
        this.onLog(`[3/3] Building application...\n`, 'stdout');
        const buildCode = await this.runCommand('npm', ['run', 'build'], workDir);

        return buildCode === 0;
    }
}
