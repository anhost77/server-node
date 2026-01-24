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
    private controlPlaneUrl: string;

    constructor(
        onLog: (data: string, stream: 'stdout' | 'stderr' | 'system', source?: string) => void,
        controlPlaneUrl: string = 'http://localhost:3000'
    ) {
        this.logCallback = onLog;
        this.controlPlaneUrl = controlPlaneUrl;
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

    getServerIP(): string {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name] || []) {
                // Skip internal/loopback and IPv6
                if (!iface.internal && iface.family === 'IPv4') {
                    return iface.address;
                }
            }
        }
        return 'unknown';
    }

    async getKernelVersion(): Promise<string> {
        try {
            const { stdout } = await execAsync('uname -r 2>/dev/null');
            return stdout.trim();
        } catch (e) {
            return os.release(); // Fallback to Node.js os.release()
        }
    }

    async getSoftwareVersions(): Promise<{ nginx?: string; pm2?: string; node: string }> {
        const versions: { nginx?: string; pm2?: string; node: string } = {
            node: process.version
        };

        try {
            const { stdout: nginxV } = await execAsync('nginx -v 2>&1');
            const match = nginxV.match(/nginx\/([\d.]+)/);
            if (match) versions.nginx = match[1];
        } catch (e) { /* nginx not installed */ }

        try {
            const { stdout: pm2V } = await execAsync('pm2 -v 2>/dev/null');
            versions.pm2 = pm2V.trim();
        } catch (e) { /* pm2 not installed */ }

        return versions;
    }

    async checkNetworkConnectivity(): Promise<{ internet: boolean; dns: boolean; latencyMs?: number }> {
        const result = { internet: false, dns: false, latencyMs: undefined as number | undefined };

        // Test DNS resolution
        try {
            await execAsync('host -W 2 google.com 2>/dev/null || nslookup google.com 2>/dev/null');
            result.dns = true;
        } catch (e) { /* DNS failed */ }

        // Test internet connectivity with latency
        try {
            const start = Date.now();
            await execAsync('curl -s --max-time 3 -o /dev/null https://1.1.1.1');
            result.internet = true;
            result.latencyMs = Date.now() - start;
        } catch (e) { /* No internet */ }

        return result;
    }

    async getLinuxDistro(): Promise<string> {
        try {
            // Try /etc/os-release first (most modern distros)
            const { stdout } = await execAsync('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'');
            if (stdout.trim()) return stdout.trim();
        } catch (e) { /* Not available */ }

        try {
            // Fallback to lsb_release
            const { stdout } = await execAsync('lsb_release -ds 2>/dev/null');
            if (stdout.trim()) return stdout.trim();
        } catch (e) { /* Not available */ }

        return `${os.type()} ${os.release()}`;
    }

    async checkPendingUpdates(): Promise<{ available: number; security: number }> {
        const result = { available: 0, security: 0 };

        try {
            // For Debian/Ubuntu
            const { stdout } = await execAsync('apt list --upgradable 2>/dev/null | grep -c upgradable || echo 0');
            result.available = parseInt(stdout.trim()) || 0;

            // Security updates (Ubuntu/Debian)
            try {
                const { stdout: secStdout } = await execAsync('apt list --upgradable 2>/dev/null | grep -c security || echo 0');
                result.security = parseInt(secStdout.trim()) || 0;
            } catch (e) { /* No security info */ }
        } catch (e) {
            // For RHEL/CentOS/Fedora
            try {
                const { stdout } = await execAsync('yum check-update 2>/dev/null | grep -c "^[a-zA-Z]" || echo 0');
                result.available = parseInt(stdout.trim()) || 0;
            } catch (e) { /* Not available */ }
        }

        return result;
    }

    getLoadAverage(): { load1: number; load5: number; load15: number } {
        const [load1, load5, load15] = os.loadavg();
        return {
            load1: Math.round(load1 * 100) / 100,
            load5: Math.round(load5 * 100) / 100,
            load15: Math.round(load15 * 100) / 100
        };
    }

    async checkFailedServices(): Promise<{ failed: string[]; available: boolean }> {
        try {
            const { stdout } = await execAsync('systemctl --failed --no-legend --no-pager 2>/dev/null | awk \'{print $1}\'');
            const failed = stdout.trim().split('\n').filter(s => s.length > 0);
            return { failed, available: true };
        } catch (e) {
            return { failed: [], available: false };
        }
    }

    async checkSSLCertificates(domains: string[]): Promise<{ domain: string; daysLeft: number | null; error?: string }[]> {
        const results: { domain: string; daysLeft: number | null; error?: string }[] = [];

        for (const domain of domains) {
            try {
                const { stdout } = await execAsync(
                    `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null`
                );
                const match = stdout.match(/notAfter=(.+)/);
                if (match) {
                    const endDate = new Date(match[1]);
                    const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    results.push({ domain, daysLeft });
                } else {
                    results.push({ domain, daysLeft: null, error: 'Could not parse date' });
                }
            } catch (e) {
                results.push({ domain, daysLeft: null, error: 'SSL check failed' });
            }
        }
        return results;
    }

    async checkFirewallStatus(): Promise<{ active: boolean; tool: string | null; rules?: number }> {
        // Try UFW first (Ubuntu/Debian)
        try {
            const { stdout } = await execAsync('ufw status 2>/dev/null');
            if (stdout.includes('Status: active')) {
                const ruleCount = (stdout.match(/ALLOW|DENY|REJECT|LIMIT/g) || []).length;
                return { active: true, tool: 'ufw', rules: ruleCount };
            } else if (stdout.includes('Status: inactive')) {
                return { active: false, tool: 'ufw' };
            }
        } catch (e) { /* UFW not available */ }

        // Try firewalld (RHEL/CentOS)
        try {
            const { stdout } = await execAsync('firewall-cmd --state 2>/dev/null');
            if (stdout.trim() === 'running') {
                return { active: true, tool: 'firewalld' };
            }
        } catch (e) { /* firewalld not available */ }

        // Try iptables as last resort
        try {
            const { stdout } = await execAsync('iptables -L -n 2>/dev/null | wc -l');
            const lines = parseInt(stdout.trim()) || 0;
            if (lines > 8) { // More than default empty chains
                return { active: true, tool: 'iptables', rules: lines - 8 };
            }
            return { active: false, tool: 'iptables' };
        } catch (e) { /* iptables not available */ }

        return { active: false, tool: null };
    }

    async checkMissingTools(): Promise<string[]> {
        const tools = [
            { cmd: 'ufw --version', name: 'ufw', desc: 'Firewall management' },
            { cmd: 'fail2ban-client --version', name: 'fail2ban', desc: 'Intrusion prevention' },
            { cmd: 'certbot --version', name: 'certbot', desc: 'SSL certificate management' },
            { cmd: 'htop --version', name: 'htop', desc: 'Interactive process viewer' },
            { cmd: 'iotop --version', name: 'iotop', desc: 'I/O monitoring' },
            { cmd: 'ncdu --version', name: 'ncdu', desc: 'Disk usage analyzer' }
        ];

        const missing: string[] = [];
        for (const tool of tools) {
            try {
                await execAsync(`${tool.cmd} 2>/dev/null`);
            } catch (e) {
                missing.push(tool.name);
            }
        }
        return missing;
    }

    async getSecurityInfo(): Promise<{
        firewall: { active: boolean; tool: string | null; rules?: number };
        failedServices: { failed: string[]; available: boolean };
        loadAvg: { load1: number; load5: number; load15: number };
        missingTools: string[];
    }> {
        const [firewall, failedServices, missingTools] = await Promise.all([
            this.checkFirewallStatus(),
            this.checkFailedServices(),
            this.checkMissingTools()
        ]);

        return {
            firewall,
            failedServices,
            loadAvg: this.getLoadAverage(),
            missingTools
        };
    }

    async performHealthCheck(): Promise<{ cpu: number; ram: number; disk: number; ip?: string } | null> {
        try {
            const metrics = await this.getMetrics();
            const nginx = await this.checkNginxStatus();
            const pm2 = await this.checkPM2Status();
            const ip = this.getServerIP();

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

            // Return structured metrics for MCP
            return {
                cpu: metrics.cpu,
                ram: metrics.memory.percentage,
                disk: metrics.disk.percentage,
                ip
            };

        } catch (err: any) {
            this.logCallback(`Health check failed: ${err.message}\n`, 'stderr', 'health-check');
            return null;
        }
    }

    async logStartup() {
        const [kernel, distro, versions, network, updates, security] = await Promise.all([
            this.getKernelVersion(),
            this.getLinuxDistro(),
            this.getSoftwareVersions(),
            this.checkNetworkConnectivity(),
            this.checkPendingUpdates(),
            this.getSecurityInfo()
        ]);

        this.logCallback(`🚀 ServerFlow Agent started\n`, 'system', 'agent');
        this.logCallback(`🐧 OS: ${distro}\n`, 'system', 'agent');
        this.logCallback(`⚙️  Kernel: ${kernel}\n`, 'system', 'agent');
        this.logCallback(`💻 Hostname: ${os.hostname()}\n`, 'system', 'agent');
        this.logCallback(`🌐 IP: ${this.getServerIP()}\n`, 'system', 'agent');
        this.logCallback(`🔧 Node.js: ${versions.node}${versions.nginx ? ` | Nginx: ${versions.nginx}` : ''}${versions.pm2 ? ` | PM2: ${versions.pm2}` : ''}\n`, 'system', 'agent');
        this.logCallback(`📶 Network: ${network.internet ? `OK (${network.latencyMs}ms)` : 'OFFLINE'}${network.dns ? ' | DNS: OK' : ' | DNS: FAIL'}\n`, 'system', 'agent');
        this.logCallback(`📊 Load: ${security.loadAvg.load1} / ${security.loadAvg.load5} / ${security.loadAvg.load15}\n`, 'system', 'agent');

        // Firewall status
        if (security.firewall.tool) {
            const fwStatus = security.firewall.active
                ? `✅ ${security.firewall.tool.toUpperCase()} active${security.firewall.rules ? ` (${security.firewall.rules} rules)` : ''}`
                : `⚠️  ${security.firewall.tool.toUpperCase()} inactive`;
            this.logCallback(`🛡️  Firewall: ${fwStatus}\n`, security.firewall.active ? 'system' : 'stderr', 'security');
        } else {
            this.logCallback(`🛡️  Firewall: Not configured\n`, 'stderr', 'security');
        }

        // Failed services
        if (security.failedServices.available && security.failedServices.failed.length > 0) {
            this.logCallback(`❌ Failed services: ${security.failedServices.failed.join(', ')}\n`, 'stderr', 'services');
        }

        // Updates
        if (updates.available > 0) {
            const securityWarning = updates.security > 0 ? ` (${updates.security} security)` : '';
            this.logCallback(`📦 Updates: ${updates.available} packages available${securityWarning}\n`, updates.security > 0 ? 'stderr' : 'system', 'updates');
        }

        // Missing tools - suggest installation
        if (security.missingTools.length > 0) {
            this.logCallback(`💡 Optional tools not installed: ${security.missingTools.join(', ')}\n`, 'system', 'suggestions');
            this.logCallback(`   Run: curl -sSL ${this.controlPlaneUrl}/install.sh | bash -s -- --extras-only\n`, 'system', 'suggestions');
        }
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
