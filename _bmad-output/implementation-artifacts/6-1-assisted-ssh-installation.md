# Story 6.1: Assisted SSH Installation

**Epic:** 6 - Onboarding & UX
**Status:** COMPLETED
**Priority:** High
**Effort:** 3-5 days
**Completed:** January 2026

## 1. Story Foundation

### User Story
**As a** non-technical user,
**I want** to connect my server via a guided web interface,
**So that** I don't have to manually copy/paste terminal commands.

### Problem Statement
Users without terminal experience find the current curl-based installation intimidating. They may:
- Not know how to open a terminal
- Make typos in the command
- Not understand error messages
- Feel insecure about what the script does

### Acceptance Criteria
- [x] **Given** I'm on the "Connect Node" page, **When** I click "Assisted Setup", **Then** I see a form to enter SSH credentials
- [x] **And** credentials are NEVER stored (clear privacy notice displayed)
- [x] **And** I can toggle between "Simplified" and "Verbose" output modes
- [x] **Given** valid SSH credentials, **When** I click "Connect", **Then** I see real-time installation progress
- [x] **And** pre-flight checks verify: Debian/Ubuntu OS, curl available, sudo/root access
- [x] **Given** a non-Debian system, **When** connecting, **Then** I see a clear error with manual instructions link
- [x] **Given** SSH connection drops, **When** it happens, **Then** I can retry or see what failed

## 2. Technical Design

### Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│    Dashboard    │ ◄────────────────► │  Control Plane  │
│   (xterm.js)    │                    │   (ssh2 lib)    │
└─────────────────┘                    └────────┬────────┘
                                                │ SSH
                                                ▼
                                       ┌─────────────────┐
                                       │  Target Server  │
                                       └─────────────────┘
```

### Frontend Components

```typescript
// New Vue components
components/
├── ConnectNodeTabs.vue       // Tab container (Quick/Assisted/Manual)
├── AssistedSetup.vue         // Main assisted setup component
├── SSHCredentialsForm.vue    // Credential input form
├── InstallTerminal.vue       // xterm.js terminal wrapper
└── InstallProgress.vue       // Step progress indicator
```

### Backend Endpoints

```typescript
// New WebSocket route
POST /api/ssh/connect
  Body: { host, port, username, password?, privateKey? }
  Response: { sessionId }

WS /api/ssh/session/:sessionId
  Messages:
    → { type: 'INPUT', data: string }
    ← { type: 'OUTPUT', data: string }
    ← { type: 'STATUS', step: number, total: number, message: string }
    ← { type: 'ERROR', code: string, message: string }
    ← { type: 'COMPLETE' }
```

### Pre-flight Check Script

```bash
#!/bin/bash
# Executed BEFORE install.sh

# Check 1: Debian/Ubuntu
if [ ! -f /etc/debian_version ]; then
    echo "ERROR:UNSUPPORTED_OS"
    exit 1
fi

# Check 2: curl
if ! command -v curl &>/dev/null; then
    echo "STATUS:INSTALLING_CURL"
    apt-get update -qq && apt-get install -y -qq curl
fi

# Check 3: sudo/root
if [ "$(id -u)" -ne 0 ]; then
    if ! sudo -n true 2>/dev/null; then
        echo "ERROR:NO_SUDO"
        exit 1
    fi
fi

echo "STATUS:PREFLIGHT_OK"
```

### Security Considerations

1. **Credentials handling:**
   - Never persisted to disk or database
   - Held in memory only during session
   - Cleared immediately after disconnect
   - Session timeout: 10 minutes max

2. **Privacy notice (required):**
   ```
   Your SSH credentials are used for this session only.
   They are transmitted over HTTPS, never stored, and
   cleared from memory when you disconnect.
   ```

3. **Rate limiting:**
   - Max 3 concurrent SSH sessions per user
   - Max 5 connection attempts per minute per IP

## 3. UI/UX Design

### Tab Layout
```
┌─────────────────────────────────────────────────────────┐
│  Connect a Node                                         │
├─────────────────────────────────────────────────────────┤
│  [Quick Install]  [Assisted Setup]  [Manual]           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Content changes based on selected tab                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Assisted Setup Flow

