import { spawn } from 'node:child_process';
import fs from 'node:fs';

export interface NginxContext {
    domain: string;
    port: number;
    repoUrl: string;
}

export class NginxManager {
    constructor(private onLog: (data: string, stream: 'stdout' | 'stderr') => void) { }

    private async runCommand(cmd: string, args: string[]): Promise<number | null> {
        return new Promise((resolve) => {
            const isRoot = process.getuid && process.getuid() === 0;
            const command = isRoot ? cmd : 'sudo';
            const finalArgs = isRoot ? args : [cmd, ...args];

            this.onLog(`\n$ ${isRoot ? '' : 'sudo '}${cmd} ${args.join(' ')}\n`, 'stdout');

            const proc = spawn(command, finalArgs, { shell: false });

            proc.stdout?.on('data', (data) => this.onLog(data.toString(), 'stdout'));
            proc.stderr?.on('data', (data) => this.onLog(data.toString(), 'stderr'));
            proc.on('close', resolve);
            proc.on('error', (err) => {
                this.onLog(`Execution Error: ${err.message}\n`, 'stderr');
                resolve(1);
            });
        });
    }

    async provision(context: NginxContext): Promise<boolean> {
        const config = `
server {
    listen 80;
    server_name ${context.domain};

    location / {
        proxy_pass http://localhost:${context.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
        const fileName = context.domain.replace(/\./g, '_');
        const availablePath = `/etc/nginx/sites-available/${fileName}`;
        const enabledPath = `/etc/nginx/sites-enabled/${fileName}`;

        this.onLog(`🔧 Generating Nginx config for ${context.domain}...\n`, 'stdout');

        try {
            // 1. Write Config
            const isRoot = process.getuid && process.getuid() === 0;
            if (isRoot) {
                if (!fs.existsSync('/etc/nginx/sites-available')) {
                    this.onLog(`❌ Directory /etc/nginx/sites-available not found. Is Nginx installed?\n`, 'stderr');
                    return false;
                }
                fs.writeFileSync(availablePath, config);
                this.onLog(`✅ Config written to ${availablePath}\n`, 'stdout');
            } else {
                const writeCode = await new Promise<number>((resolve) => {
                    const tee = spawn('sudo', ['tee', availablePath], { shell: false });
                    tee.stdin?.write(config);
                    tee.stdin?.end();
                    tee.on('close', resolve);
                    tee.on('error', () => resolve(1));
                });
                if (writeCode !== 0) throw new Error('Permission denied');
            }

            // 2. Enable Site
            await this.runCommand('ln', ['-sf', availablePath, enabledPath]);

            // 3. Test & Reload
            const testCode = await this.runCommand('nginx', ['-t']);
            if (testCode === 0) {
                await this.runCommand('systemctl', ['reload', 'nginx']);
            } else {
                this.onLog(`⚠️ Nginx config test failed.\n`, 'stderr');
                return false;
            }

            // 4. SSL (Attempt only)
            this.onLog(`🔐 Requesting SSL for ${context.domain}...\n`, 'stdout');
            await this.runCommand('certbot', ['--nginx', '-d', context.domain, '--non-interactive', '--agree-tos', '-m', 'admin@' + context.domain]);

            return true;
        } catch (err: any) {
            this.onLog(`Nginx Provisioning failed: ${err.message}\n`, 'stderr');
            return false;
        }
    }
}
