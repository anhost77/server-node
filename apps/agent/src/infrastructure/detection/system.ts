/**
 * @file apps/agent/src/infrastructure/detection/system.ts
 * @description Récupération des informations système du serveur.
 * Ce fichier collecte les informations sur l'OS, CPU, RAM, disque et uptime.
 *
 * @fonctions_principales
 * - getSystemInfo() : Récupère toutes les informations système
 */

import fs from 'node:fs';
import os from 'node:os';
import type { SystemInfo } from '../types.js';
import { runCommandSilent } from '../helpers.js';

/**
 * **getSystemInfo()** - Récupère les informations système
 *
 * Collecte les informations suivantes :
 * - Nom et version de l'OS (depuis /etc/os-release)
 * - Nombre de CPUs
 * - RAM totale
 * - Espace disque utilisé/disponible
 * - Uptime du serveur
 *
 * @returns Les informations système complètes
 */
export async function getSystemInfo(): Promise<SystemInfo> {
    // Récupérer les infos de l'OS
    let osName = 'Linux';
    let osVersion = '';
    try {
        if (fs.existsSync('/etc/os-release')) {
            const content = fs.readFileSync('/etc/os-release', 'utf-8');
            const nameMatch = content.match(/^PRETTY_NAME="(.+)"/m);
            if (nameMatch) {
                osName = nameMatch[1];
            }
            const versionMatch = content.match(/^VERSION_ID="(.+)"/m);
            if (versionMatch) {
                osVersion = versionMatch[1];
            }
        }
    } catch { }

    // Récupérer la RAM totale
    const totalMem = os.totalmem();
    const ram = `${Math.round(totalMem / (1024 * 1024 * 1024))}GB`;

    // Récupérer l'espace disque
    let disk = 'Unknown';
    try {
        const result = await runCommandSilent('df', ['-h', '/']);
        const lines = result.split('\n');
        if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 5) {
                disk = `${parts[2]} / ${parts[1]} (${parts[4]})`;
            }
        }
    } catch { }

    // Calculer l'uptime
    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${days}d ${hours}h ${minutes}m`;

    return {
        os: osName,
        osVersion,
        cpu: os.cpus().length,
        ram,
        disk,
        uptime
    };
}
