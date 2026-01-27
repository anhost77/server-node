/**
 * @file apps/agent/src/infrastructure/helpers.ts
 * @description Fonctions utilitaires pour l'exécution de commandes système.
 * Ce fichier fournit des helpers pour exécuter des commandes shell de manière
 * sécurisée, vérifier l'existence de commandes, et gérer les services systemd.
 *
 * @dependencies
 * - child_process : Pour exécuter des commandes système
 * - os : Pour obtenir des informations sur l'utilisateur
 *
 * @security
 * - Les commandes sont exécutées avec DEBIAN_FRONTEND=noninteractive
 * - Les privilèges root sont gérés via su/sudo selon le contexte
 *
 * @fonctions_principales
 * - runCommand() : Exécute une commande avec logs en temps réel
 * - runCommandSilent() : Exécute une commande et retourne la sortie
 * - commandExists() : Vérifie si une commande existe
 * - isServiceRunning() : Vérifie si un service systemd est actif
 */

import { spawn } from 'node:child_process';
import os from 'node:os';
import type { LogFn } from './types.js';

// Vérifie si on tourne en tant que root
const IS_ROOT = process.getuid?.() === 0;

/**
 * **runAsUser()** - Prépare une commande pour l'exécuter en tant qu'un autre utilisateur
 *
 * Quand on doit exécuter une commande en tant que 'postgres' ou autre utilisateur :
 * - Si root : on utilise `su - user -c "command"`
 * - Sinon : on utilise `sudo -u user command`
 *
 * @param user - L'utilisateur sous lequel exécuter la commande
 * @param command - La commande à exécuter
 * @returns Un objet { cmd, args } prêt à être passé à spawn()
 */
export function runAsUser(user: string, command: string): { cmd: string; args: string[] } {
    if (IS_ROOT) {
        // Use su when running as root (no sudo needed)
        return { cmd: 'su', args: ['-', user, '-c', command] };
    } else {
        // Use sudo when running as non-root user
        return { cmd: 'sudo', args: ['-u', user, ...command.split(' ')] };
    }
}

/**
 * **getPrivilegedPrefix()** - Retourne le préfixe pour les commandes privilégiées
 *
 * - Si root : pas de préfixe nécessaire
 * - Sinon : utilise sudo
 */
export function getPrivilegedPrefix(): string[] {
    return IS_ROOT ? [] : ['sudo'];
}

/**
 * **runCommand()** - Exécute une commande avec logs en temps réel
 *
 * Cette fonction exécute une commande et envoie les logs stdout/stderr
 * en temps réel via la fonction onLog. Elle affiche aussi un prompt
 * stylé comme dans un terminal.
 *
 * @param cmd - La commande à exécuter
 * @param args - Les arguments de la commande
 * @param onLog - Fonction de callback pour les logs
 * @param stdin - Optionnel : données à envoyer sur stdin
 */
export async function runCommand(
    cmd: string,
    args: string[],
    onLog: LogFn,
    stdin?: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const user = os.userInfo().username;
        const hostname = os.hostname();
        const promptChar = user === 'root' ? '#' : '$';
        onLog(`${user}@${hostname}:~${promptChar} ${cmd} ${args.join(' ')}\n`, 'stdout');

        const proc = spawn(cmd, args, {
            env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }
        });

        if (stdin) {
            proc.stdin.write(stdin);
            proc.stdin.end();
        }

        proc.stdout.on('data', (data) => {
            onLog(data.toString(), 'stdout');
        });

        proc.stderr.on('data', (data) => {
            onLog(data.toString(), 'stderr');
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * **runCommandSilent()** - Exécute une commande sans logs
 *
 * Cette fonction exécute une commande et retourne sa sortie complète.
 * Utile pour récupérer des informations (versions, statuts, etc.)
 * sans polluer les logs.
 *
 * @param cmd - La commande à exécuter
 * @param args - Les arguments de la commande
 * @returns La sortie combinée stdout + stderr
 */
export async function runCommandSilent(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, {
            env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', () => {
            // Always resolve with output - some commands (nginx -v, keepalived -v)
            // output version to stderr and may return non-zero exit codes
            // For version detection, we don't care about exit code - just the output
            resolve(stdout || stderr);
        });

        proc.on('error', reject);
    });
}

