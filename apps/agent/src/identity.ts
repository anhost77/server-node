import { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.server-flow');
const KEY_FILE = path.join(CONFIG_DIR, 'agent-key.json');

interface AgentConfig {
    privateKey: string;
    publicKey: string;
}

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
}

export function getOrGenerateIdentity(): AgentConfig {
    ensureConfigDir();

    if (fs.existsSync(KEY_FILE)) {
        try {
            const data = fs.readFileSync(KEY_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Failed to read key file, regenerating...', err);
        }
    }

    console.log('Generating new Ed25519 Identity...');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const config: AgentConfig = { privateKey, publicKey };
    fs.writeFileSync(KEY_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    return config;
}

export function signData(data: string, privateKeyPem: string): string {
    const signature = sign(undefined, Buffer.from(data), privateKeyPem);
    return signature.toString('base64');
}

/**
 * Force regeneration of identity keys (for key rotation)
 */
export function regenerateIdentity(): AgentConfig {
    ensureConfigDir();

    console.log('🔐 Regenerating Ed25519 Identity...');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const config: AgentConfig = { privateKey, publicKey };
    fs.writeFileSync(KEY_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    return config;
}
