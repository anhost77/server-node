/**
 * @file apps/agent/src/infrastructure/installers/services/backup.ts
 * @description Installation des outils de backup.
 * Ce fichier contient les fonctions pour installer rsync, rclone et restic.
 *
 * @fonctions_principales
 * - installRsync() : Installe rsync pour la synchronisation de fichiers
 * - installRclone() : Installe rclone pour la synchronisation cloud
 * - installRestic() : Installe restic pour les backups chiffrés
 */

import type { LogFn } from '../../types.js';
import { runCommand, runCommandSilent, getCommandVersion } from '../../helpers.js';

/**
 * **installRsync()** - Installe rsync
 */
export async function installRsync(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Rsync...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'rsync'], onLog);

    onLog(`✅ Rsync installed - use 'rsync' command for file synchronization\n`, 'stdout');
    return await getCommandVersion('rsync', ['--version']) || 'installed';
}

/**
 * **installRclone()** - Installe rclone pour la synchronisation cloud
 */
export async function installRclone(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Rclone...\n`, 'stdout');

    // Install dependencies (unzip is required by rclone install script)
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'unzip', 'curl'], onLog);

    // Use official install script for latest version
    await runCommand('curl', ['-sSLo', '/tmp/rclone-install.sh', 'https://rclone.org/install.sh'], onLog);
    await runCommand('bash', ['/tmp/rclone-install.sh'], onLog);
    await runCommandSilent('rm', ['/tmp/rclone-install.sh']);

    onLog(`✅ Rclone installed - configure with 'rclone config'\n`, 'stdout');
    onLog(`📖 Supports: AWS S3, Google Drive, Dropbox, OneDrive, BackBlaze B2, and 40+ cloud providers\n`, 'stdout');
    return await getCommandVersion('rclone', ['--version']) || 'installed';
}

/**
 * **installRestic()** - Installe restic pour les backups chiffrés
 */
export async function installRestic(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing Restic...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'restic'], onLog);

    onLog(`✅ Restic installed - initialize a repository with 'restic init'\n`, 'stdout');
    onLog(`📖 Features: encrypted backups, deduplication, supports local/S3/SFTP/REST backends\n`, 'stdout');
    return await getCommandVersion('restic', ['version']) || 'installed';
}
