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
