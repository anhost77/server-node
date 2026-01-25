# Story 6.1: Assisted SSH Installation - Implementation Summary

**Status:** COMPLETED
**Implemented:** January 2026

## Overview

The Assisted SSH Installation feature allows non-technical users to connect their servers via a guided web interface without manually copying terminal commands.

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│    Dashboard    │ ◄────────────────► │  Control Plane  │
│   (Vue + CSS)   │    /api/ssh/       │ (SSHSessionMgr) │
└─────────────────┘    session         └────────┬────────┘
                                                │ SSH (ssh2)
                                                ▼
                                       ┌─────────────────┐
                                       │  Target Server  │
                                       └─────────────────┘
```

## Implementation Files

### Backend (Control Plane)

#### `apps/control-plane/src/ssh/SSHSessionManager.ts`
Core SSH session management class:
- **SSHCredentials interface**: host, port, username, password/privateKey
- **SSHSession interface**: tracks session state (connecting, preflight, installing, complete, error)
- **INSTALL_STEPS**: 5-step progress tracking
- **PREFLIGHT_SCRIPT**: Embedded bash script for OS verification
- **Security limits**:
  - `SESSION_TIMEOUT_MS`: 10 minutes max
  - `MAX_SESSIONS_PER_USER`: 3 concurrent sessions

Key methods:
- `createSession()`: Creates SSH connection with keyboard-interactive auth support
- `runPreflightChecks()`: Verifies Debian/Ubuntu, curl, sudo/root access
- `runInstallation()`: Executes `install.sh` via curl with registration token
- `endSession()`: Cleanup and resource release

#### `apps/control-plane/src/index.ts` (SSH endpoints)

**HTTP Endpoints:**
- `POST /api/ssh/token` - Generate temporary auth token (30s expiry) for WebSocket cross-origin auth
- `POST /api/ssh/connect` - Validate credentials (deprecated, moved to WebSocket)

**WebSocket Endpoint:**
- `GET /api/ssh/session?token=xxx` - Real-time SSH session

**WebSocket Message Protocol:**
```typescript
// Client → Server
{ type: 'CONNECT', host, port, username, password?, privateKey?, verbose, autoInstall }
{ type: 'START_INSTALL' }  // Manual trigger after preflight
{ type: 'INPUT', data }    // Interactive input (unused)

// Server → Client
{ type: 'CONNECTED', sessionId }
{ type: 'STATUS', step, total, message, stepName }
{ type: 'OUTPUT', data, isStderr }
{ type: 'ERROR', code, message }
{ type: 'COMPLETE' }
```

**Rate Limiting:**
- `sshConnectionLimits`: Map tracking IP → { count, resetAt }
- Max 5 connection attempts per minute per IP

### Frontend (Dashboard)

#### `apps/dashboard/src/App.vue`

**State Management:**
```typescript
const connectTab = ref<'quick' | 'assisted'>('quick')
const sshForm = ref({
  host: '', port: 22, username: 'root',
  password: '', privateKey: '',
  authType: 'password' | 'key',
  verbose: false
})
const sshSession = ref<{
  id: string | null,
  status: 'idle' | 'connecting' | 'preflight' | 'installing' | 'complete' | 'error',
  step: number, totalSteps: number,
  message: string, output: string[]
}>
```

**Key Functions:**
- `startSSHInstallation()`: Main flow - get token, connect WebSocket, send credentials
- `resetSSHSession()`: Clear session state and close WebSocket

**UI Components:**
- Tab navigation (Quick Install / Assisted Setup)
- Credentials form with password/SSH key toggle
- Progress stepper (5 steps with icons)
- Terminal output display with auto-scroll
- Privacy notice ("Credentials never stored")
- Verbose mode toggle

## Installation Flow

1. **User enters credentials** (host, port, username, auth method)
2. **Dashboard requests SSH token** via `POST /api/ssh/token`
3. **WebSocket connection** established with token in URL
4. **CONNECT message** sent with credentials
5. **SSH connection** via ssh2 library (supports keyboard-interactive)
6. **Pre-flight checks** run on server:
   - Verify Debian/Ubuntu OS
   - Install curl if missing
   - Verify root/sudo access
7. **Installation** runs via: `curl -sSL {url}/install.sh | bash -s -- --token {token} --url {url} --extras`
8. **Progress updates** streamed to dashboard
9. **Completion** triggers server list refresh

## Security Measures

1. **Credentials never stored**: Memory-only, cleared on disconnect
2. **Token-based WebSocket auth**: 30-second expiry, one-time use
3. **Session timeout**: 10 minutes max
4. **Rate limiting**: 5 attempts/minute/IP, 3 concurrent sessions/user
5. **Host key auto-accept**: `hostVerifier: () => true` (acceptable for new server installs)
6. **Privacy notice**: Displayed prominently in UI

## Error Handling

| Error Code | Cause | User Message |
|------------|-------|--------------|
| `CONNECTION_REFUSED` | SSH port closed | "Cannot connect. Check IP address and port." |
| `AUTH_FAILED` | Wrong credentials | "Authentication failed. Check username and password/key." |
| `TIMEOUT` | Server unreachable | "Connection timed out. Server may be unreachable." |
| `HOST_UNREACHABLE` | Network issue | "Host unreachable. Check network and firewall." |
| `UNSUPPORTED_OS` | Not Debian/Ubuntu | "This server runs {OS}. ServerFlow requires Debian or Ubuntu." |
| `NO_SUDO` | Missing sudo access | "Root access required. Try connecting as root..." |
| `MAX_SESSIONS` | Too many sessions | "Maximum 3 concurrent SSH sessions allowed" |
| `RATE_LIMITED` | Too many attempts | "Too many connection attempts. Wait 1 minute." |

## i18n Support

Translations available in 5 languages (EN, FR, DE, ES, IT):
- `infrastructure.assistedInstall`
- `infrastructure.sshHost`, `sshPort`, `username`
- `infrastructure.authMethod`, `passwordAuth`, `keyAuth`
- `infrastructure.verboseMode`, `showDetailedOutput`
- `infrastructure.startInstallation`
- `infrastructure.installProgress`, `step`, `connecting`, etc.

## Dependencies

```json
// control-plane package.json
"ssh2": "^1.17.0"   // SSH client for Node.js

// Types
"@types/ssh2": "^1.15.5"
```

Note: No xterm.js used - custom CSS terminal display instead.

## Future Improvements (Out of Scope)

- SSH key generation from dashboard
- Saved server profiles for reuse
- Multi-server batch installation
- RHEL/Alpine support
- Full xterm.js interactive terminal
