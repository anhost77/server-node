import pm2 from 'pm2';
import path from 'node:path';

export class ProcessManager {
    constructor(private onLog: (data: string, stream: 'stdout' | 'stderr') => void) { }

    private connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            pm2.connect((err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    startLogStreaming() {
        pm2.launchBus((err: any, bus: any) => {
            if (err) return;
            bus.on('log:out', (packet: any) => {
                if (packet.process.name !== 'pm2-logrotate' && packet.process.name !== 'server-flow-agent') {
                    this.onLog(`[${packet.process.name}] ${packet.data}`, 'stdout');
                }
            });
            bus.on('log:err', (packet: any) => {
                if (packet.process.name !== 'pm2-logrotate' && packet.process.name !== 'server-flow-agent') {
                    this.onLog(`[${packet.process.name}] ${packet.data}`, 'stderr');
                }
            });
        });
    }

    async startApp(name: string, cwd: string, env: Record<string, string> = {}, script = 'npm start') {
        await this.connect();
        return new Promise((resolve, reject) => {
            const [cmd, ...args] = script.split(' ');

            pm2.start({
                name,
                script: cmd,
                args: args.join(' '),
                cwd,
                env: { ...env, NODE_ENV: 'production' },
                autorestart: true,
                merge_logs: true
            }, (err: any, apps: any) => {
                if (err) {
                    this.onLog(`PM2 Start Error: ${err.message}\n`, 'stderr');
                    reject(err);
                } else {
                    this.onLog(`🚀 Application ${name} started via PM2\n`, 'stdout');
                    resolve(apps);
                }
            });
        });
    }

    async stopApp(name: string) {
        await this.connect();
        return new Promise((resolve, reject) => {
            pm2.stop(name, (err: any) => {
                if (err) {
                    this.onLog(`PM2 Stop Error: ${err.message}\n`, 'stderr');
                    reject(err);
                } else {
                    this.onLog(`🛑 Application ${name} stopped\n`, 'stdout');
                    resolve(true);
                }
            });
        });
    }

    async restartApp(name: string) {
        await this.connect();
        return new Promise((resolve, reject) => {
            pm2.restart(name, (err: any) => {
                if (err) {
                    this.onLog(`PM2 Restart Error: ${err.message}\n`, 'stderr');
                    reject(err);
                } else {
                    this.onLog(`🔄 Application ${name} restarted\n`, 'stdout');
                    resolve(true);
                }
            });
        });
    }

    async deleteApp(name: string) {
        await this.connect();
        return new Promise((resolve, reject) => {
            pm2.delete(name, (err: any) => {
                // If it doesn't exist, it's fine for delete
                resolve(true);
            });
        });
    }

    async listApps() {
        await this.connect();
        return new Promise((resolve, reject) => {
            pm2.list((err: any, list: any) => {
                if (err) reject(err);
                else resolve(list);
            });
        });
    }

    async runPm2Command(command: string): Promise<boolean> {
        await this.connect();
        return new Promise((resolve) => {
            if (command === 'restart all') {
                pm2.restart('all', (err: any) => {
                    if (err) {
                        this.onLog(`PM2 restart all error: ${err.message}\n`, 'stderr');
                        resolve(false);
                    } else {
                        this.onLog(`🔄 All PM2 processes restarted\n`, 'stdout');
                        resolve(true);
                    }
                });
            } else if (command === 'stop all') {
                pm2.stop('all', (err: any) => {
                    if (err) {
                        this.onLog(`PM2 stop all error: ${err.message}\n`, 'stderr');
                        resolve(false);
                    } else {
                        this.onLog(`🛑 All PM2 processes stopped\n`, 'stdout');
                        resolve(true);
                    }
                });
            } else if (command === 'resurrect') {
                // Resurrect requires spawning pm2 CLI
                const { spawn } = require('node:child_process');
                const proc = spawn('pm2', ['resurrect'], { shell: true });
                proc.on('close', (code: number) => {
                    if (code === 0) {
                        this.onLog(`▶️ PM2 processes resurrected\n`, 'stdout');
                        resolve(true);
                    } else {
                        this.onLog(`❌ PM2 resurrect failed\n`, 'stderr');
                        resolve(false);
                    }
                });
            } else {
                resolve(false);
            }
        });
    }
}
