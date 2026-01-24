import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface SystemMetrics {
    cpu: number;
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    disk: {
        used: number;
        total: number;
        percentage: number;
    };
    uptime: number;
}

export class SystemMonitor {
    private logCallback: (data: string, stream: 'stdout' | 'stderr' | 'system', source?: string) => void;

    constructor(onLog: (data: string, stream: 'stdout' | 'stderr' | 'system', source?: string) => void) {
        this.logCallback = onLog;
    }

    async getMetrics(): Promise<SystemMetrics> {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // Calculate CPU usage (simplified)
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

        // Get disk usage (Linux/Unix)
        let diskUsed = 0;
        let diskTotal = 0;
        try {
            const { stdout } = await execAsync('df -k / | tail -1');
            const parts = stdout.trim().split(/\s+/);
            diskTotal = parseInt(parts[1]) * 1024; // Convert KB to bytes
            diskUsed = parseInt(parts[2]) * 1024;
        } catch (e) {
            // Fallback for Windows or if df fails
            diskTotal = 100 * 1024 * 1024 * 1024; // 100GB default
            diskUsed = 50 * 1024 * 1024 * 1024; // 50GB default
        }

        return {
            cpu: Math.round(cpuUsage * 10) / 10,
            memory: {
                used: usedMem,
                total: totalMem,
                percentage: Math.round((usedMem / totalMem) * 100 * 10) / 10
            },
            disk: {
                used: diskUsed,
                total: diskTotal,
                percentage: Math.round((diskUsed / diskTotal) * 100 * 10) / 10
            },
            uptime: os.uptime()
        };
    }

    async checkNginxStatus(): Promise<{ running: boolean; message: string }> {
        try {
            const { stdout } = await execAsync('systemctl is-active nginx 2>/dev/null || service nginx status 2>/dev/null || echo "unknown"');
            const status = stdout.trim();
            const running = status === 'active' || status.includes('running');
            return {
                running,
                message: running ? 'Nginx is running' : 'Nginx is not running'
            };
        } catch (e) {
            return { running: false, message: 'Unable to check Nginx status' };
        }
    }

    async checkPM2Status(): Promise<{ running: boolean; apps: number; message: string }> {
        try {
            const { stdout } = await execAsync('pm2 jlist 2>/dev/null');
            const apps = JSON.parse(stdout);
            const runningApps = apps.filter((app: any) => app.pm2_env?.status === 'online').length;
            return {
                running: apps.length > 0,
                apps: runningApps,
                message: `PM2: ${runningApps}/${apps.length} apps running`
            };
        } catch (e) {
            return { running: false, apps: 0, message: 'PM2 not available or no apps' };
        }
    }

    formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    async performHealthCheck() {
        try {
            const metrics = await this.getMetrics();
            const nginx = await this.checkNginxStatus();
            const pm2 = await this.checkPM2Status();

            // Log system metrics
            this.logCallback(
                `[Health Check] CPU: ${metrics.cpu}% | RAM: ${this.formatBytes(metrics.memory.used)}/${this.formatBytes(metrics.memory.total)} (${metrics.memory.percentage}%) | Disk: ${metrics.disk.percentage}% | Uptime: ${this.formatUptime(metrics.uptime)}\n`,
                'system',
                'health-check'
            );

            // Log service status
            this.logCallback(`[Services] ${nginx.message} | ${pm2.message}\n`, 'system', 'services');

            // Warnings
            if (metrics.memory.percentage > 80) {
                this.logCallback(`⚠️  Warning: High memory usage (${metrics.memory.percentage}%)\n`, 'stderr', 'health-check');
            }
            if (metrics.disk.percentage > 85) {
                this.logCallback(`⚠️  Warning: Low disk space (${metrics.disk.percentage}% used)\n`, 'stderr', 'health-check');
            }
            if (!nginx.running) {
                this.logCallback(`❌ Critical: Nginx is not running\n`, 'stderr', 'services');
            }

        } catch (err: any) {
            this.logCallback(`Health check failed: ${err.message}\n`, 'stderr', 'health-check');
        }
    }

    logStartup() {
        this.logCallback(`🚀 ServerFlow Agent started\n`, 'system', 'agent');
        this.logCallback(`📍 Platform: ${os.platform()} ${os.arch()}\n`, 'system', 'agent');
        this.logCallback(`💻 Hostname: ${os.hostname()}\n`, 'system', 'agent');
        this.logCallback(`🔧 Node.js: ${process.version}\n`, 'system', 'agent');
    }

    logConnection(status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) {
        const emoji = {
            connecting: '🔄',
            connected: '✅',
            disconnected: '❌',
            error: '⚠️'
        };
        const stream = status === 'error' || status === 'disconnected' ? 'stderr' : 'system';
        this.logCallback(`${emoji[status]} ${status.toUpperCase()}: ${message || ''}\n`, stream, 'connection');
    }
}
