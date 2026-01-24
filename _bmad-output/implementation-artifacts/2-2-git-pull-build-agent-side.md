# Story 2.2: Git Pull & Build (Agent Side)

**Epic:** 2 - Autonomous Delivery (GitOps Engine)
**Status:** done
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As a** User,
**I want** the agent to pull my code and install dependencies,
**So that** the application runs with the latest changes.

### Acceptance Criteria
- [x] **Given** a deployment instruction received via WS, **When** the Agent executes the job, **Then** it performs `git pull` (or clone), `npm install`, and `npm run build`.
- [x] **And** streams the stdout/stderr logs back to the dashboard in real-time.

### Implementation Goals
- [x] **Shared:** Define `LOG_STREAM` and `DEPLOY_STATUS` message types.
- [x] **Agent:** Implement `ExecutionManager` using `child_process.spawn`.
- [x] **Agent:** Manage deployment directories (e.g., `~/.server-flow/apps/<repo-name>`).
- [x] **Agent:** Orchestrate the pipeline: Clone -> Install -> Build.
- [x] **Control Plane:** Forward `LOG_STREAM` packets from Agent to relevant Dashboards.
- [x] **Dashboard:** Implement a real-time terminal/log log viewer.

## 2. Developer Context

### Architecture Alignment
- **Execution:** Used `spawn` for non-blocking line-by-line log streaming.
- **Safety:** Each repository operates in its own isolated workspace in `~/.server-flow/apps/`.

## 3. Dev Agent Record
### Completion Notes
- Developed `ExecutionManager` in `@server-flow/agent`.
- Set up bidirectional log streaming (Agent -> CP -> Dashboard).
- Enhanced Dashboard UI with a high-fidelity 'Build Monitor' terminal.
- Implemented state-aware progress indicators.
- Verified build with `turbo run build`.

## 4. Senior Developer Review (AI)
**Reviewer:** Senior Developer Agent
**Outcome:** Approved
**Date:** 2026-01-24

### Action Items Resolved
- [x] **CRITICAL:** Security. Removed `shell: true` from `spawn` calls to prevent shell injection vulnerabilities.
- [x] **HIGH:** Deployment precision. Added logic to pin the deployment to the exact `commitHash` sent via webhook (`git checkout -f <hash>`).
- [x] **MEDIUM:** Reliability. Added `rmSync` cleanup if the initial repo directory exists but is corrupted (not a git repo).
- [x] **LOW:** Compatibility. Explicitly added `.cmd` extension resolution for Node/PNPM binaries on Windows platforms.

### Verification
- **Build Success:** `turbo run build` verified.
- **Handshake Integrity:** WebSocket protocol schema validation passes.
