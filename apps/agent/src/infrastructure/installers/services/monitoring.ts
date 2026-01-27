/**
 * @file apps/agent/src/infrastructure/installers/services/monitoring.ts
 * @description Installation des services de monitoring.
 * Ce fichier contient les fonctions pour installer PM2, Netdata et Loki.
 *
 * @fonctions_principales
 * - installPm2() : Installe le gestionnaire de processus PM2
 * - installNetdata() : Installe Netdata pour le monitoring en temps réel
 * - installLoki() : Installe Grafana Loki pour l'agrégation de logs
 */

import fs from 'node:fs';
import os from 'node:os';
import type { LogFn } from '../../types.js';
import { runCommand, runCommandSilent, commandExists, getCommandVersion } from '../../helpers.js';

/**
 * **installPm2()** - Installe le gestionnaire de processus PM2
 */
export async function installPm2(onLog: LogFn): Promise<string> {
    // Check if npm is available
    const npmExists = await commandExists('npm');
    if (!npmExists) {
        throw new Error('npm is required to install PM2. Please install Node.js first.');
    }

    await runCommand('npm', ['install', '-g', 'pm2'], onLog);

    // Setup PM2 startup script
    try {
        await runCommand('pm2', ['startup', 'systemd', '-u', os.userInfo().username, '--hp', os.homedir()], onLog);
    } catch {
        onLog(`⚠️ PM2 startup script may need manual configuration\n`, 'stderr');
    }

    return await getCommandVersion('pm2', ['--version']) || 'installed';
}

/**
 * **installNetdata()** - Installe Netdata pour le monitoring
 */
export async function installNetdata(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Netdata monitoring...\n`, 'stdout');

    // Use the official installer script
    await runCommand('curl', ['-sSLo', '/tmp/netdata-kickstart.sh', 'https://get.netdata.cloud/kickstart.sh'], onLog);
    await runCommand('bash', ['/tmp/netdata-kickstart.sh', '--dont-wait', '--disable-telemetry'], onLog);
    await runCommandSilent('rm', ['/tmp/netdata-kickstart.sh']);

    onLog(`✅ Netdata installed. Access dashboard at http://localhost:19999\n`, 'stdout');
    return 'installed';
}

/**
 * **installLoki()** - Installe Grafana Loki pour l'agrégation de logs
 */
export async function installLoki(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Grafana Loki...\n`, 'stdout');

    // Add Grafana repository
    await runCommand('apt-get', ['install', '-y', 'apt-transport-https', 'software-properties-common'], onLog);
    await runCommand('curl', ['-sSLo', '/tmp/grafana.gpg.key', 'https://apt.grafana.com/gpg.key'], onLog);
    await runCommand('gpg', ['--batch', '--yes', '--dearmor', '-o', '/usr/share/keyrings/grafana.gpg', '/tmp/grafana.gpg.key'], onLog);

    const repoLine = 'deb [signed-by=/usr/share/keyrings/grafana.gpg] https://apt.grafana.com stable main';
    fs.writeFileSync('/etc/apt/sources.list.d/grafana.list', repoLine + '\n');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'loki'], onLog);
    await runCommand('systemctl', ['enable', 'loki'], onLog);
    await runCommand('systemctl', ['start', 'loki'], onLog);

    onLog(`✅ Loki installed. Configure at /etc/loki/config.yaml\n`, 'stdout');
    return 'installed';
}
