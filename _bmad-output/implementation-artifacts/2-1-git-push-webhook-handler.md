# Story 2.1: Git Push Webhook Handler

**Epic:** 2 - Autonomous Delivery (GitOps Engine)
**Status:** done
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As a** System,
**I want** to receive GitHub webhooks,
**So that** I know when code has changed.

### Acceptance Criteria
- [x] **Given** a user pushes code to `main`, **When** GitHub sends a payload to `/api/webhooks/github`, **Then** the system verifies the signature.
- [x] **And** instructs the relevant Agent to start a deployment.

### Implementation Goals
- [x] **Control Plane:** Implement `POST /api/webhooks/github` endpoint.
- [x] **Control Plane:** Implement GitHub Webhook Signature verification (`x-hub-signature-256`).
- [x] **Shared:** Define `DEPLOY` message type for the Protocol.
- [x] **Control Plane:** Find the connected agent for the repository and send a deployment instruction.
- [x] **Agent:** Implement `DEPLOY` message handler and simulate lifecycle.

## 2. Developer Context

### Architecture Alignment
- **Verification:** Implemented using `crypto.createHmac` and `timingSafeEqual`.
- **Secret Management:** Placeholder `GITHUB_WEBHOOK_SECRET` used.

## 3. Dev Agent Record
### Completion Notes
- Integrated GitHub Webhook listener in Control Plane.
- Enhanced WS protocol with `DEPLOY` instruction.
- Implemented HMAC security for incoming webhooks.
- Added mock agent routing (assigns first available agent to the repo).
- Verified Agent-side deployment triggers.
- Verified build with `turbo run build`.

## 4. Senior Developer Review (AI)
**Reviewer:** Senior Developer Agent
**Outcome:** Approved (With Improvements)
**Date:** 2026-01-24

### Action Items Resolved
- [x] **HIGH:** Improved `timingSafeEqual` usage. Added a length check to prevent potential crashes on mismatched buffer sizes.
- [x] **MEDIUM:** Standardized HMAC digest format comparison.
- [x] **LOW:** Verified payload branch checking logic.

### Verification
- **Build Success:** `turbo build` verified.
- **Webhook Protocol:** Validated HMAC verification path with mock payloads.
