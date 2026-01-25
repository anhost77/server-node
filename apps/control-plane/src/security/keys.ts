import { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const KEYS_FILE = path.join(DATA_DIR, 'cp-keys.json');

interface CPKeys {
    privateKey: string;
    publicKey: string;
    createdAt: number;
}

let cachedKeys: CPKeys | null = null;

/**
 * Initialise ou charge les clés du Control Plane
 */
export function getOrGenerateCPKeys(): CPKeys {
    if (cachedKeys) return cachedKeys;

    // S'assurer que le dossier data existe
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Essayer de charger les clés existantes
    if (fs.existsSync(KEYS_FILE)) {
        try {
            cachedKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
            console.log('🔐 Control Plane keys loaded');
            return cachedKeys!;
        } catch (err) {
            console.error('Failed to load CP keys, regenerating...');
        }
    }

    // Générer nouvelles clés Ed25519
    cachedKeys = generateNewCPKeys();
    return cachedKeys;
}

/**
 * Génère de nouvelles clés CP (pour rotation)
 */
export function generateNewCPKeys(): CPKeys {
    console.log('🔐 Generating Control Plane Ed25519 keys...');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const keys: CPKeys = {
        privateKey,
        publicKey,
        createdAt: Date.now()
    };

    // Sauvegarder
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
    cachedKeys = keys;

    return keys;
}

/**
 * Signe des données avec la clé privée du CP
 */
export function signWithCPKey(data: string): string {
    const keys = getOrGenerateCPKeys();
    const signature = sign(undefined, Buffer.from(data), keys.privateKey);
    return signature.toString('base64');
}

/**
 * Retourne la clé publique du CP
 */
export function getCPPublicKey(): string {
    return getOrGenerateCPKeys().publicKey;
}

/**
 * Retourne la date de création des clés
 */
export function getCPKeyCreatedAt(): number {
    return getOrGenerateCPKeys().createdAt;
}

/**
 * Force la régénération des clés (rotation)
 */
export function rotateCPKeys(): CPKeys {
    cachedKeys = null;
    return generateNewCPKeys();
}
