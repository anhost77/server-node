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

            // 4. SSL (Attempt only if certbot exists)
            this.onLog(`🔐 Checking for Certbot availability...\n`, 'stdout');
            const hasCertbot = await new Promise(r => {
                const check = spawn('which', ['certbot']);
                check.on('close', code => r(code === 0));
            });

            if (hasCertbot) {
                this.onLog(`🔐 Requesting SSL for ${context.domain}...\n`, 'stdout');
                await this.runCommand('certbot', ['--nginx', '-d', context.domain, '--non-interactive', '--agree-tos', '-m', 'admin@' + context.domain]);
            } else {
                this.onLog(`⚠️  Certbot not found. Skipping SSL provisioning. (Run install.sh to get it)\n`, 'stdout');
            }

            return true;
        } catch (err: any) {
            this.onLog(`Nginx Provisioning failed: ${err.message}\n`, 'stderr');
            return false;
        }
    }

    async start(): Promise<boolean> {
        this.onLog(`▶️ Starting Nginx...\n`, 'stdout');
        const code = await this.runCommand('systemctl', ['start', 'nginx']);
        return code === 0;
    }

    async stop(): Promise<boolean> {
        this.onLog(`⏹️ Stopping Nginx...\n`, 'stdout');
        const code = await this.runCommand('systemctl', ['stop', 'nginx']);
        return code === 0;
    }

    async restart(): Promise<boolean> {
        this.onLog(`🔄 Restarting Nginx...\n`, 'stdout');
        const code = await this.runCommand('systemctl', ['restart', 'nginx']);
        if (code === 0) {
            this.onLog(`✅ Nginx restarted successfully\n`, 'stdout');
            return true;
        } else {
            // Fallback
            const code2 = await this.runCommand('service', ['nginx', 'restart']);
            if (code2 !== 0) {
                this.onLog(`❌ Failed to restart Nginx\n`, 'stderr');
                return false;
            }
            this.onLog(`✅ Nginx restarted successfully (via service)\n`, 'stdout');
            return true;
        }
    }

    async deleteConfig(domain: string): Promise<boolean> {
        const fileName = domain.replace(/\./g, '_');
        const availablePath = `/etc/nginx/sites-available/${fileName}`;
        const enabledPath = `/etc/nginx/sites-enabled/${fileName}`;

        this.onLog(`🗑️ Removing Nginx config for ${domain}...\n`, 'stdout');
        await this.runCommand('rm', ['-f', enabledPath]);
        await this.runCommand('rm', ['-f', availablePath]);
        await this.runCommand('systemctl', ['reload', 'nginx']);
        return true;
    }
}
