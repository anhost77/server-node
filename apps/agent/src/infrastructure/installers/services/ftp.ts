/**
 * @file apps/agent/src/infrastructure/installers/services/ftp.ts
 * @description Installation des serveurs FTP.
 * Ce fichier contient les fonctions pour installer vsftpd et ProFTPD.
 *
 * Note importante : vsftpd et ProFTPD écoutent tous les deux sur le port 21.
 * L'installation d'un serveur FTP désinstallera automatiquement l'autre.
 *
 * @fonctions_principales
 * - installVsftpd() : Installe vsftpd (Very Secure FTP Daemon)
 * - installProftpd() : Installe ProFTPD
 */

import type { LogFn } from '../../types.js';
import { runCommand, commandExists, getCommandVersion } from '../../helpers.js';

/**
 * **installVsftpd()** - Installe vsftpd
 *
 * vsftpd est un serveur FTP sécurisé, léger et facile à configurer.
 * Note: Désinstalle automatiquement ProFTPD s'il est installé (conflit port 21)
 */
export async function installVsftpd(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing vsftpd (Very Secure FTP Daemon)...\n`, 'stdout');

    // Vérifier si ProFTPD est installé et le désinstaller
    const proftpdInstalled = await commandExists('proftpd');
    if (proftpdInstalled) {
        onLog(`⚠️ ProFTPD detected - removing it first (FTP servers conflict on port 21)...\n`, 'stdout');
        try {
            await runCommand('systemctl', ['stop', 'proftpd'], onLog);
        } catch {
            // Ignore si le service n'est pas en cours
        }
        await runCommand('apt-get', ['remove', '-y', 'proftpd', 'proftpd-basic', 'proftpd-core'], onLog);
        await runCommand('apt-get', ['autoremove', '-y'], onLog);
        onLog(`✅ ProFTPD removed\n`, 'stdout');
    }

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'vsftpd'], onLog);

    const vsftpdConf = `/etc/vsftpd.conf`;
    onLog(`🔧 Applying secure configuration...\n`, 'stdout');

    // Activer et démarrer le service
    await runCommand('systemctl', ['enable', 'vsftpd'], onLog);
    await runCommand('systemctl', ['restart', 'vsftpd'], onLog);

    onLog(`✅ vsftpd installed and running\n`, 'stdout');
    onLog(`📖 Config file: ${vsftpdConf}\n`, 'stdout');
    onLog(`⚠️ Recommended: enable TLS, disable anonymous access\n`, 'stdout');
    return await getCommandVersion('vsftpd', ['-v']) || 'installed';
}

/**
 * **installProftpd()** - Installe ProFTPD
 *
 * ProFTPD est un serveur FTP modulaire avec configuration avancée style Apache.
 * Note: Désinstalle automatiquement vsftpd s'il est installé (conflit port 21)
 */
export async function installProftpd(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing ProFTPD...\n`, 'stdout');

    // Vérifier si vsftpd est installé et le désinstaller
    const vsftpdInstalled = await commandExists('vsftpd');
    if (vsftpdInstalled) {
        onLog(`⚠️ vsftpd detected - removing it first (FTP servers conflict on port 21)...\n`, 'stdout');
        try {
            await runCommand('systemctl', ['stop', 'vsftpd'], onLog);
        } catch {
            // Ignore si le service n'est pas en cours
        }
        await runCommand('apt-get', ['remove', '-y', 'vsftpd'], onLog);
        await runCommand('apt-get', ['autoremove', '-y'], onLog);
        onLog(`✅ vsftpd removed\n`, 'stdout');
    }

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'proftpd'], onLog);

    // Activer et démarrer le service
    await runCommand('systemctl', ['enable', 'proftpd'], onLog);
    await runCommand('systemctl', ['restart', 'proftpd'], onLog);

    onLog(`✅ ProFTPD installed and running\n`, 'stdout');
    onLog(`📖 Config file: /etc/proftpd/proftpd.conf\n`, 'stdout');
    onLog(`⚠️ Recommended: enable TLS with mod_tls\n`, 'stdout');
    return await getCommandVersion('proftpd', ['-v']) || 'installed';
}
