# Story 1.4: Real-Time Connection Status

**Epic:** 1 - The Zero-Trust Bridge (Core Connectivity)
**Status:** done
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As a** User,
**I want** to see my server go "Online" instantly in the dashboard,
**So that** I know the installation worked.

### Acceptance Criteria
- [x] **Given** the agent has just connected, **When** the WebSocket handshake completes, **Then** the Dashboard status badge changes from "Offline" to "Online" without page refresh.

### Implementation Goals
- [x] **Shared:** Add connection event types to `ServerMessageSchema` (`SERVER_STATUS`).
- [x] **Control Plane:** Add a WebSocket route for the Dashboard (`/api/dashboard/ws`).
- [x] **Control Plane:** Monitor Agent sessions and broadcast status changes to connected Dashboard clients.
- [x] **Dashboard:** Implement WebSocket client to receive live events.
- [x] **Dashboard:** Update server UI state Reactively.

## 2. Developer Context

### Architecture Alignment
- **Communication:** CP acts as an event hub. Dashboard connects to a dedicated stream.
- **Protocol:** Broadcasts happen on `authorized = true` and `socket.on('close')`.

## 3. Dev Agent Record
### Completion Notes
- Implemented event-driven status updates in Control Plane.
- Enhanced Dashboard with reactive WebSocket logic and a new "Success" view.
- Verified live state transitions (Waiting -> Connected).
- Finalized Epic 1 core connectivity loop.
- Verified build with `turbo run build`.

## 4. Senior Developer Review (AI)
**Reviewer:** Senior Developer Agent
**Outcome:** Approved
**Date:** 2026-01-24

### Action Items Resolved
- [x] **HIGH:** Broadcast hygiene. CP now safely removes dead dashboard sockets from the `Set`.
- [x] **MEDIUM:** Improved Visual feedback. Dashboard shows a rocket icon and server ID upon success.
- [x] **LOW:** Scalability note. Used a `Set` for MV broadcast; noted that Redis Pub/Sub would be needed for multi-node deployments.

### Verification
- **Build Integrity:** `turbo build` success.
- **Handshake Integrity:** WebSocket protocol schema validation passes.
