# ServerFlow Security Implementation

## Overview

ServerFlow implements a Zero-Trust security model where all critical commands from the Control Plane to Agents must be cryptographically signed and verified. This ensures that even if an attacker gains network access, they cannot execute unauthorized commands on managed servers.

## Cryptographic Foundation

### Algorithm: Ed25519

ServerFlow uses **Ed25519** digital signatures, which provide:

- **128-bit security level** (equivalent to RSA-3072)
- **Small key sizes**: 32-byte public keys, 64-byte signatures
- **Fast operations**: Optimized for both signing and verification
- **Deterministic signatures**: Same input always produces same signature
- **Resistance to side-channel attacks**

### Why Ed25519?

1. **Performance**: Faster than RSA and ECDSA for signing/verification
2. **Security**: No known weaknesses, resistant to timing attacks
3. **Simplicity**: No configuration parameters to get wrong
4. **Standard**: Widely adopted (SSH, TLS 1.3, WireGuard)

## Key Management

### Control Plane Keys

**Storage Location**: `{DATA_DIR}/cp-keys.json`

```typescript
interface CPKeys {
    privateKey: string;  // PEM-encoded PKCS#8
    publicKey: string;   // PEM-encoded SPKI
    createdAt: number;   // Unix timestamp
}
```

**Key Generation**:
```typescript
const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
```

**Key Fingerprint**:
```typescript
function getKeyFingerprint(publicKeyPem: string): string {
    const hash = createHash('sha256')
        .update(publicKeyPem)
        .digest('hex')
        .slice(0, 32);
    return `SHA256:${hash}`;
}
```

### Agent Keys

**Storage Location**: `~/.server-flow/agent-key.json`

```typescript
interface AgentConfig {
    privateKey: string;  // PEM-encoded PKCS#8
    publicKey: string;   // PEM-encoded SPKI
}
```

**File Permissions**: Created with mode `0o600` (owner read/write only)

### Key Exchange Protocol

During agent registration, the Control Plane's public key is securely transmitted:

```
1. Agent sends REGISTER message with token and agent public key
2. Control Plane validates registration token
3. Control Plane responds with REGISTERED message containing:
   - serverId: Unique identifier for this agent
   - cpPublicKey: Control Plane's public key (PEM format)
4. Agent stores cpPublicKey in ~/.server-flow/cp-public-key.pem
```

## Signed Commands

### Command Types Requiring Signatures

The following command types MUST be signed by the Control Plane:

| Command | Description |
|---------|-------------|
| `DEPLOY` | Deploy an application |
| `APP_ACTION` | Start/Stop/Restart/Delete apps |
| `PROVISION_DOMAIN` | Configure Nginx reverse proxy |
| `DELETE_PROXY` | Remove Nginx configuration |
| `SERVICE_ACTION` | Control Nginx/PM2 services |
| `GET_LOGS` | Retrieve server logs |
| `CP_KEY_ROTATION` | Rotate Control Plane keys |
| `REGENERATE_IDENTITY` | Regenerate Agent identity |

### Signed Command Structure

```typescript
interface SignedCommand {
    type: string;       // Command type (e.g., 'DEPLOY')
    payload: any;       // Command-specific data
    timestamp: number;  // Unix timestamp (milliseconds)
    nonce: string;      // Random 16-character string
    signature: string;  // Base64-encoded Ed25519 signature
}
```

### Signature Creation (Control Plane)

```typescript
function createSignedCommand(type: string, payload: any): SignedCommand {
    const timestamp = Date.now();
    const nonce = randomUUID().slice(0, 16);

    // Canonical message for signing
    const message = JSON.stringify({ type, payload, timestamp, nonce });

    // Sign with CP private key
    const signature = sign(undefined, Buffer.from(message), cpPrivateKey);

    return {
        type,
        payload,
        timestamp,
        nonce,
        signature: signature.toString('base64')
    };
}
```

### Signature Verification (Agent)

```typescript
function verifyCommand(cmd: SignedCommand): { valid: boolean; error?: string } {
    // 1. Check timestamp (anti-replay, 5-minute window)
    const drift = Math.abs(Date.now() - cmd.timestamp);
    if (drift > 5 * 60 * 1000) {
        return { valid: false, error: 'Command timestamp too old or in future' };
    }

    // 2. Check nonce (prevent replay within time window)
    if (usedNonces.has(cmd.nonce)) {
        return { valid: false, error: 'Nonce already used (replay attack?)' };
    }

    // 3. Load CP public key
    const cpPublicKey = fs.readFileSync(CP_KEY_FILE, 'utf-8');

    // 4. Reconstruct and verify message
    const message = JSON.stringify({
        type: cmd.type,
        payload: cmd.payload,
        timestamp: cmd.timestamp,
        nonce: cmd.nonce
    });

    const isValid = verify(
        undefined,
        Buffer.from(message),
        cpPublicKey,
        Buffer.from(cmd.signature, 'base64')
    );

    if (!isValid) {
        return { valid: false, error: 'Invalid signature' };
    }

    // 5. Mark nonce as used
    usedNonces.add(cmd.nonce);

    return { valid: true };
}
```

## Anti-Replay Protection

### Timestamp Validation

- Commands must have timestamps within 5 minutes of current time
- Prevents attackers from replaying captured commands later
- Accounts for reasonable clock drift between systems

### Nonce Tracking

- Each command includes a unique 16-character nonce
- Agent maintains a set of recently used nonces
- Nonce set is cleared every 10 minutes
- Duplicate nonces are rejected immediately

### Why Both?

| Protection | Prevents |
|------------|----------|
| Timestamp | Long-term replay attacks |
| Nonce | Rapid-fire replay within time window |

## Protocol Messages (Unsigned)

