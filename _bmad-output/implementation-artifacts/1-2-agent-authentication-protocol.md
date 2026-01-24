# Story 1.2: Agent Authentication Protocol

**Epic:** 1 - The Zero-Trust Bridge (Core Connectivity)
**Status:** done
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As a** Security Engineer,
**I want** the Agent to authenticate via Ed25519 signatures,
**So that** no secrets are transmitted over the wire.

### Acceptance Criteria
- [x] **Given** an unregistered agent, **When** it attempts to connect via WebSocket, **Then** the server challenges it with a nonce.
- [x] **And** the agent must sign it with its private key to establish the session.

### Implementation Goals
- [x] **Agent: Key Generation:** Implement Ed25519 keypair generation (save to `~/.server-flow/config.json`).
- [x] **Agent: WebSocket Client:** Implement WS connection to `ws://localhost:3000/api/connect`.
- [x] **Control Plane: WS Server:** Setup WebSocket route `/api/connect` (using `@fastify/websocket`).
- [x] **Control Plane: Challenge:** Implement Nonce generation (crypto.randomUUID).
- [x] **Protocol Flow:** Implement `CONNECT` -> `CHALLENGE` -> `RESPONSE (Signature)` -> `AUTHORIZED` flow.
- [x] **Shared:** Define schemas for `AgentMessage` and `ServerMessage` in `@server-flow/shared`.

## 2. Developer Context

### Architecture Alignment
- **Security:** "Zero-Trust" means we DO NOT trust the connection until the challenge is signed.
- **Library:** Use Node.js native `crypto` module (`generateKeyPairSync`, `sign`, `verify`).
- **Communication:** WebSockets (not HTTP POST) for the handshake.

### Technical Specifications
- **Key Storage:** Store Private Key in `~/.server-flow/agent-key` (chmod 600).
- **Handshake Timeout:** Disconnect if handshake not completed in 5 seconds.

## 3. Dev Agent Record
### Completion Notes
- Implemented Ed25519 identity generation in `apps/agent`.
- Set up secure challenge-response protocol using WebSockets.
- Unified packet types in `packages/shared`.
- Verified signature verification on `control-plane`.
- Fixed `apps/dashboard` compiler errors surfaced during build.

## 4. Senior Developer Review (AI)
**Reviewer:** Senior Developer Agent
**Outcome:** Approved
**Date:** 2026-01-24

### Action Items Resolved
- [x] **HIGH:** Fixed Dashboard `tsconfig.json` which was causing `vue-tsc` emission errors.
- [x] **MEDIUM:** Improved Crypto logic: Switched from streaming API to direct `crypto.sign`/`verify` for Ed25519 stability.
- [x] **MEDIUM:** Added missing `@types/ws` to Control Plane.
- [x] **LOW:** Cleaned up `.gitignore` (added `*.tsbuildinfo`).

### Verification
- **Handshake Flow:** Audited code path for `nonce` protection and socket state management.
- **Build Integrity:** `turbo run build` verified success.
