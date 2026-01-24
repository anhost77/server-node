# Story 2.4: Application Management & Secrets

**Epic:** 2 - Autonomous Delivery (GitOps Engine)
**Status:** in-progress
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As an** Operator,
**I want** to manage multiple applications on different nodes from a single view,
**So that** I can configure environment variables and control process lifecycles.

### Acceptance Criteria
- [ ] **Given** a connected node, **When** I go to the "Applications" tab, **Then** I can register a new app by providing a Git URL and target Node.
- [ ] **And** I can define Environment Variables (Secrets) that are injected into the agent's workspace.
- [ ] **And** I can trigger "Start", "Stop", and "Restart" actions for each app.

### Implementation Goals
- [ ] **Control Plane:** Implement `apps.json` persistence for application metadata.
- [ ] **Control Plane:** Add `/api/apps` CRUD endpoints.
- [ ] **Dashboard:** Build the "Applications" grid and "Register App" modal.
- [ ] **Agent:** Implement `ProcessManager` (using PM2 or direct Node spawns) to handle persistent app execution.

## 2. Developer Context

### Architecture Alignment
- **Execution:** Agent will now use a persistent process manager to keep apps online.
- **Routing:** Infrastructure (Nginx) will soon be linked to 'App' entities instead of raw ports.

## 3. Metadata
- **Story Key:** 2-4-app-management-and-secrets
- **Epic ID:** epic-2
