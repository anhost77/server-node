# Security: Agent Authentication & Command Verification

**Status:** IN PROGRESS
**Epic:** Security Hardening
**Algorithme:** Ed25519 (plus rapide et plus sécurisé que RSA)

## Problem Statement

Actuellement, si un agent est compromis, un attaquant pourrait :
1. Rediriger la connexion WebSocket vers un serveur malveillant
2. L'agent ferait confiance aux commandes du faux control plane
3. Exécuter du code arbitraire sur le serveur de l'utilisateur

## Solution: Double Authentification Ed25519

### Layer 1: Agent prouve son identité au CP
L'agent signe un challenge avec sa clé privée, le CP vérifie avec la clé publique stockée.

### Layer 2: CP signe ses commandes
Toutes les commandes du control plane sont signées, l'agent vérifie avant exécution.

---

## État Actuel

### Ce qui existe déjà

**Agent (`apps/agent/src/identity.ts`):**
```typescript
// Génération de clé Ed25519 existante
const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Fonction de signature existante
export function signData(data: string, privateKeyPem: string): string {
    const signature = sign(undefined, Buffer.from(data), privateKeyPem);
    return signature.toString('base64');
}
```

**Flux actuel:**
```
Agent → CP: CONNECT { pubKey }
CP → Agent: CHALLENGE { nonce }
Agent → CP: RESPONSE { signature }
CP → Agent: AUTHORIZED  ⚠️ SANS VÉRIFICATION!
```

### Ce qui manque

1. **CP ne vérifie pas la signature** de l'agent (ligne ~1400 de index.ts)
2. **CP ne signe pas ses commandes** (DEPLOY, APP_ACTION, etc.)
3. **Agent ne vérifie pas** les commandes reçues

---

## Architecture Cible

```
REGISTRATION (première connexion):
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Agent                                   Control Plane                 │
│   ┌─────────────────┐                     ┌─────────────────┐          │
│   │                 │                     │                 │          │
│   │ 1. REGISTER     │────────────────────▶│ Stocke pubKey   │          │
│   │    {token,pubKey}                     │ dans DB         │          │
│   │                 │                     │                 │          │
│   │ 2. Reçoit       │◀────────────────────│ REGISTERED +    │          │
│   │    cpPublicKey  │                     │ cpPublicKey     │          │
│   │                 │                     │                 │          │
│   │ 3. Stocke       │                     │                 │          │
│   │    cpPublicKey  │                     │                 │          │
│   └─────────────────┘                     └─────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

CONNEXION (reconnexion):
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Agent                                   Control Plane                 │
│   ┌─────────────────┐                     ┌─────────────────┐          │
│   │                 │                     │                 │          │
│   │ 1. CONNECT      │────────────────────▶│ Cherche pubKey  │          │
│   │    {pubKey}     │                     │ dans DB         │          │
│   │                 │                     │                 │          │
│   │ 2. Reçoit       │◀────────────────────│ CHALLENGE       │          │
│   │    {nonce}      │                     │ {nonce}         │          │
│   │                 │                     │                 │          │
│   │ 3. RESPONSE     │────────────────────▶│ VÉRIFIE         │          │
│   │    {sign(nonce)}│                     │ signature!      │          │
│   │                 │                     │                 │          │
│   │ 4. AUTHORIZED   │◀────────────────────│ Si valide       │          │
│   └─────────────────┘                     └─────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

COMMANDES (runtime):
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Control Plane                           Agent                         │
│   ┌─────────────────┐                     ┌─────────────────┐          │
│   │                 │                     │                 │          │
│   │ 1. Signe cmd    │                     │                 │          │
│   │    avec privKey │                     │                 │          │
│   │                 │                     │                 │          │
│   │ 2. Envoie       │────────────────────▶│ 3. VÉRIFIE      │          │
│   │    {cmd, sig}   │                     │    signature    │          │
│   │                 │                     │                 │          │
│   │                 │                     │ 4. Exécute si   │          │
│   │                 │                     │    valide       │          │
│   └─────────────────┘                     └─────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Vérification signature Agent (CP)

**Fichier:** `apps/control-plane/src/security/crypto.ts` (NOUVEAU)

```typescript
import { verify } from 'node:crypto';

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
            undefined, // Ed25519 n'utilise pas d'algorithme de hash séparé
            Buffer.from(data),
            publicKeyPem,
            Buffer.from(signature, 'base64')
        );
    } catch {
        return false;
    }
}
```

**Modification:** `apps/control-plane/src/index.ts`

```typescript
// AVANT (ligne ~1397):
else if (msg.type === 'RESPONSE') {
    const sess = agentSessions.get(connectionId);
    if (sess) {
        sess.authorized = true; // ⚠️ Pas de vérification!
        ...
    }
}

