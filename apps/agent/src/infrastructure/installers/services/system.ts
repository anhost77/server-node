/**
 * @file apps/agent/src/infrastructure/installers/services/system.ts
 * @description Installation et configuration des services système.
 * Ce fichier contient les fonctions pour configurer SSH, Cron, NFS et BIND9.
 *
 * Note : SSH et Cron sont des services protégés qui ne peuvent pas être supprimés.
 *
 * @fonctions_principales
 * - configureSsh() : Configure le service SSH
 * - configureCron() : Configure le service Cron
 * - installNfs() : Installe le serveur NFS
 * - installBind9() : Installe le serveur DNS BIND9
 */

import type { LogFn } from '../../types.js';
import { runCommand, runCommandSilent, getCommandVersion, isRunningInContainer, sleep } from '../../helpers.js';
import { writeConfig } from '../../template-manager.js';

/**
 * **configureSsh()** - Configure le service SSH
 *
 * SSH est généralement préinstallé, cette méthode s'assure qu'il est actif et sécurisé.
 * C'est un service protégé qui ne peut pas être supprimé.
 */
export async function configureSsh(onLog: LogFn): Promise<string> {
    onLog(`🔧 Configuring SSH...\n`, 'stdout');

    // S'assurer que openssh-server est installé
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'openssh-server'], onLog);

    // Activer et démarrer le service
    await runCommand('systemctl', ['enable', 'ssh'], onLog);
    await runCommand('systemctl', ['start', 'ssh'], onLog);

    onLog(`✅ SSH configured and running\n`, 'stdout');
    onLog(`📖 Config file: /etc/ssh/sshd_config\n`, 'stdout');
    onLog(`⚠️ Recommended: disable root login, use key-based auth\n`, 'stdout');
    return 'installed';
}

/**
 * **configureCron()** - Configure le service Cron
 *
 * Cron est généralement préinstallé, cette méthode s'assure qu'il est actif.
 * C'est un service protégé qui ne peut pas être supprimé.
 */
export async function configureCron(onLog: LogFn): Promise<string> {
    onLog(`🔧 Configuring Cron...\n`, 'stdout');

    // S'assurer que cron est installé
    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'cron'], onLog);

    // Activer et démarrer le service
    await runCommand('systemctl', ['enable', 'cron'], onLog);
    await runCommand('systemctl', ['start', 'cron'], onLog);

    onLog(`✅ Cron configured and running\n`, 'stdout');
    onLog(`📖 User crontab: crontab -e\n`, 'stdout');
    onLog(`📖 System crontab: /etc/crontab, /etc/cron.d/\n`, 'stdout');
    return 'installed';
}

/**
 * **installNfs()** - Installe le serveur NFS
 *
 * NFS permet de partager des répertoires sur le réseau local.
 * Note : NFS ne fonctionne pas dans les conteneurs LXC/Docker non privilégiés.
 */
export async function installNfs(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing NFS Server...\n`, 'stdout');

    // Détecter si on est dans un conteneur LXC (NFS ne fonctionne pas dans les conteneurs)
    const isContainer = await isRunningInContainer();
    if (isContainer) {
        onLog(`\n⛔ ERREUR: Ce serveur est un conteneur LXC/Docker.\n`, 'stderr');
        onLog(`\n`, 'stderr');
        onLog(`NFS Server nécessite un accès direct au kernel Linux et ne peut pas\n`, 'stderr');
        onLog(`fonctionner dans un conteneur non privilégié.\n`, 'stderr');
        onLog(`\n`, 'stderr');
        onLog(`Solutions possibles:\n`, 'stderr');
        onLog(`  1. Utiliser une VM au lieu d'un conteneur pour ce serveur\n`, 'stderr');
        onLog(`  2. Sur Proxmox, configurer le conteneur comme "privilégié":\n`, 'stderr');
        onLog(`     - Éditer /etc/pve/lxc/<ID>.conf sur l'hôte\n`, 'stderr');
        onLog(`     - Ajouter: lxc.apparmor.profile: unconfined\n`, 'stderr');
        onLog(`     - Redémarrer le conteneur\n`, 'stderr');
        onLog(`\n`, 'stderr');
        throw new Error('NFS cannot be installed in a container. Please use a VM or configure the container as privileged.');
    }

    await runCommand('apt-get', ['update'], onLog);

    // Installer d'abord rpcbind (dépendance requise pour NFS)
    onLog(`📦 Installing rpcbind (NFS dependency)...\n`, 'stdout');
    await runCommand('apt-get', ['install', '-y', 'rpcbind'], onLog);

    // Activer et démarrer rpcbind AVANT d'installer NFS
    await runCommand('systemctl', ['enable', 'rpcbind'], onLog);
    await runCommand('systemctl', ['start', 'rpcbind'], onLog);

    // Attendre que rpcbind soit prêt
    await sleep(1000);

    // Installer NFS
    onLog(`📦 Installing nfs-kernel-server...\n`, 'stdout');
    await runCommand('apt-get', ['install', '-y', 'nfs-kernel-server', 'nfs-common'], onLog);

    // Activer et démarrer le service NFS
    await runCommand('systemctl', ['enable', 'nfs-kernel-server'], onLog);
    await runCommand('systemctl', ['start', 'nfs-kernel-server'], onLog);

    onLog(`✅ NFS Server installed and running\n`, 'stdout');
    onLog(`📖 Exports config: /etc/exports\n`, 'stdout');
    onLog(`📖 Example: /shared 192.168.1.0/24(rw,sync,no_subtree_check)\n`, 'stdout');
    onLog(`📖 Apply changes: exportfs -ra\n`, 'stdout');
    return 'installed';
}

/**
 * **installBind9()** - Installe le serveur DNS BIND9
 */
export async function installBind9(onLog: LogFn): Promise<string> {
    onLog(`📥 Installing BIND9 DNS Server...\n`, 'stdout');

    await runCommand('apt-get', ['update'], onLog);
    await runCommand('apt-get', ['install', '-y', 'bind9', 'bind9utils', 'bind9-doc', 'dnsutils'], onLog);

    // Create basic configuration using template
    writeConfig('bind9/named.conf.options', '/etc/bind/named.conf.options', {});

    await runCommand('systemctl', ['enable', 'named'], onLog);
    await runCommand('systemctl', ['start', 'named'], onLog);

    onLog(`✅ BIND9 DNS installed. Add zones in /etc/bind/named.conf.local\n`, 'stdout');
    return await getCommandVersion('named', ['-v']) || 'installed';
}
