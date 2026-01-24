import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface NginxContext {
    domain: string;
    port: number;
    repoUrl: string;
}

export class NginxManager {
    constructor(private onLog: (data: string, stream: 'stdout' | 'stderr') => void) { }

    private async runCommand(cmd: string, args: string[]): Promise<number | null> {
        return new Promise((resolve) => {
            this.onLog(`\n$ sudo ${cmd} ${args.join(' ')}\n`, 'stdout');

            // In a real scenario, this runs with sudo
            const proc = spawn('sudo', [cmd, ...args], { shell: false });

            proc.stdout?.on('data', (data) => this.onLog(data.toString(), 'stdout'));
            proc.stderr?.on('data', (data) => this.onLog(data.toString(), 'stderr'));
            proc.on('close', (code) => resolve(code));
            proc.on('error', (err) => {
                this.onLog(`Nginx Manager Error: ${err.message}\n`, 'stderr');
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

        // Note: Writing files with sudo in Node.js typically requires piping to 'tee'
        try {
            // 1. Write Config
            const writeCode = await new Promise<number>((resolve) => {
                const tee = spawn('sudo', ['tee', availablePath], { shell: false });
                tee.stdin?.write(config);
                tee.stdin?.end();
                tee.on('close', resolve);
            });

            if (writeCode !== 0) {
                this.onLog(`❌ Failed to write config to ${availablePath}. Do I have sudo?\n`, 'stderr');
                // Windows/Mock Fallback
                if (process.platform === 'win32') {
                    this.onLog(`[MOCK] Writing mock config to ./nginx_${fileName}.conf\n`, 'stdout');
                    fs.writeFileSync(`./nginx_${fileName}.conf`, config);
                } else {
                    return false;
                }
            }

            // 2. Enable Site
            await this.runCommand('ln', ['-sf', availablePath, enabledPath]);

            // 3. Test & Reload
            const testCode = await this.runCommand('nginx', ['-t']);
            if (testCode === 0) {
                await this.runCommand('systemctl', ['reload', 'nginx']);
            } else {
                this.onLog(`⚠️ Nginx config test failed. Rolling back symbolic link.\n`, 'stderr');
                await this.runCommand('rm', [enabledPath]);
                return false;
            }

            // 4. SSL (Certbot)
            this.onLog(`🔐 Requesting SSL via Certbot for ${context.domain}...\n`, 'stdout');
            const sslCode = await this.runCommand('certbot', ['--nginx', '-d', context.domain, '--non-interactive', '--agree-tos', '-m', 'admin@' + context.domain]);

            return sslCode === 0;

        } catch (err: any) {
            this.onLog(`Nginx Provisioning failed: ${err.message}\n`, 'stderr');
            return false;
        }
    }
}
