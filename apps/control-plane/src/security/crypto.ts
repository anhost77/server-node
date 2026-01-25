import { verify, createHash } from 'node:crypto';

/**
 * Vérifie une signature Ed25519
 */
export function verifyEd25519(
    data: string,
    signature: string,
    publicKeyPem: string
): boolean {
    try {
        return verify(
            undefined,
            Buffer.from(data),
            publicKeyPem,
            Buffer.from(signature, 'base64')
        );
    } catch (err) {
        console.error('Ed25519 verification error:', err);
        return false;
    }
}

/**
 * Calcule le fingerprint SHA256 d'une clé publique
 */
export function getKeyFingerprint(publicKeyPem: string): string {
    const hash = createHash('sha256')
        .update(publicKeyPem)
        .digest('hex')
        .slice(0, 32);
    return `SHA256:${hash}`;
}
