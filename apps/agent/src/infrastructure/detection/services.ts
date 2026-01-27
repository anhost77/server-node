/**
 * @file apps/agent/src/infrastructure/detection/services.ts
 * @description Détection des services installés sur le serveur.
 * Ce fichier scanne le système pour identifier les services disponibles
 * (nginx, haproxy, fail2ban, postfix, etc.) et leur état.
 *
 * @fonctions_principales
 * - detectServices() : Détecte tous les services installés et leur état
 */

import type { ServiceInfo } from '../types.js';
import { getCommandVersion, commandExists, isServiceRunning, runCommandSilent } from '../helpers.js';

/**
 * **detectServices()** - Détecte tous les services installés
 *
 * Cette fonction vérifie la présence de nombreux services système
 * (réseau, sécurité, mail, backup, etc.) et leur état d'exécution.
 * Les vérifications sont effectuées en parallèle pour de meilleures performances.
 *
 * @returns Liste des informations sur chaque service
 */
export async function detectServices(): Promise<ServiceInfo[]> {
    const services: ServiceInfo[] = [
        // System Services (protected - cannot be removed)
        { type: 'ssh', installed: false, running: false, protected: true },
        { type: 'cron', installed: false, running: false, protected: true },
        // Network & Proxy
        { type: 'nginx', installed: false, running: false },
        { type: 'haproxy', installed: false, running: false },
        { type: 'keepalived', installed: false, running: false },
        { type: 'certbot', installed: false, running: false },
        // Security
        { type: 'fail2ban', installed: false, running: false },
        { type: 'ufw', installed: false, running: false },
        { type: 'wireguard', installed: false, running: false },
        // Monitoring
        { type: 'pm2', installed: false, running: false },
        { type: 'netdata', installed: false, running: false },
        { type: 'loki', installed: false, running: false },
        // DNS
        { type: 'bind9', installed: false, running: false },
        // Mail Stack
        { type: 'postfix', installed: false, running: false },
        { type: 'dovecot', installed: false, running: false },
        { type: 'rspamd', installed: false, running: false },
        { type: 'opendkim', installed: false, running: false },
        { type: 'clamav', installed: false, running: false },
        { type: 'spf-policyd', installed: false, running: false },
        // Backup Tools
        { type: 'rsync', installed: false, running: false },
        { type: 'rclone', installed: false, running: false },
        { type: 'restic', installed: false, running: false },
        // FTP Servers
        { type: 'vsftpd', installed: false, running: false },
        { type: 'proftpd', installed: false, running: false },
        // Storage Services
        { type: 'nfs', installed: false, running: false }
    ];

    // Exécuter toutes les vérifications de version en parallèle
    const [
        // System services
        sshdInstalled,
        cronInstalled,
        // Network & Proxy
        nginxVersion,
        haproxyVersion,
        keepalivedVersion,
        certbotVersion,
        fail2banVersion,
        ufwInstalled,
        wgInstalled,
        pm2Version,
        netdataInstalled,
        lokiInstalled,
        bind9Version,
        postfixVersion,
        dovecotVersion,
        rspamdVersion,
        opendkimInstalled,
        clamavInstalled,
        spfPolicydInstalled,
        rsyncVersion,
        rcloneVersion,
        resticVersion,
        // FTP servers
        vsftpdInstalled,
        proftpdInstalled,
        // Storage services
        nfsInstalled
    ] = await Promise.all([
        // System services
        commandExists('sshd'),
        commandExists('crontab'),
        // Network & Proxy
        getCommandVersion('nginx', ['-v']),
        getCommandVersion('haproxy', ['-v']),
        getCommandVersion('keepalived', ['-v']),
        getCommandVersion('certbot', ['--version']),
        getCommandVersion('fail2ban-client', ['--version']),
        commandExists('ufw'),
        commandExists('wg'),
        getCommandVersion('pm2', ['--version']),
        commandExists('netdata'),
        commandExists('loki'),
        getCommandVersion('named', ['-v']),
        getCommandVersion('postconf', ['mail_version']),
        getCommandVersion('dovecot', ['--version']),
        getCommandVersion('rspamd', ['--version']),
        commandExists('opendkim'),
        commandExists('clamscan'),
        commandExists('policyd-spf'),
        getCommandVersion('rsync', ['--version']),
        getCommandVersion('rclone', ['--version']),
        getCommandVersion('restic', ['version']),
        // FTP servers
        commandExists('vsftpd'),
        commandExists('proftpd'),
        // Storage services (NFS server)
        commandExists('exportfs')
    ]);

    // Collecter les services qui nécessitent une vérification de statut
    const runningChecks: Promise<{ index: number; running: boolean }>[] = [];

    // ssh (index 0) - system service, protected
    if (sshdInstalled) {
        services[0].installed = true;
        services[0].version = 'installed';
        runningChecks.push(
            Promise.any([isServiceRunning('ssh'), isServiceRunning('sshd')])
                .then(r => ({ index: 0, running: r }))
                .catch(() => ({ index: 0, running: false }))
        );
    }

    // cron (index 1) - system service, protected
    if (cronInstalled) {
        services[1].installed = true;
        services[1].version = 'installed';
        runningChecks.push(isServiceRunning('cron').then(r => ({ index: 1, running: r })));
    }

    // nginx (index 2)
    if (nginxVersion) {
        services[2].installed = true;
        services[2].version = nginxVersion;
        runningChecks.push(isServiceRunning('nginx').then(r => ({ index: 2, running: r })));
    }

    // haproxy (index 3)
    if (haproxyVersion) {
        services[3].installed = true;
        services[3].version = haproxyVersion;
        runningChecks.push(isServiceRunning('haproxy').then(r => ({ index: 3, running: r })));
    }

    // keepalived (index 4)
    if (keepalivedVersion) {
        services[4].installed = true;
        services[4].version = keepalivedVersion;
        runningChecks.push(isServiceRunning('keepalived').then(r => ({ index: 4, running: r })));
    }

    // certbot (index 5) - pas de running check, ce n'est pas un daemon
    if (certbotVersion) {
        services[5].installed = true;
        services[5].version = certbotVersion;
        services[5].running = false;
    }

    // fail2ban (index 6)
    if (fail2banVersion) {
        services[6].installed = true;
        services[6].version = fail2banVersion;
        runningChecks.push(isServiceRunning('fail2ban').then(r => ({ index: 6, running: r })));
    }

    // ufw (index 7)
    if (ufwInstalled) {
        services[7].installed = true;
        services[7].version = 'installed';
        runningChecks.push(
            runCommandSilent('ufw', ['status'])
                .then(status => ({ index: 7, running: status.includes('Status: active') }))
                .catch(() => ({ index: 7, running: false }))
        );
    }

    // wireguard (index 8)
    if (wgInstalled) {
        services[8].installed = true;
        services[8].version = 'installed';
        runningChecks.push(
            runCommandSilent('wg', ['show'])
                .then(interfaces => ({ index: 8, running: interfaces.trim().length > 0 }))
                .catch(() => ({ index: 8, running: false }))
        );
    }

    // pm2 (index 9)
    if (pm2Version) {
        services[9].installed = true;
        services[9].version = pm2Version;
        runningChecks.push(
            runCommandSilent('pm2', ['jlist'])
                .then(list => {
                    const processes = JSON.parse(list);
                    return { index: 9, running: processes.length > 0 };
                })
                .catch(() => ({ index: 9, running: false }))
        );
    }

    // netdata (index 10)
    if (netdataInstalled) {
        services[10].installed = true;
        services[10].version = 'installed';
        runningChecks.push(isServiceRunning('netdata').then(r => ({ index: 10, running: r })));
    }

    // loki (index 11)
    if (lokiInstalled) {
        services[11].installed = true;
        services[11].version = 'installed';
        runningChecks.push(isServiceRunning('loki').then(r => ({ index: 11, running: r })));
    }

    // bind9 (index 12)
    if (bind9Version) {
        services[12].installed = true;
        services[12].version = bind9Version;
        runningChecks.push(
            Promise.all([isServiceRunning('named'), isServiceRunning('bind9')])
                .then(([r1, r2]) => ({ index: 12, running: r1 || r2 }))
        );
    }

    // postfix (index 13)
    if (postfixVersion) {
        services[13].installed = true;
        services[13].version = postfixVersion.replace('mail_version = ', '').trim();
        runningChecks.push(isServiceRunning('postfix').then(r => ({ index: 13, running: r })));
    }

    // dovecot (index 14)
    if (dovecotVersion) {
        services[14].installed = true;
        services[14].version = dovecotVersion;
        runningChecks.push(isServiceRunning('dovecot').then(r => ({ index: 14, running: r })));
    }

    // rspamd (index 15)
    if (rspamdVersion) {
        services[15].installed = true;
        services[15].version = rspamdVersion;
        runningChecks.push(isServiceRunning('rspamd').then(r => ({ index: 15, running: r })));
    }

    // opendkim (index 16)
    if (opendkimInstalled) {
        services[16].installed = true;
        services[16].version = 'installed';
        runningChecks.push(isServiceRunning('opendkim').then(r => ({ index: 16, running: r })));
    }

    // clamav (index 17)
    if (clamavInstalled) {
        services[17].installed = true;
        services[17].version = 'installed';
        runningChecks.push(isServiceRunning('clamav-daemon').then(r => ({ index: 17, running: r })));
    }

    // spf-policyd (index 18)
    if (spfPolicydInstalled) {
        services[18].installed = true;
        services[18].version = 'installed';
        runningChecks.push(isServiceRunning('postfix-policyd-spf-python').then(r => ({ index: 18, running: r })));
    }

    // rsync (index 19) - pas un daemon, pas de running check
    if (rsyncVersion) {
        services[19].installed = true;
        services[19].version = rsyncVersion;
        services[19].running = false;
    }

    // rclone (index 20) - pas un daemon, pas de running check
    if (rcloneVersion) {
        services[20].installed = true;
        services[20].version = rcloneVersion;
        services[20].running = false;
    }

    // restic (index 21) - pas un daemon, pas de running check
    if (resticVersion) {
        services[21].installed = true;
        services[21].version = resticVersion;
        services[21].running = false;
    }

    // vsftpd (index 22)
    if (vsftpdInstalled) {
        services[22].installed = true;
        services[22].version = 'installed';
        runningChecks.push(isServiceRunning('vsftpd').then(r => ({ index: 22, running: r })));
    }

    // proftpd (index 23)
    if (proftpdInstalled) {
        services[23].installed = true;
        services[23].version = 'installed';
        runningChecks.push(isServiceRunning('proftpd').then(r => ({ index: 23, running: r })));
    }

    // nfs (index 24)
    if (nfsInstalled) {
        services[24].installed = true;
        services[24].version = 'installed';
        runningChecks.push(isServiceRunning('nfs-kernel-server').then(r => ({ index: 24, running: r })));
    }

    // Exécuter toutes les vérifications de statut en parallèle
    const runningResults = await Promise.all(runningChecks);
    for (const { index, running } of runningResults) {
        services[index].running = running;
    }

    return services;
}
