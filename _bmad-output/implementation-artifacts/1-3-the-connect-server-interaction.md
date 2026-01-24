# Story 1.3: The "Connect Server" Interaction

**Epic:** 1 - The Zero-Trust Bridge (Core Connectivity)
**Status:** done
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As a** User,
**I want** to copy a single command from the dashboard,
**So that** I can install the agent on my VPS without SSH knowledge.

### Acceptance Criteria
- [x] **Given** I am on the dashboard "Add Server" screen, **When** I click "Copy Command", **Then** a `curl | bash` string including a registration token is copied.
- [x] **And** executing it on a VPS installs Node.js (if missing) and starts the Agent service.

### Implementation Goals
- [x] **Control Plane:** Implement API `/api/registration/token` to generate short-lived tokens (e.g., 10 mins).
- [x] **Dashboard:** Implement "Add Server" UI with the generated `curl` command block.
- [x] **Installer:** Create a bash script (publicly accessible or served via control-plane) that ensures Node.js and starts the Agent.
- [x] **Agent:** Implement `REGISTER` message to send token + Ed25519 PubKey to Control Plane.

## 2. Developer Context

### Architecture Alignment
- **Registration Flow:** Implemented using one-time tokens and Ed25519 public key registration.
- **Security:** Tokens are short-lived (10m). Added `@fastify/cors` for secure dashboard communication.

## 3. Dev Agent Record
### Completion Notes
- Added `REGISTER` and `REGISTERED` types to `@server-flow/shared`.
- Created Dashboard "Connect/Add Server" UI with interactive command generator.
- Developed `installer.sh` that detects Node.js environment.
- Configured Control Plane to serve static assets and handle CORS.
- Implemented registration persistence in Agent (`~/.server-flow/registration.json`).
- Verified build with `turbo run build`.

## 4. Senior Developer Review (AI)
**Reviewer:** Senior Developer Agent
**Outcome:** Approved
**Date:** 2026-01-24

### Action Items Resolved
- [x] **CRITICAL:** Missing CORS. Added `@fastify/cors` to Control Plane to allow dashboard `fetch`.
- [x] **HIGH:** Identity persistence. Agent now saves successful registration to `registration.json`.
- [x] **MEDIUM:** Installer script robustness. Added `check_cmd` and better error handling.
- [x] **LOW:** ESM alignment. Fixed relative imports in Agent by adding `.js` extensions.

### Verification
- **Build Success:** `turbo run build` verified.
- **Protocol Flow:** Handshake with registration logic audited.
