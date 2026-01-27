/**
 * @file apps/agent/src/infrastructure/credentials.ts
 * @description Gestion sécurisée des credentials des bases de données.
 * Ce fichier gère le stockage et la récupération des mots de passe root
 * des bases de données de manière sécurisée (chmod 600).
 *
 * @security
 * - Les fichiers de credentials sont stockés avec permissions 600
 * - Le dossier parent a les permissions 700
 * - Les credentials ne sont JAMAIS loggés
 *
 * @fonctions_principales
 * - storeDbCredentials() : Stocke les credentials de manière sécurisée
 * - getDbCredentials() : Récupère les credentials stockés
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { DatabaseType, DatabaseCredentials } from './types.js';

// Chemin vers le dossier de credentials (sécurisé avec chmod 600)
const CREDENTIALS_DIR = path.join(os.homedir(), '.server-flow', 'credentials');

/**
 * **storeDbCredentials()** - Stocke les credentials de manière sécurisée
 *
 * Crée le dossier de credentials s'il n'existe pas, puis stocke
 * les credentials dans un fichier JSON avec les permissions appropriées.
 *
 * IMPORTANT : Ne jamais logger le contenu de ces fichiers !
 *
 * @param dbType - Type de base de données (postgresql, mysql, redis)
 * @param credentials - Les credentials à stocker
 */
export function storeDbCredentials(dbType: DatabaseType, credentials: DatabaseCredentials): void {
    if (!fs.existsSync(CREDENTIALS_DIR)) {
        fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
    }
    const filePath = path.join(CREDENTIALS_DIR, `${dbType}.json`);
    fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

/**
 * **getDbCredentials()** - Récupère les credentials stockés
 *
 * Lit le fichier de credentials pour la base de données spécifiée.
 *
 * @param dbType - Type de base de données
 * @returns Les credentials ou null si non trouvés
 */
export function getDbCredentials(dbType: DatabaseType): DatabaseCredentials | null {
    const filePath = path.join(CREDENTIALS_DIR, `${dbType}.json`);
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * **getCredentialsDir()** - Retourne le chemin du dossier de credentials
 *
 * Utile pour la documentation et les messages d'information.
 */
export function getCredentialsDir(): string {
    return CREDENTIALS_DIR;
}