/**
 * **getCommandVersion()** - Récupère la version d'une commande
 *
 * Exécute la commande avec les arguments donnés et extrait
 * le numéro de version du résultat (format X.Y.Z).
 *
 * @param cmd - La commande
 * @param args - Les arguments (généralement --version ou -v)
 * @returns La version extraite ou null si non trouvée
 */
export async function getCommandVersion(cmd: string, args: string[]): Promise<string | null> {
    try {
        const output = await runCommandSilent(cmd, args);
        // Extract version number from output
        const match = output.match(/(\d+\.\d+(\.\d+)?)/);
        return match ? match[1] : output.trim().split('\n')[0];
    } catch {
        return null;
    }
}

/**
 * **commandExists()** - Vérifie si une commande existe dans le PATH
 *
 * Utilise `which` pour vérifier si la commande est disponible.
 *
 * @param cmd - Le nom de la commande
 * @returns true si la commande existe
 */
export async function commandExists(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
        const proc = spawn('which', [cmd]);
        proc.on('close', (code) => {
            resolve(code === 0);
        });
        proc.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * **isServiceRunning()** - Vérifie si un service systemd est actif
 *
 * Utilise `systemctl is-active` pour vérifier l'état du service.
 *
 * @param service - Le nom du service systemd
 * @returns true si le service est actif
 */
export async function isServiceRunning(service: string): Promise<boolean> {
    return new Promise((resolve) => {
        const proc = spawn('systemctl', ['is-active', service]);
        let stdout = '';
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.on('close', () => {
            resolve(stdout.trim() === 'active');
        });
        proc.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * **sleep()** - Pause l'exécution pendant un certain temps
 *
 * @param ms - Durée en millisecondes
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * **compareVersions()** - Compare deux versions sémantiques
 *
 * Compare deux chaînes de version au format X.Y.Z.
 *
 * @param v1 - Première version
 * @param v2 - Deuxième version
 * @returns -1 si v1 < v2, 0 si égales, 1 si v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const len = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < len; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
}

/**
 * Configuration de nettoyage NUCLÉAIRE pour chaque service
 * Ce mapping définit TOUT ce qui doit être supprimé pour une réinstallation propre
 */
export const NUCLEAR_CLEANUP_CONFIG: Record<string, {
    packages: string[];
    services?: string[];
    configDirs: string[];
    dataDirs: string[];
    user?: string;
    group?: string;
    extraCleanup?: string[]; // Commandes shell supplémentaires à exécuter
}> = {
    postfix: {
        packages: ['postfix', 'postfix-policyd-spf-python', 'libsasl2-modules', 'postfix-*'],
        services: ['postfix'],
        configDirs: ['/etc/postfix', '/etc/mailname'],
        dataDirs: ['/var/spool/postfix', '/var/lib/postfix'],
        user: 'postfix',
        group: 'postfix',
        extraCleanup: ['rm -f /etc/aliases.db']
    },
    dovecot: {
        packages: ['dovecot-core', 'dovecot-imapd', 'dovecot-pop3d', 'dovecot-lmtpd', 'dovecot-sieve', 'dovecot-*'],
        services: ['dovecot'],
        configDirs: ['/etc/dovecot'],
        dataDirs: ['/var/lib/dovecot', '/var/run/dovecot', '/var/spool/mail'],
        user: 'dovecot',
        group: 'dovecot'
    },
    clamav: {
        packages: ['clamav', 'clamav-daemon', 'clamav-freshclam', 'clamav-base', 'clamdscan', 'libclamav*'],
        services: ['clamav-daemon', 'clamav-freshclam'],
        configDirs: ['/etc/clamav'],
        dataDirs: ['/var/lib/clamav', '/var/log/clamav', '/var/run/clamav'],
        user: 'clamav',
        group: 'clamav'
    },
    rspamd: {
        packages: ['rspamd'],
        services: ['rspamd'],
        configDirs: ['/etc/rspamd'],
        dataDirs: ['/var/lib/rspamd', '/var/log/rspamd'],
        user: '_rspamd',
        group: '_rspamd'
    },
    opendkim: {
        packages: ['opendkim', 'opendkim-tools'],
        services: ['opendkim'],
        configDirs: ['/etc/opendkim', '/etc/opendkim.conf'],
        dataDirs: ['/var/run/opendkim', '/var/spool/postfix/opendkim'],
        user: 'opendkim',
        group: 'opendkim'
    },
    nginx: {
        packages: ['nginx', 'nginx-common', 'nginx-full', 'nginx-light', 'nginx-extras', 'nginx-*'],
        services: ['nginx'],
        configDirs: ['/etc/nginx'],
        dataDirs: ['/var/log/nginx', '/var/cache/nginx', '/var/www']
        // www-data est un utilisateur système partagé, on ne le supprime PAS
    },
    bind9: {
        packages: ['bind9', 'bind9utils', 'bind9-doc', 'bind9-host', 'bind9-*'],
        services: ['named', 'bind9'],
        configDirs: ['/etc/bind'],
        dataDirs: ['/var/cache/bind', '/var/lib/bind', '/var/run/named'],
        user: 'bind',
        group: 'bind'
    },
    vsftpd: {
        packages: ['vsftpd', 'vsftpd-*'],
        services: ['vsftpd'],
        configDirs: ['/etc/vsftpd.conf', '/etc/vsftpd'],
        dataDirs: ['/var/run/vsftpd', '/var/ftp']
    },
    proftpd: {
        packages: ['proftpd', 'proftpd-basic', 'proftpd-core', 'proftpd-*'],
        services: ['proftpd'],
        configDirs: ['/etc/proftpd'],
        dataDirs: ['/var/run/proftpd'],
        user: 'proftpd',
        group: 'proftpd'
    },
    netdata: {
        packages: ['netdata', 'netdata-*'],
        services: ['netdata'],
        configDirs: ['/etc/netdata'],
        dataDirs: ['/var/lib/netdata', '/var/cache/netdata', '/var/log/netdata'],
        user: 'netdata',
        group: 'netdata'
    },
    haproxy: {
        packages: ['haproxy', 'haproxy-*'],
        services: ['haproxy'],
        configDirs: ['/etc/haproxy'],
        dataDirs: ['/var/lib/haproxy', '/run/haproxy']
    },
    fail2ban: {
        packages: ['fail2ban', 'fail2ban-*'],
        services: ['fail2ban'],
        configDirs: ['/etc/fail2ban'],
        dataDirs: ['/var/lib/fail2ban', '/var/run/fail2ban']
    },
    redis: {
        packages: ['redis-server', 'redis-tools', 'redis-*'],
        services: ['redis-server', 'redis'],
        configDirs: ['/etc/redis'],
        dataDirs: ['/var/lib/redis', '/var/log/redis', '/var/run/redis'],
        user: 'redis',
        group: 'redis'
    }
};

/**
 * **nuclearCleanup()** - Nettoyage NUCLÉAIRE complet d'un service
 *
 * Cette fonction effectue un nettoyage TOTAL et IRRÉVERSIBLE :
 * 1. Arrêt de TOUS les services associés
 * 2. Purge apt-get (apt-get purge --auto-remove)
 * 3. Double purge dpkg (dpkg --purge --force-all)
 * 4. Suppression des fichiers dpkg info résiduels
 * 5. Nettoyage du cache debconf
 * 6. Suppression des répertoires de config
 * 7. Suppression des répertoires de données
 * 8. Suppression de l'utilisateur/groupe système
 * 9. Nettoyage de statoverride
 * 10. Mise à jour du cache apt
 *
 * @param servicePrefix - Préfixe du service (ex: "dovecot", "postfix")
 * @param onLog - Fonction de logging
 */
export async function nuclearCleanup(
    servicePrefix: string,
    onLog: LogFn
): Promise<void> {
    const fs = await import('node:fs');
    const config = NUCLEAR_CLEANUP_CONFIG[servicePrefix];

    if (!config) {
        onLog(`⚠️ Pas de config de nettoyage pour ${servicePrefix}, nettoyage basique...\n`, 'stdout');
        return;
    }

    onLog(`🧹 Nettoyage complet de ${servicePrefix}...\n`, 'stdout');

    // 1. Arrêter TOUS les services associés
    if (config.services) {
        for (const svc of config.services) {
            try {
                await runCommandSilent('systemctl', ['stop', svc]);
                await runCommandSilent('systemctl', ['disable', svc]);
                onLog(`   ⏹️ Service ${svc} arrêté et désactivé\n`, 'stdout');
            } catch { }
        }
    }

    // 2. Purge apt-get avec auto-remove
    onLog(`   🗑️ Purge des packages...\n`, 'stdout');
    for (const pkg of config.packages) {
        try {
            // Utiliser --purge pour supprimer aussi les fichiers de config
            await runCommandSilent('apt-get', ['purge', '-y', '--auto-remove', pkg]);
        } catch { }
    }

    // 3. Double purge avec dpkg --force-all pour être SÛR
    onLog(`   💣 Double purge dpkg...\n`, 'stdout');
    for (const pkg of config.packages) {
        // Ignorer les patterns avec wildcard pour dpkg
        if (pkg.includes('*')) continue;
        try {
            await runCommandSilent('dpkg', ['--purge', '--force-all', pkg]);
        } catch { }
    }

    // 4. Supprimer TOUS les fichiers dpkg info
    const dpkgInfoDir = '/var/lib/dpkg/info';
    if (fs.existsSync(dpkgInfoDir)) {
        try {
            const files = fs.readdirSync(dpkgInfoDir);
            let deletedCount = 0;
            for (const file of files) {
                if (file.startsWith(servicePrefix)) {
                    try {
                        fs.unlinkSync(`${dpkgInfoDir}/${file}`);
                        deletedCount++;
                    } catch { }
                }
            }
            if (deletedCount > 0) {
                onLog(`   🗑️ ${deletedCount} fichiers dpkg info supprimés\n`, 'stdout');
            }
        } catch { }
    }

    // 5. Purger le cache debconf pour TOUS les packages
    onLog(`   🧹 Purge du cache debconf...\n`, 'stdout');
    for (const pkg of config.packages) {
        if (pkg.includes('*')) continue;
        try {
            await runCommandSilent('bash', ['-c', `echo PURGE | debconf-communicate ${pkg} 2>/dev/null || true`]);
        } catch { }
    }

    // 6. Supprimer TOUS les répertoires de configuration
    onLog(`   📁 Suppression des configs...\n`, 'stdout');
    for (const dir of config.configDirs) {
        try {
            if (fs.existsSync(dir)) {
                await runCommandSilent('rm', ['-rf', dir]);
                onLog(`      ✓ ${dir}\n`, 'stdout');
            }
        } catch { }
    }

    // 7. Supprimer TOUS les répertoires de données
    onLog(`   📁 Suppression des données...\n`, 'stdout');
    for (const dir of config.dataDirs) {
        try {
            if (fs.existsSync(dir)) {
                await runCommandSilent('rm', ['-rf', dir]);
                onLog(`      ✓ ${dir}\n`, 'stdout');
            }
        } catch { }
    }

    // 8. Supprimer l'utilisateur et le groupe système
    if (config.user) {
        try {
            await runCommandSilent('userdel', ['-rf', config.user]);
            onLog(`   👤 Utilisateur ${config.user} supprimé\n`, 'stdout');
        } catch { }
        // Aussi nettoyer via sed au cas où userdel échoue
        try {
            await runCommandSilent('bash', ['-c', `sed -i '/^${config.user}:/d' /etc/passwd /etc/shadow 2>/dev/null || true`]);
        } catch { }
    }
    if (config.group) {
        try {
            await runCommandSilent('groupdel', [config.group]);
            onLog(`   👥 Groupe ${config.group} supprimé\n`, 'stdout');
        } catch { }
        try {
            await runCommandSilent('bash', ['-c', `sed -i '/^${config.group}:/d' /etc/group /etc/gshadow 2>/dev/null || true`]);
        } catch { }
    }

    // 9. Nettoyer statoverride
    const statoverrideFile = '/var/lib/dpkg/statoverride';
    if (fs.existsSync(statoverrideFile)) {
        try {
            const content = fs.readFileSync(statoverrideFile, 'utf-8');
            const lines = content.split('\n');
            const cleanedLines = lines.filter(line => !line.includes(servicePrefix));
            if (lines.length !== cleanedLines.length) {
                fs.writeFileSync(statoverrideFile, cleanedLines.join('\n'));
                onLog(`   🔧 Entrées statoverride nettoyées\n`, 'stdout');
            }
        } catch { }
    }

    // 10. Exécuter les commandes de nettoyage supplémentaires
    if (config.extraCleanup) {
        for (const cmd of config.extraCleanup) {
            try {
                await runCommandSilent('bash', ['-c', cmd]);
            } catch { }
        }
    }

    // 11. Mettre à jour dpkg pour qu'il oublie les packages
    try {
        await runCommandSilent('apt-get', ['update']);
    } catch { }

    onLog(`   ✅ Nettoyage complet terminé\n`, 'stdout');
}

/**
 * **prepareServiceReinstall()** - Alias pour nuclearCleanup (compatibilité)
 *
 * @deprecated Utiliser nuclearCleanup() directement
 */
export async function prepareServiceReinstall(
    packagePrefix: string,
    _packages: string[], // Ignoré, on utilise la config centralisée
    _serviceName: string | undefined, // Ignoré, on utilise la config centralisée
    onLog: LogFn
): Promise<void> {
    await nuclearCleanup(packagePrefix, onLog);
}

/**
 * **installWithFreshConfig()** - Installe un package en forçant les nouvelles configs
 *
 * Cette fonction installe un package en utilisant --force-confnew pour s'assurer
 * que TOUS les fichiers de configuration sont recréés, même si dpkg pense
 * qu'ils ont été "supprimés volontairement".
 *
 * @param packages - Liste des packages à installer
 * @param onLog - Fonction de logging
 */
export async function installWithFreshConfig(
    packages: string[],
    onLog: LogFn
): Promise<void> {
    // Utiliser -o Dpkg::Options pour forcer la recréation des configs
    const args = [
        'install', '-y',
        '-o', 'Dpkg::Options::=--force-confnew',
        '-o', 'Dpkg::Options::=--force-confmiss',
        ...packages
    ];
    await runCommand('apt-get', args, onLog);
}

/**
 * **regenerateConfigIfMissing()** - Régénère la configuration d'un package si manquante
 *
 * Cette fonction vérifie si un fichier de configuration existe et le régénère
 * via dpkg-reconfigure si nécessaire. Utile après une purge + réinstallation.
 *
 * @param configPath - Chemin du fichier de configuration principal
 * @param packageName - Nom du package à reconfigurer
 * @param onLog - Fonction de callback pour les logs
 * @returns true si la config existe ou a été régénérée avec succès
 */
export async function regenerateConfigIfMissing(
    configPath: string,
    packageName: string,
    onLog: LogFn
): Promise<boolean> {
    const fs = await import('node:fs');

    if (fs.existsSync(configPath)) {
        return true;
    }

    onLog(`⚠️ Fichier ${configPath} manquant, régénération...\n`, 'stdout');

    try {
        await runCommand('dpkg-reconfigure', ['-f', 'noninteractive', packageName], onLog);

        if (fs.existsSync(configPath)) {
            onLog(`   ✅ Configuration régénérée\n`, 'stdout');
            return true;
        }
    } catch (err: any) {
        onLog(`   ⚠️ dpkg-reconfigure a échoué: ${err.message}\n`, 'stderr');
    }

    return false;
}

/**
 * **isRunningInContainer()** - Détecte si on tourne dans un conteneur
 *
 * Vérifie via plusieurs méthodes si on est dans un conteneur LXC ou Docker.
 * Utile car certains services (NFS) ne fonctionnent pas dans les conteneurs.
 *
 * @returns true si on est dans un conteneur
 */
export async function isRunningInContainer(): Promise<boolean> {
    const fs = await import('node:fs');

    try {
        // Méthode 1: systemd-detect-virt
        const virt = await runCommandSilent('systemd-detect-virt', ['-c']);
        if (virt.trim() && virt.trim() !== 'none') {
            return true;
        }
    } catch {
        // Pas de systemd-detect-virt, on continue avec d'autres méthodes
    }

    try {
        // Méthode 2: Vérifier /run/systemd/container
        if (fs.existsSync('/run/systemd/container')) {
            return true;
        }
    } catch { }

    try {
        // Méthode 3: Vérifier /.dockerenv
        if (fs.existsSync('/.dockerenv')) {
            return true;
        }
    } catch { }

    try {
        // Méthode 4: Vérifier cgroup pour LXC
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8');
        if (cgroup.includes('lxc') || cgroup.includes('docker')) {
            return true;
        }
    } catch { }

    return false;
}