// APRÈS:
else if (msg.type === 'RESPONSE') {
    const sess = agentSessions.get(connectionId);
    if (sess && sess.nonce) {
        // Récupérer la clé publique de l'agent depuis la DB
        const node = await db.select().from(schema.nodes)
            .where(eq(schema.nodes.pubKey, sess.pubKey)).get();

        if (!node) {
            socket.send(JSON.stringify({ type: 'ERROR', message: 'Node not found' }));
            return;
        }

        // VÉRIFIER la signature
        const isValid = verifyEd25519(sess.nonce, msg.signature, sess.pubKey);

        if (!isValid) {
            console.error(`🚨 SECURITY: Invalid signature from ${sess.nodeId}`);
            socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid signature' }));
            socket.close();
            return;
        }

        sess.authorized = true;
        console.log(`✅ Agent auth [${sess.nodeId}] - Signature verified`);
        socket.send(JSON.stringify({ type: 'AUTHORIZED', sessionId: connectionId }));
        ...
    }
}
```

---

### Phase 2: Clé Ed25519 pour le Control Plane

**Fichier:** `apps/control-plane/src/security/keys.ts` (NOUVEAU)

```typescript
import { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const KEYS_FILE = path.join(DATA_DIR, 'cp-keys.json');

interface CPKeys {
    privateKey: string;
    publicKey: string;
}

let cachedKeys: CPKeys | null = null;

/**
 * Initialise ou charge les clés du Control Plane
 */
export function getOrGenerateCPKeys(): CPKeys {
    if (cachedKeys) return cachedKeys;

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
    console.log('🔐 Generating Control Plane Ed25519 keys...');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    cachedKeys = { privateKey, publicKey };

    // Sauvegarder avec permissions restrictives
    fs.writeFileSync(KEYS_FILE, JSON.stringify(cachedKeys, null, 2), { mode: 0o600 });

    return cachedKeys;
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
 * Retourne la clé publique du CP (pour les agents)
 */
export function getCPPublicKey(): string {
    return getOrGenerateCPKeys().publicKey;
}
```

---

### Phase 3: Signer les commandes CP → Agent

**Fichier:** `apps/control-plane/src/security/commands.ts` (NOUVEAU)

```typescript
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
    const cmd = createSignedCommand(type, payload);
    socket.send(JSON.stringify(cmd));
}
```

**Usage dans index.ts:**

```typescript
import { sendSignedCommand } from './security/commands.js';

// AVANT:
session.socket.send(JSON.stringify({
    type: 'DEPLOY',
    appId: app.id,
    repoUrl: app.repoUrl,
    ...
}));

// APRÈS:
sendSignedCommand(session.socket, 'DEPLOY', {
    appId: app.id,
    repoUrl: app.repoUrl,
    ...
});
```

---

### Phase 4: Agent vérifie les commandes

**Fichier:** `apps/agent/src/security/verifier.ts` (NOUVEAU)

```typescript
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
        return { valid: false, error: 'CP public key not found - reinstall agent' };
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
 * Sauvegarde la clé publique du CP (appelé lors de l'enregistrement)
 */
export function saveCPPublicKey(publicKey: string): void {
    fs.writeFileSync(CP_KEY_FILE, publicKey, { mode: 0o644 });
    console.log('🔐 Control Plane public key saved');
}
```

**Modification de `apps/agent/src/index.ts`:**

```typescript
import { verifyCommand, saveCPPublicKey, SignedCommand } from './security/verifier.js';

// Dans le handler 'message':
ws.on('message', (data) => {
    const raw = JSON.parse(data.toString());

    // Messages de protocole (non signés)
    if (['CHALLENGE', 'AUTHORIZED', 'REGISTERED', 'ERROR'].includes(raw.type)) {
        // Traitement normal...

        // Lors de REGISTERED, sauvegarder la clé publique CP
        if (raw.type === 'REGISTERED' && raw.cpPublicKey) {
            saveCPPublicKey(raw.cpPublicKey);
        }
        return;
    }

    // Commandes opérationnelles (DOIVENT être signées)
    const cmd = raw as SignedCommand;
    const verification = verifyCommand(cmd);

    if (!verification.valid) {
        console.error(`🚨 SECURITY: Rejected command - ${verification.error}`);
        console.error(`   Type: ${cmd.type}`);
        ws.send(JSON.stringify({
            type: 'SECURITY_ALERT',
            reason: verification.error,
            rejectedCommand: cmd.type
        }));
        return; // NE PAS exécuter
    }

    console.log(`✅ Verified command: ${cmd.type}`);

    // Traiter la commande vérifiée
    if (cmd.type === 'DEPLOY') {
        // ... utiliser cmd.payload au lieu de cmd directement
    }
});
```

---

### Phase 5: Endpoint clé publique CP

```typescript
// apps/control-plane/src/index.ts
import { getCPPublicKey } from './security/keys.js';

// Endpoint public pour récupérer la clé (utilisé par install.sh)
fastify.get('/api/security/public-key', async () => {
    return {
        publicKey: getCPPublicKey(),
        algorithm: 'Ed25519'
    };
});

// Inclure dans REGISTERED
socket.send(JSON.stringify({
    type: 'REGISTERED',
    serverId: nodeId,
    cpPublicKey: getCPPublicKey()  // NOUVEAU
}));
```

---

## Messages Protocol

### Protocole (non signés)
```json
{ "type": "CONNECT", "pubKey": "..." }
{ "type": "CHALLENGE", "nonce": "abc123" }
{ "type": "RESPONSE", "signature": "base64..." }
{ "type": "AUTHORIZED", "sessionId": "..." }
{ "type": "REGISTERED", "serverId": "...", "cpPublicKey": "..." }
```

### Commandes opérationnelles (signées)
```json
{
    "type": "DEPLOY",
    "payload": {
        "appId": "abc123",
        "repoUrl": "https://github.com/...",
        "port": 3000
    },
    "timestamp": 1737820800000,
    "nonce": "a1b2c3d4e5f6g7h8",
    "signature": "BASE64_ED25519_SIGNATURE..."
}
```

---

## Security Properties

| Propriété | Protection |
|-----------|-----------|
| **Authenticité Agent** | CP vérifie signature Ed25519 du challenge |
| **Authenticité CP** | Agent vérifie signature Ed25519 des commandes |
| **Intégrité** | Signature couvre tout le payload |
| **Anti-replay** | Nonce + timestamp (fenêtre 5 min) |

---

## Fichiers à Modifier/Créer

| Fichier | Action |
|---------|--------|
| `apps/control-plane/src/security/crypto.ts` | NOUVEAU - Vérification Ed25519 |
| `apps/control-plane/src/security/keys.ts` | NOUVEAU - Clés CP |
| `apps/control-plane/src/security/commands.ts` | NOUVEAU - Signature commandes |
| `apps/control-plane/src/index.ts` | Ajouter vérification + signature |
| `apps/agent/src/security/verifier.ts` | NOUVEAU - Vérification commandes |
| `apps/agent/src/index.ts` | Intégrer vérification |
| `packages/shared/src/index.ts` | Ajouter types SignedCommand |

---

## Migration Strategy

1. **Phase A**: CP vérifie signature agent (breaking: agents non-mis-à-jour échouent)
2. **Phase B**: CP signe commandes + agent vérifie (soft mode: warn si pas signé)
3. **Phase C**: Strict mode - rejeter commandes non signées

---

## Phase 6: Gestion des Clés (UI Admin)

### Régénération Clé Control Plane

**Endpoint:** `POST /api/admin/security/rotate-cp-key`

```typescript
fastify.post('/api/admin/security/rotate-cp-key', async (req, reply) => {
    // Vérifier admin
    if (user.role !== 'admin') return reply.status(403).send({ error: 'Admin only' });

    // Générer nouvelle clé
    const newKeys = generateNewCPKeys();

    // Broadcaster la nouvelle clé publique à tous les agents connectés
    for (const [id, session] of agentSessions) {
        if (session.authorized) {
            session.socket.send(JSON.stringify({
                type: 'CP_KEY_ROTATION',
                newPublicKey: newKeys.publicKey
            }));
        }
    }

    return { success: true, message: 'Key rotated, agents notified' };
});
```

**Agent - Handler rotation:**
```typescript
if (raw.type === 'CP_KEY_ROTATION') {
    saveCPPublicKey(raw.newPublicKey);
    console.log('🔐 CP public key updated via rotation');
}
```

### Régénération Clé Agent (par serveur)

**Endpoint:** `POST /api/admin/servers/:id/rotate-key`

```typescript
fastify.post('/api/admin/servers/:id/rotate-key', async (req, reply) => {
    // L'agent doit se réenregistrer avec un nouveau token
    const token = generateRegistrationToken(server.ownerId);

    // Envoyer commande à l'agent
    sendSignedCommand(session.socket, 'REGENERATE_IDENTITY', {
        registrationToken: token
    });

    return { success: true, message: 'Agent will regenerate identity' };
});
```

### UI Dashboard Admin

```
Sécurité (Admin)
├── Clé Control Plane
│   ├── Fingerprint: SHA256:abc123...
│   ├── Créée le: 25/01/2026
│   └── [🔄 Régénérer] (avec confirmation)
│
└── Clés Agents
    ├── Serveur 1 - Fingerprint: SHA256:def456...
    │   └── [🔄 Régénérer]
    ├── Serveur 2 - Fingerprint: SHA256:ghi789...
    │   └── [🔄 Régénérer]
    └── ...
```

### Warnings UI

**Rotation CP:**
```
⚠️ Attention: Régénérer la clé du Control Plane va:
- Invalider temporairement les commandes vers les agents hors-ligne
- Les agents hors-ligne devront être mis à jour manuellement

Agents connectés: 5/7
Agents hors-ligne: 2 (server-3, server-backup)

[Annuler] [Régénérer quand même]
```

**Rotation Agent:**
```
⚠️ Régénérer la clé de "mon-serveur" va:
- Déconnecter temporairement le serveur
- Nécessiter une réauthentification

[Annuler] [Régénérer]
```

---

## Effort Estimé

| Tâche | Effort |
|-------|--------|
| Vérification signature agent (CP) | 2h |
| Clés CP + signature commandes | 2h |
| Vérification côté agent | 2h |
| UI gestion clés (admin) | 3h |
| Tests & debugging | 4h |
| **Total** | **~2 jours** |

---

*Mise à jour: Janvier 2026 - Migration RSA → Ed25519 + Key Management UI*