The following message types are part of the authentication protocol and do not require signatures:

| Message | Direction | Purpose |
|---------|-----------|---------|
| `CHALLENGE` | CP -> Agent | Send authentication challenge |
| `AUTHORIZED` | CP -> Agent | Confirm session authorization |
| `REGISTERED` | CP -> Agent | Confirm registration |
| `ERROR` | CP -> Agent | Report errors |
| `SERVER_STATUS` | CP -> Agent | Status updates |

## Authentication Flow

### Challenge-Response Authentication

```
Agent                              Control Plane
  |                                      |
  |------ CONNECT { pubKey } ----------->|
  |                                      |
  |      [CP generates random nonce]     |
  |                                      |
  |<----- CHALLENGE { nonce } -----------|
  |                                      |
  |  [Agent signs nonce with private key]|
  |                                      |
  |------ RESPONSE { signature } ------->|
  |                                      |
  |    [CP verifies with agent pubKey]   |
  |                                      |
  |<----- AUTHORIZED { sessionId } ------|
```

### Registration Flow

```
Agent                              Control Plane
  |                                      |
  |------ REGISTER { token, pubKey } --->|
  |                                      |
  |  [CP validates registration token]   |
  |  [CP creates server record]          |
  |                                      |
  |<----- REGISTERED { serverId, cpPublicKey } --|
  |                                      |
  |  [Agent stores CP public key]        |
```

## Key Rotation

### Control Plane Key Rotation

```typescript
// 1. Generate new keys
const newKeys = rotateCPKeys();

// 2. Broadcast CP_KEY_ROTATION to all connected agents
const rotationCmd = createSignedCommand('CP_KEY_ROTATION', {
    newPublicKey: newKeys.publicKey
});

// Agents verify this command with OLD key, then store NEW key
```

### Agent Identity Regeneration

Used when an agent's keys may have been compromised:

```typescript
// 1. CP sends REGENERATE_IDENTITY command (signed)
const regenCmd = createSignedCommand('REGENERATE_IDENTITY', {
    registrationToken: newToken
});

// 2. Agent verifies signature
// 3. Agent generates new identity
// 4. Agent re-registers with new public key
```

## File Security

### Sensitive File Permissions

| File | Location | Permissions |
|------|----------|-------------|
| CP Keys | `{DATA_DIR}/cp-keys.json` | `0o600` |
| Agent Keys | `~/.server-flow/agent-key.json` | `0o600` |
| Registration | `~/.server-flow/registration.json` | `0o600` |
| Config Directory | `~/.server-flow/` | `0o700` |

### Directory Structure

```
~/.server-flow/
├── agent-key.json        # Agent's Ed25519 identity (0o600)
├── registration.json     # Server registration data (0o600)
├── cp-public-key.pem     # Control Plane's public key (0o644)
└── apps/                 # Deployed applications
    └── {app-name}/
```

## Dashboard Security Display

The Control Plane public key fingerprint is displayed in the admin dashboard:

```
CP Key Fingerprint: SHA256:a1b2c3d4e5f6...
Created: 2024-01-15 10:30:00 UTC
```

This allows administrators to verify the key matches across systems.

## Security Alerts

When signature verification fails, the agent sends an alert:

```typescript
{
    type: 'SECURITY_ALERT',
    reason: 'Invalid signature',
    rejectedCommand: 'DEPLOY'
}
```

These alerts are logged and can trigger notifications to administrators.

## Degraded Mode

For backward compatibility with older agents that don't have the CP public key:

```typescript
if (!fs.existsSync(CP_KEY_FILE)) {
    console.warn('CP public key not found - skipping verification');
    return { valid: true };  // Accept without verification
}
```

**Warning**: This mode should only be used during migration. Production deployments should always have the CP public key installed.

## GDPR-Compliant Log Sanitization

Logs are sanitized before storage to protect sensitive data:

```typescript
function sanitizeLogs(logs: string): string {
    return logs
        // Email addresses
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
        // IP addresses (keep first octet)
        .replace(/\b(\d{1,3})\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '$1.xxx.xxx.xxx')
        // API keys and tokens
        .replace(/(api[_-]?key|secret_key|access_token)\s*[=:]\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?/gi, '$1=[REDACTED]')
        // Passwords
        .replace(/(password|passwd|pwd)\s*[=:]\s*['"]?[^'"\s&]+['"]?/gi, '$1=[REDACTED]')
        // Credit card numbers
        .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD_REDACTED]');
}
```

## Security Best Practices

### For Operators

1. **Protect CP Keys**: Backup `cp-keys.json` securely; loss means re-registering all agents
2. **Monitor Alerts**: Set up notifications for SECURITY_ALERT events
3. **Regular Rotation**: Rotate CP keys periodically (monthly recommended)
4. **Network Security**: Use TLS for WebSocket connections in production
5. **Access Control**: Restrict Control Plane API access to authorized networks

### For Development

1. **Never Commit Keys**: Add key files to `.gitignore`
2. **Use Separate Keys**: Different keys for dev/staging/production
3. **Audit Logging**: Log all signature verification events
4. **Time Sync**: Ensure NTP is configured on all servers

## Threat Model

### Mitigated Threats

| Threat | Mitigation |
|--------|------------|
| Command injection | Signature verification |
| Replay attacks | Timestamp + nonce validation |
| Man-in-the-middle | Ed25519 signatures |
| Key theft (agent) | Agent can only verify, not sign |
| Key theft (CP) | Rotate keys, re-register agents |

### Remaining Risks

| Risk | Recommendation |
|------|----------------|
| CP key compromise | Use HSM for production |
| Insider threat | Audit logging, access control |
| DoS attacks | Rate limiting, monitoring |
