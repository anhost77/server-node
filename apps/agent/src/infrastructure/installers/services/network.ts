/**
 * @file apps/agent/src/infrastructure/installers/services/network.ts
 * @description Installation des services réseau et proxy.
 * Ce fichier contient les fonctions pour installer nginx, haproxy,
 * keepalived, certbot, ufw et wireguard.
 *
 * @fonctions_principales
 * - installNginx() : Installe le serveur web nginx
 * - installHaproxy() : Installe le load balancer HAProxy
 * - installKeepalived() : Installe keepalived pour la haute disponibilité
 * - installCertbot() : Installe certbot pour les certificats SSL
 * - installUfw() : Installe et configure le firewall UFW
 * - installWireguard() : Installe WireGuard VPN
 */

import fs from 'node:fs';
import type { LogFn } from '../../types.js';
import { runCommand, runCommandSilent, getCommandVersion } from '../../helpers.js';

/**
 * **installNginx()** - Installe nginx
 */
export async function installNginx(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'nginx'], onLog);
    await runCommand('systemctl', ['enable', 'nginx'], onLog);
    await runCommand('systemctl', ['start', 'nginx'], onLog);
    return await getCommandVersion('nginx', ['-v']) || 'installed';
}

/**
 * **installHaproxy()** - Installe HAProxy
 */
export async function installHaproxy(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'haproxy'], onLog);
    await runCommand('systemctl', ['enable', 'haproxy'], onLog);
    // Don't start haproxy yet - it needs configuration first
    onLog(`⚠️ HAProxy installed but not started - configure /etc/haproxy/haproxy.cfg first\n`, 'stdout');
    return await getCommandVersion('haproxy', ['-v']) || 'installed';
}

/**
 * **installKeepalived()** - Installe keepalived pour la haute disponibilité
 */
export async function installKeepalived(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'keepalived'], onLog);
    await runCommand('systemctl', ['enable', 'keepalived'], onLog);
    // Don't start keepalived yet - it needs configuration first
    onLog(`⚠️ Keepalived installed but not started - configure /etc/keepalived/keepalived.conf first\n`, 'stdout');
    return await getCommandVersion('keepalived', ['-v']) || 'installed';
}

/**
 * **installCertbot()** - Installe certbot pour les certificats Let's Encrypt
 */
export async function installCertbot(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'certbot', 'python3-certbot-nginx'], onLog);
    onLog(`✅ Certbot installed. Use 'certbot --nginx' to configure SSL certificates\n`, 'stdout');
    return await getCommandVersion('certbot', ['--version']) || 'installed';
}

/**
 * **installFail2ban()** - Installe et configure fail2ban
 */
export async function installFail2ban(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'fail2ban'], onLog);
    await runCommand('systemctl', ['enable', 'fail2ban'], onLog);
    await runCommand('systemctl', ['start', 'fail2ban'], onLog);

    // Create a basic local configuration
    const localConfig = `[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
`;
    fs.writeFileSync('/etc/fail2ban/jail.local', localConfig);
    await runCommand('systemctl', ['restart', 'fail2ban'], onLog);
    onLog(`✅ Fail2ban configured with SSH protection enabled\n`, 'stdout');
    return await getCommandVersion('fail2ban-client', ['--version']) || 'installed';
}

/**
 * **installUfw()** - Installe et configure le firewall UFW
 */
export async function installUfw(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'ufw'], onLog);

    // Configure basic rules
    onLog(`🔧 Configuring UFW firewall rules...\n`, 'stdout');
    await runCommand('ufw', ['default', 'deny', 'incoming'], onLog);
    await runCommand('ufw', ['default', 'allow', 'outgoing'], onLog);
    await runCommand('ufw', ['allow', 'ssh'], onLog);
    await runCommand('ufw', ['allow', 'http'], onLog);
    await runCommand('ufw', ['allow', 'https'], onLog);

    // Enable UFW (non-interactive)
    await runCommand('ufw', ['--force', 'enable'], onLog);
    onLog(`✅ UFW enabled with SSH, HTTP, HTTPS allowed\n`, 'stdout');
    return 'installed';
}

/**
 * **installWireguard()** - Installe WireGuard VPN
 */
export async function installWireguard(onLog: LogFn): Promise<string> {
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'wireguard', 'wireguard-tools'], onLog);

    // Generate server keys
    const keysDir = '/etc/wireguard';
    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true, mode: 0o700 });
    }

    onLog(`🔐 Generating WireGuard keys...\n`, 'stdout');
    await runCommand('wg', ['genkey'], onLog);
    onLog(`⚠️ WireGuard installed. Configure /etc/wireguard/wg0.conf to set up your VPN\n`, 'stdout');
    return 'installed';
}
