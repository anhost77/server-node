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
            const displayCmd = `${cmd} ${args.join(' ')}`;
            console.log(`[RUN] ${displayCmd} in ${cwd}`);
            this.onLog(`\n$ ${displayCmd}\n`, 'stdout');

            const isWin = process.platform === 'win32';
            const exe = isWin && (cmd === 'pnpm' || cmd === 'npm') ? `${cmd}.cmd` : cmd;

            const proc = spawn(exe, args, {
                cwd,
                shell: false,
                env: {
                    ...process.env,
                    NODE_ENV: 'production'
                }
            });

            proc.stdout?.on('data', (data) => {
                this.onLog(data.toString(), 'stdout');
            });

            proc.stderr?.on('data', (data) => {
                this.onLog(data.toString(), 'stderr');
            });

            proc.on('close', (code) => {
                resolve(code);
            });

            proc.on('error', (err) => {
                this.onLog(`Process Error (${cmd}): ${err.message}\n`, 'stderr');
                resolve(1);
            });
        });
    }

    async deploy(context: DeployContext): Promise<boolean> {
        const repoName = context.repoUrl.split('/').pop()?.replace('.git', '') || 'unnamed-app';
        const workDir = path.join(APPS_DIR, repoName);

        try {
            if (!fs.existsSync(path.join(workDir, '.git'))) {
                this.onLog(`[1/3] Cloning repository ${context.repoUrl}...\n`, 'stdout');
                if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
                fs.mkdirSync(workDir, { recursive: true });

                const cloneCode = await this.runCommand('git', ['clone', context.repoUrl, '.'], workDir);
                if (cloneCode !== 0) return false;
            } else {
                this.onLog(`[1/3] Updating repository...\n`, 'stdout');
                await this.runCommand('git', ['fetch', '--all'], workDir);
            }

            this.onLog(`Checking out ${context.commitHash || context.branch}...\n`, 'stdout');
            const target = context.commitHash || context.branch;
            const checkoutCode = await this.runCommand('git', ['checkout', '-f', target], workDir);
            if (checkoutCode !== 0) return false;

            this.onLog(`[2/3] Installing dependencies...\n`, 'stdout');
            const installCode = await this.runCommand('pnpm', ['install', '--frozen-lockfile'], workDir);

            if (installCode !== 0) {
                this.onLog(`pnpm failed or missing, falling back to npm install...\n`, 'stdout');
                const npmInstallCode = await this.runCommand('npm', ['install'], workDir);
                if (npmInstallCode !== 0) return false;
            }

            this.onLog(`[3/3] Building application...\n`, 'stdout');
            const buildCode = await this.runCommand('npm', ['run', 'build'], workDir);

            this.onLog(`\n🚀 Deployment ${buildCode === 0 ? 'Successful' : 'Failed'}\n`, 'stdout');
            return buildCode === 0;

        } catch (err: any) {
            this.onLog(`Critical Deployment Error: ${err.message}\n`, 'stderr');
            return false;
        }
    }
}
