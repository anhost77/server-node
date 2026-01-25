# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**DO NOT** open a public issue for security vulnerabilities.

### Contact

- Email: security@serverflow.io
- PGP Key: [Available on request]

### What to Include

1. **Description** of the vulnerability
2. **Steps to reproduce**
3. **Potential impact** assessment
4. **Suggested fix** (if any)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Initial response | 24-48 hours |
| Triage | 1 week |
| Fix development | 2-4 weeks |
| Public disclosure | After fix released |

---

## Security Architecture

### Cryptographic Standards

ServerFlow uses **Ed25519** for all cryptographic operations:

| Operation | Algorithm | Library |
|-----------|-----------|---------|
| Digital signatures | Ed25519 | Node.js `crypto` |
| Key exchange | Ed25519 | Node.js `crypto` |
| Password hashing | Argon2id | `argon2` |
| Encryption at rest | AES-256-GCM | Node.js `crypto` |
| JWT signing | EdDSA | `jose` |

### Forbidden Algorithms

The following are **NOT** allowed in this project:

- RSA (any key size)
- SHA-1
- MD5
- DES / 3DES
- RC4
- bcrypt (use Argon2id)

### Signed Command Protocol

All critical commands between Control Plane and Agents are cryptographically signed:

```
Control Plane                           Agent
     |                                    |
     |  1. REGISTERED (cpPublicKey)       |
     |------------------------------->|
     |                                    |
     |  2. DEPLOY (signed)                |
     |------------------------------->|
     |     {                              |
     |       type: 'DEPLOY',              |
     |       payload: {...},              |
     |       timestamp: 1234567890,       |
     |       nonce: 'uuid-v4',            |
     |       signature: 'base64...'       |
     |     }                              |
     |                                    |
     |  3. Verify signature               |
     |  4. Check timestamp (±5min)        |
     |  5. Check nonce (no replay)        |
     |  6. Execute if valid               |
     |                                    |
```

### Key Storage

| Component | Location | Permissions |
|-----------|----------|-------------|
| Control Plane private key | `data/keys/cp-private.pem` | 0600 |
| Control Plane public key | `data/keys/cp-public.pem` | 0644 |
| Agent private key | `~/.server-flow/keys/agent.json` | 0600 |
| CP public key (on agent) | `~/.server-flow/keys/cp-public.pem` | 0644 |

---

## GDPR Compliance

### Data Protection

| Data Type | Encrypted | Retention | Deletion |
|-----------|-----------|-----------|----------|
| User credentials | Yes (Argon2id) | Account lifetime | On request |
| Session tokens | Yes (JWT) | 24 hours | Automatic |
| Audit logs | Yes (AES-256) | 1 year | Automatic |
| Deployment logs | Sanitized | 90 days | Automatic |
| Billing data | Yes (AES-256) | 7 years | Legal requirement |

### User Rights

Users can exercise their GDPR rights via:

- **Access**: `GET /api/user/data-export`
- **Erasure**: `DELETE /api/user/account`
- **Portability**: `GET /api/user/data-export?format=json`
- **Rectification**: `PATCH /api/user/profile`

### Log Sanitization

All logs are sanitized to remove:

- OAuth tokens (`ghp_*`, `gho_*`)
- API keys (`sk_*`)
- JWT tokens
- Passwords in URLs
- Email addresses (partially masked)

---

## Threat Model

### Assets

1. **User data** - Personal information, credentials
2. **Application secrets** - API keys, environment variables
3. **Deployment credentials** - Git tokens, SSH keys
4. **Infrastructure** - Servers, databases, networks

### Threats & Mitigations

| Threat | Mitigation |
|--------|------------|
| Command injection | Ed25519 signed commands |
| Replay attacks | Timestamp + nonce verification |
| Man-in-the-middle | TLS 1.3 + certificate pinning |
| Credential theft | Encryption at rest + short-lived tokens |
| Unauthorized access | Role-based access control |
| Data exfiltration | Log sanitization + monitoring |

---

## Security Checklist

### For Developers

- [ ] Use Ed25519 for all signatures
- [ ] Validate ALL inputs with Zod
- [ ] Never log sensitive data
- [ ] Use parameterized queries
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Enable CORS properly

### For DevOps

- [ ] Enable TLS 1.3 only
- [ ] Configure firewall rules
- [ ] Enable audit logging
- [ ] Set up monitoring/alerting
- [ ] Regular security updates
- [ ] Backup encryption keys

### For PMs

- [ ] Include security requirements in specs
- [ ] Plan for GDPR compliance
- [ ] Budget for security reviews
- [ ] Document data flows
- [ ] Define retention policies

---

## Audit History

| Date | Auditor | Scope | Status |
|------|---------|-------|--------|
| - | - | - | Pending |

---

*Last updated: January 2026*
