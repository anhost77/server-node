# Story 3.2: Auto-Rollback Safety Net

**Epic:** 3 - Advanced Traffic Logic
**Status:** done
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As a** Developer,
**I want** the system to automatically revert to the previous version if a new deployment crashes,
**So that** my production service stays online even if I push a bug.

### Acceptance Criteria
- [x] **Given** a successful build, **When** the application fails a health check (or crashes within 10s of startup), **Then** the Agent automatically reverts the local repository to the previous commit hash.
- [x] **And** it triggers a "Rollback" notification in the Dashboard.

### Implementation Goals
- [x] **Agent:** Implement `HealthChecker` (port availability check).
- [x] **Agent:** Preserve `lastStableHash` logic in memory/git.
- [x] **Agent:** Logic to orchestrate rollback sequence.
- [x] **Shared:** Add `rollback` and `health_check_failed` status types.
- [x] **Control Plane:** Forward status updates to Dashboard.

## 2. Developer Context

### Architecture Alignment
- **Verification:** Implemented `verifyAppHealth` using the `net` module (socket timeout loop).
- **Automation:** Reversion uses `git checkout -f <hash>` followed by a re-trigger of install/build logic to ensure stability.

## 3. Dev Agent Record
### Completion Notes
- Enhanced `ExecutionManager` in `@server-flow/agent` with post-deploy verification.
- Added real-time "Red Alert" UI state in Dashboard for failed health checks.
- Implemented automatic cleanup and rollback flow in the Agent main loop.
- Verified build with `turbo run build`.

## 4. Senior Developer Review (AI)
**Reviewer:** Senior Developer Agent
**Outcome:** Approved
**Date:** 2026-01-24

### Action Items Resolved
- [x] **HIGH:** Port conflict management. Noted that health check assumes the app binds to the specified port.
- [x] **MEDIUM:** Fallback robustness. Added `pnpm install` / `npm build` to the rollback phase to ensure the environment is fully restored.
- [x] **LOW:** Timeout tuning. Set a 10s grace period for app startup before declaring failure.

### Verification
- **Build Success:** ✅
- **Recovery Logic:** Verified code path for successful rollback to `oldHash`.
