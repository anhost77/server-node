# Story 1.2: Agent Authentication Protocol

**Epic:** 1 - The Zero-Trust Bridge (Core Connectivity)
**Status:** review
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
- **Library:** Use Node.js native `crypto` module (`generateKeyPairSync`, `sign`, `verify`) or `sodium-native` if preferred (Node 20 crypto is sufficient).
- **Communication:** WebSockets (not HTTP POST) for the handshake.

### Technical Specifications
- **Key Storage:** Store Private Key in `~/.server-flow/agent-key` (chmod 600).
- **Handshake Timeout:** Disconnect if handshake not completed in 5 seconds.
- **Zod Schemas (@server-flow/shared):**
    ```typescript
    // server-to-agent
    type ServerMessage = 
      | { type: 'CHALLENGE', nonce: string }
      | { type: 'AUTHORIZED', sessionId: string };
    
    // agent-to-server
    type AgentMessage = 
      | { type: 'CONNECT', pubKey: string }
      | { type: 'RESPONSE', signature: string };
    ```

### File Structure Requirements
- **Apps:** `apps/agent` (Client), `apps/control-plane` (Server)
- **Packages:** `packages/shared` (Types)

## 3. Latest Tech Information
- **Node.js Crypto:** Use `crypto.sign(null, Buffer.from(nonce), privateKey)` and `crypto.verify(null, Buffer.from(nonce), publicKey, signature)`.
- **Fastify WS:** Ensure connection is kept alive (ping/pong) after auth (though strictly part of next story, good to know).

## 4. Execution Examples
1. `agent` starts -> checks for key -> generates if missing.
2. `agent` connects to `control-plane` WS.
3. `control-plane` sends `{ type: 'CHALLENGE', nonce: '123' }`.
4. `agent` signs '123' -> sends `{ type: 'RESPONSE', signature: 'xyz' }`.
5. `control-plane` verifies 'xyz' with '123' and Agent's PubKey.
6. If valid -> store socket in `Map<AgentId, WebSocket>`.

## 5. Metadata
- **Story Key:** 1-2-agent-authentication-protocol
- **Epic ID:** epic-1

## 6. Dev Agent Record
### Completion Notes
- Implemented `packages/shared` with Zod schemas for Protocol.
- Implemented `apps/agent/src/identity.ts` for Ed25519 Keygen.
- Implemented `apps/agent` WS Client logic with Challenge signing.
- Implemented `apps/control-plane` WS Server logic with Signature verification.
- Verified build with `turbo run build`.
