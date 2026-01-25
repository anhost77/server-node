# ServerFlow - Contributing Guidelines

> **MANDATORY COMPLIANCE** - All contributors (developers, PMs, designers) MUST follow these guidelines.
> Non-compliance will result in rejected PRs and potential removal from the project.

---

## Table of Contents

1. [Security Requirements](#security-requirements)
2. [GDPR Compliance](#gdpr-compliance)
3. [Code Standards](#code-standards)
4. [Review Process](#review-process)

---

## Security Requirements

### Cryptographic Standards

| Algorithm | Status | Usage |
|-----------|--------|-------|
| **Ed25519** | **REQUIRED** | All digital signatures, key pairs, agent authentication |
| **AES-256-GCM** | **REQUIRED** | Encryption at rest (secrets, tokens) |
| **Argon2id** | **REQUIRED** | Password hashing |
| RSA | **FORBIDDEN** | Do NOT use - deprecated, slower, larger keys |
| SHA-1 | **FORBIDDEN** | Do NOT use - cryptographically broken |
| MD5 | **FORBIDDEN** | Do NOT use - cryptographically broken |
| bcrypt | **DEPRECATED** | Use Argon2id instead |

### Signed Commands

All critical commands between Control Plane and Agents **MUST** be signed:

```typescript
// REQUIRED signed command types
const SIGNED_COMMANDS = [
  'DEPLOY',
  'APP_ACTION',
  'PROVISION_DOMAIN',
  'DELETE_PROXY',
  'SERVICE_ACTION'
];

// Command structure (MANDATORY)
interface SignedCommand {
  type: string;
  payload: object;      // Actual command data
  timestamp: number;    // Unix timestamp (ms)
  nonce: string;        // UUID v4 for replay protection
  signature: string;    // Ed25519 signature (base64)
}
```

### Key Management

1. **Control Plane Keys**: Stored in `data/keys/` with restricted permissions (0600)
2. **Agent Keys**: Stored in `~/.server-flow/keys/` with restricted permissions (0600)
3. **Key Rotation**: Must be supported - agents must handle key updates gracefully
4. **No Hardcoded Keys**: NEVER commit private keys or secrets to the repository

### Authentication

- Use **JWT** with Ed25519 signatures (ES256)
- Token expiration: **24 hours max** for user sessions
- API tokens: **90 days max** with rotation reminders
- Challenge-response for agent authentication

---

## GDPR Compliance

### Personal Data Handling

#### Data Classification

| Category | Examples | Retention | Encryption |
|----------|----------|-----------|------------|
| **Identifiers** | userId, email | Account lifetime + 30 days | At rest |
| **Authentication** | passwords, tokens | Active only | At rest + in transit |
| **Logs** | IP addresses, actions | 90 days max | At rest |
| **Billing** | payment info | 7 years (legal) | At rest + in transit |
| **Audit** | security events | 1 year | At rest |

#### Mandatory Requirements

1. **Data Minimization**
   - Only collect data that is strictly necessary
   - Do NOT log full request/response bodies
   - Mask sensitive data in logs (tokens, passwords, API keys)

2. **Right to Erasure (Article 17)**
   - Implement user data deletion endpoint
   - Cascade delete to all related data
   - Generate deletion confirmation certificate

3. **Right to Access (Article 15)**
   - Implement data export endpoint
   - JSON format with all user data
   - Include processing purposes

4. **Data Portability (Article 20)**
   - Export in machine-readable format
   - Standard JSON schema

5. **Consent Management**
   - Explicit opt-in for marketing
   - Clear privacy policy acceptance
   - Cookie consent for analytics

### Log Sanitization

**ALWAYS** sanitize logs before storage:

```typescript
// MANDATORY log sanitization
function sanitizeLog(data: string): string {
  return data
    // Mask GitHub tokens
    .replace(/ghp_[A-Za-z0-9]{36}/g, 'ghp_***REDACTED***')
    .replace(/gho_[A-Za-z0-9]{36}/g, 'gho_***REDACTED***')
    // Mask API keys
    .replace(/sk_[a-z]+_[A-Za-z0-9]{24,}/g, 'sk_***REDACTED***')
    // Mask Bearer tokens
    .replace(/Bearer [A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, 'Bearer ***JWT_REDACTED***')
    // Mask passwords in URLs
    .replace(/:([^:@]+)@/g, ':***@')
    // Mask email addresses (partial)
    .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@$2');
}
```

### Audit Logging

**REQUIRED** for all security-relevant actions:

```typescript
interface AuditLog {
  id: string;
  timestamp: string;      // ISO 8601
  userId: string;
  action: string;         // e.g., 'user.login', 'app.deploy'
  resource: string;       // e.g., 'app:uuid'
  outcome: 'success' | 'failure';
  ip: string;             // Anonymized after 90 days
  userAgent: string;
  details?: object;       // Additional context (sanitized)
}
```

---

## Code Standards

### TypeScript Requirements

```typescript
// REQUIRED: Strict mode in tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Validation

**ALL** external inputs MUST be validated using Zod:

```typescript
// REQUIRED: Zod schema for all API inputs
const CreateAppSchema = z.object({
  name: z.string().min(1).max(100),
  repoUrl: z.string().url(),
  branch: z.string().default('main'),
  // ...
});

// Usage
const validated = CreateAppSchema.parse(req.body);
```

### Error Handling

- Never expose stack traces to users
- Log full errors internally
- Return generic error messages externally

```typescript
// WRONG
res.status(500).send({ error: err.stack });

// CORRECT
logger.error('Database error', { error: err, userId, action });
res.status(500).send({ error: 'Internal server error', code: 'E_INTERNAL' });
```

### Secrets Management

| Type | Storage | Access |
|------|---------|--------|
| Environment variables | `.env` file (gitignored) | `process.env.VAR_NAME` |
| User secrets | Database (encrypted) | Via API only |
| API keys | Database (encrypted) | Via secure endpoint |
| Private keys | File system (0600) | Runtime only |

---

## Review Process

### Pull Request Checklist

Before submitting a PR, verify:

- [ ] **Security**: No hardcoded secrets, keys, or credentials
- [ ] **Security**: All external inputs validated with Zod
- [ ] **Security**: Signed commands use Ed25519 (not RSA)
- [ ] **GDPR**: Personal data is minimized
- [ ] **GDPR**: Logs are sanitized
- [ ] **GDPR**: Retention policies respected
- [ ] **Code**: TypeScript strict mode passes
- [ ] **Code**: No `any` types without justification
- [ ] **Tests**: New features have tests
- [ ] **Docs**: API changes documented

### Security Review

PRs touching these areas **REQUIRE** security team review:

- Authentication/Authorization
- Cryptography
- User data handling
- API endpoints
- WebSocket handlers
- Agent-CP communication

### Merge Requirements

| Branch | Approvals | Tests | Security Review |
|--------|-----------|-------|-----------------|
| `main` | 2 | Pass | Required |
| `develop` | 1 | Pass | Recommended |
| `feature/*` | 1 | Pass | If security-related |

---

## Violation Reporting

If you discover a security vulnerability or GDPR violation:

1. **DO NOT** open a public issue
2. Contact: security@serverflow.io (or project maintainer)
3. Include: Description, reproduction steps, potential impact
4. Expected response: 24-48 hours

---

## Acknowledgments

By contributing to this project, you agree to:

1. Follow all guidelines in this document
2. Respect user privacy and data protection laws
3. Prioritize security in all implementations
4. Report violations immediately

---

*Last updated: January 2026*
*Version: 1.0*