**Step 1: Credentials**
```
┌─────────────────────────────────────────────────────────┐
│  Assisted Setup                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Server Address: [_______________________] : [22]       │
│  Username:       [_______________________]              │
│                                                         │
│  Authentication:                                        │
│  ○ Password      ● SSH Private Key                     │
│  [_________________________________________________]   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔒 Your credentials are NEVER stored.           │   │
│  │    Used only for this installation session.     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Output: ○ Simple  ● Verbose                           │
│                                                         │
│  [🚀 Start Installation]                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Step 2: Installation Progress**
```
┌─────────────────────────────────────────────────────────┐
│  Installing ServerFlow Agent                    [Cancel]│
├─────────────────────────────────────────────────────────┤
│  ✅ Connected to 192.168.1.100                         │
│  ✅ Pre-flight checks passed (Debian 12)               │
│  ⏳ Installing dependencies...                         │
│  ○ Configuring agent                                   │
│  ○ Starting service                                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ $ apt-get update                                │   │
│  │ Hit:1 http://deb.debian.org/debian bookworm... │   │
│  │ Reading package lists...                        │   │
│  │ $ apt-get install -y nodejs                     │   │
│  │ ...                                             │   │
│  └─────────────────────────────────────────────────┘   │
│  [━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░] 45%                 │
└─────────────────────────────────────────────────────────┘
```

### Error States

| Error Code | User Message | Action |
|------------|--------------|--------|
| `CONNECTION_REFUSED` | "Cannot connect. Check IP and port." | Retry button |
| `AUTH_FAILED` | "Authentication failed. Check credentials." | Back to form |
| `UNSUPPORTED_OS` | "This server runs [OS]. ServerFlow requires Debian or Ubuntu." | Link to manual |
| `NO_SUDO` | "Root access required. Try connecting as root." | Back to form |
| `TIMEOUT` | "Connection timed out. Server may be slow." | Retry button |
| `SSH_DISCONNECT` | "Connection lost. Installation may have completed." | Check status |

## 4. Dependencies

### NPM Packages
```json
{
  "ssh2": "^1.15.0",       // SSH client for Node.js
  "xterm": "^5.3.0",       // Terminal emulator
  "xterm-addon-fit": "^0.8.0"
}
```

### Considerations
- ssh2 runs server-side only (security)
- xterm.js is client-side only (display)
- WebSocket bridges the two

## 5. Implementation Plan

### Phase 1: Backend SSH Service (Day 1-2) ✅
- [x] Add ssh2 dependency to control-plane
- [x] Create SSHSessionManager class
- [x] Implement WebSocket endpoint for terminal streaming
- [x] Add pre-flight check script
- [x] Add session timeout and cleanup

### Phase 2: Frontend Components (Day 2-3) ✅
- [x] Create tab navigation in Connect Node
- [x] Build credentials form with validation
- [x] ~~Integrate xterm.js terminal~~ Used custom CSS terminal instead
- [x] Add progress stepper component
- [x] Style error states

### Phase 3: Integration & Polish (Day 4-5) ✅
- [x] Wire up WebSocket communication
- [x] Test with various server configs
- [x] Handle edge cases (slow servers, missing deps)
- [x] Add verbose/simple mode toggle
- [x] Security audit

## 6. Out of Scope (Future)
- SSH key generation from dashboard
- Saving server profiles for reuse
- Multi-server batch installation
- Non-Debian/Ubuntu support (RHEL, Alpine)

## 7. Success Metrics
- Installation success rate > 95%
- Average time to first connected node < 5 minutes
- Support tickets for installation issues -50%
