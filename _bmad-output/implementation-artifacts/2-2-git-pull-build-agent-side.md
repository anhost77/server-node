# Story 2.2: Git Pull & Build (Agent Side)

**Epic:** 2 - Autonomous Delivery (GitOps Engine)
**Status:** review
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
- **Safety:** Each repository operates in its own isolated workspace.

## 3. Dev Agent Record
### Completion Notes
- Developed `ExecutionManager` in `@server-flow/agent`.
- Set up bidirectional log streaming (Agent -> CP -> Dashboard).
- Enhanced Dashboard UI with a high-fidelity 'Build Monitor' terminal.
- Implemented state-aware progress indicators (Cloning -> Installing -> Building).
- Integrated with GitHub Webhooks from Story 2.1.
- Verified build with `turbo run build`.
