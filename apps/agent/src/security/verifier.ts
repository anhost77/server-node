import { verify } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.server-flow');
const CP_KEY_FILE = path.join(CONFIG_DIR, 'cp-public-key.pem');

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes
const usedNonces = new Set<string>();

// Nettoyage des nonces toutes les 10 minutes
setInterval(() => usedNonces.clear(), 10 * 60 * 1000);

export interface SignedCommand {
    type: string;
    payload: any;
    timestamp: number;
    nonce: string;
    signature: string;
}

/**
 * Types de commandes qui doivent être signées
 */
export const SIGNED_COMMAND_TYPES = [
    'DEPLOY',
    'APP_ACTION',
    'PROVISION_DOMAIN',
    'DELETE_PROXY',
    'SERVICE_ACTION',
    'GET_LOGS',
    'CP_KEY_ROTATION',
    'REGENERATE_IDENTITY'
];

/**
 * Messages de protocole (non signés)
 */
export const PROTOCOL_MESSAGE_TYPES = [
    'CHALLENGE',
    'AUTHORIZED',
    'REGISTERED',
    'ERROR',
    'SERVER_STATUS'
];

/**
 * Vérifie si la clé publique du CP est disponible
 */
export function hasCPPublicKey(): boolean {
    return fs.existsSync(CP_KEY_FILE);
}

/**
 * Vérifie une commande signée du Control Plane
 */
export function verifyCommand(cmd: SignedCommand): { valid: boolean; error?: string } {
    // 1. Vérifier le timestamp (anti-replay)
    const drift = Math.abs(Date.now() - cmd.timestamp);
    if (drift > MAX_TIMESTAMP_DRIFT_MS) {
        return { valid: false, error: 'Command timestamp too old or in future' };
    }

    // 2. Vérifier le nonce (anti-replay dans la fenêtre de temps)
    if (usedNonces.has(cmd.nonce)) {
        return { valid: false, error: 'Nonce already used (replay attack?)' };
    }

    // 3. Charger la clé publique du CP
    if (!fs.existsSync(CP_KEY_FILE)) {
        // Mode dégradé: accepter sans vérification si pas de clé
        // (pour compatibilité avec anciens agents)
        console.warn('⚠️ CP public key not found - skipping verification');
        return { valid: true };
    }
    const cpPublicKey = fs.readFileSync(CP_KEY_FILE, 'utf-8');

    // 4. Vérifier la signature
    const message = JSON.stringify({
        type: cmd.type,
        payload: cmd.payload,
        timestamp: cmd.timestamp,
        nonce: cmd.nonce
    });

    try {
        const isValid = verify(
            undefined,
            Buffer.from(message),
            cpPublicKey,
            Buffer.from(cmd.signature, 'base64')
        );

        if (!isValid) {
            return { valid: false, error: 'Invalid signature' };
        }
    } catch (err) {
        return { valid: false, error: `Signature verification failed: ${err}` };
    }

    // 5. Marquer le nonce comme utilisé
    usedNonces.add(cmd.nonce);

    return { valid: true };
}

/**
 * Sauvegarde la clé publique du CP
 */
export function saveCPPublicKey(publicKey: string): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(CP_KEY_FILE, publicKey, { mode: 0o644 });
    console.log('🔐 Control Plane public key saved');
}

/**
 * Vérifie si un message doit être signé
 */
export function requiresSignature(type: string): boolean {
    return SIGNED_COMMAND_TYPES.includes(type);
}

/**
 * Vérifie si un message est un message de protocole (non signé)
 */
export function isProtocolMessage(type: string): boolean {
    return PROTOCOL_MESSAGE_TYPES.includes(type);
}
