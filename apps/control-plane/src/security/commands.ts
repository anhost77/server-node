import { signWithCPKey } from './keys.js';
import { randomUUID } from 'node:crypto';

export interface SignedCommand {
    type: string;
    payload: any;
    timestamp: number;
    nonce: string;
    signature: string;
}

/**
 * Crée une commande signée
 */
export function createSignedCommand(type: string, payload: any): SignedCommand {
    const timestamp = Date.now();
    const nonce = randomUUID().slice(0, 16);

    // Message canonique pour signature
    const message = JSON.stringify({ type, payload, timestamp, nonce });
    const signature = signWithCPKey(message);

    return { type, payload, timestamp, nonce, signature };
}

/**
 * Helper pour envoyer une commande signée via WebSocket
 */
export function sendSignedCommand(socket: any, type: string, payload: any): void {
    if (socket.readyState === 1) { // WebSocket.OPEN
        const cmd = createSignedCommand(type, payload);
        socket.send(JSON.stringify(cmd));
    }
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
