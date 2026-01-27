/**
 * @file apps/agent/src/infrastructure/detection/runtimes.ts
 * @description Détection des runtimes installés sur le serveur.
 * Ce fichier scanne le système pour identifier les runtimes disponibles
 * (Node.js, Python, Go, Docker, Rust, Ruby, PHP) et leurs versions.
 *
 * @fonctions_principales
 * - detectRuntimes() : Détecte tous les runtimes installés
 * - getLatestVersion() : Récupère la dernière version disponible
 */

import os from 'node:os';
import fs from 'node:fs';
import type { RuntimeType, RuntimeInfo } from '../types.js';
import { getCommandVersion, runCommandSilent, compareVersions } from '../helpers.js';

/**
 * Configuration des commandes de vérification par runtime
 */
const VERSION_CHECKS: Record<RuntimeType, { cmd: string; args: string[] }> = {
    nodejs: { cmd: 'node', args: ['--version'] },
    python: { cmd: 'python3', args: ['--version'] },
    php: { cmd: 'php', args: ['--version'] },
    go: { cmd: 'go', args: ['version'] },
    docker: { cmd: 'docker', args: ['--version'] },
    rust: { cmd: 'rustc', args: ['--version'] },
    ruby: { cmd: 'ruby', args: ['--version'] }
};

/**
 * Tailles estimées pour chaque runtime (avant installation)
 */
const ESTIMATED_SIZES: Record<RuntimeType, string> = {
    nodejs: 'Installed', // Node.js est toujours installé (requis par l'agent)
    python: '~200MB',
    php: '~100MB',
    go: '~500MB',
    docker: '~500MB',
    rust: '~1GB',
    ruby: '~300MB'
};

/**
 * **detectRuntimes()** - Détecte tous les runtimes installés
 *
 * Parcourt la liste des runtimes supportés et vérifie lesquels
 * sont installés, leur version actuelle, et si une mise à jour
 * est disponible.
 *
 * @returns Liste des informations sur chaque runtime
 */
export async function detectRuntimes(): Promise<RuntimeInfo[]> {
    const runtimes: RuntimeInfo[] = Object.keys(VERSION_CHECKS).map((type) => ({
        type: type as RuntimeType,
        installed: false,
        estimatedSize: ESTIMATED_SIZES[type as RuntimeType]
    }));

    // Vérifier chaque runtime
    for (const runtime of runtimes) {
        const check = VERSION_CHECKS[runtime.type];
        const version = await getCommandVersion(check.cmd, check.args);

        if (version) {
            runtime.installed = true;
            runtime.version = version;
            runtime.estimatedSize = 'Installed';

            // Vérifier les mises à jour disponibles
            const latestVersion = await getLatestVersion(runtime.type);
            if (latestVersion) {
                runtime.latestVersion = latestVersion;
                runtime.updateAvailable = compareVersions(version, latestVersion) < 0;
            }
        }
    }

    return runtimes;
}

/**
 * **getLatestVersion()** - Récupère la dernière version disponible
 *
 * @param type - Type de runtime
 * @returns La dernière version ou null
 */
export async function getLatestVersion(type: RuntimeType): Promise<string | null> {
    try {
        switch (type) {
            case 'nodejs':
                return await getLatestNodeVersion();
            case 'python':
                return await getLatestAptVersion('python3');
            case 'go':
                return await getLatestGoVersion();
            case 'docker':
                return await getLatestAptVersion('docker.io');
            case 'rust':
                return await getLatestRustVersion();
            case 'ruby':
                return await getLatestAptVersion('ruby');
            case 'php':
                return await getLatestAptVersion('php');
            default:
                return null;
        }
    } catch {
        return null;
    }
}

/**
 * Récupère la dernière version depuis apt-cache policy
 */
async function getLatestAptVersion(pkg: string): Promise<string | null> {
    try {
        const output = await runCommandSilent('apt-cache', ['policy', pkg]);
        // Parse "Candidate: X.X.X-Y" line
        const match = output.match(/Candidate:\s+(\d+\.\d+(\.\d+)?)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Récupère la dernière version Node.js LTS depuis nodejs.org
 */
async function getLatestNodeVersion(): Promise<string | null> {
    try {
        const output = await runCommandSilent('curl', ['-s', 'https://nodejs.org/dist/index.json']);
        const versions = JSON.parse(output);
        // Trouver la dernière version LTS
        const lts = versions.find((v: { lts: string | boolean }) => v.lts !== false);
        if (lts && lts.version) {
            return lts.version.replace('v', '');
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Récupère la dernière version Go depuis go.dev
 */
async function getLatestGoVersion(): Promise<string | null> {
    try {
        const output = await runCommandSilent('curl', ['-s', 'https://go.dev/VERSION?m=text']);
        // Response is like "go1.22.0"
        const match = output.match(/go(\d+\.\d+(\.\d+)?)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Récupère la dernière version Rust via rustup ou depuis le web
 */
async function getLatestRustVersion(): Promise<string | null> {
    try {
        // Try rustup check first
        const cargoPath = `${os.homedir()}/.cargo/bin/rustup`;
        if (fs.existsSync(cargoPath)) {
            const output = await runCommandSilent(cargoPath, ['check']);
            // Parse "stable - Update available : X.X.X -> Y.Y.Y" or "stable - Up to date : X.X.X"
            const updateMatch = output.match(/stable.*?(\d+\.\d+\.\d+)\s*$/m);
            if (updateMatch) return updateMatch[1];
        }
        // Fallback: fetch from Rust website
        const output = await runCommandSilent('curl', ['-s', 'https://static.rust-lang.org/dist/channel-rust-stable.toml']);
        const match = output.match(/version\s*=\s*"(\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}
