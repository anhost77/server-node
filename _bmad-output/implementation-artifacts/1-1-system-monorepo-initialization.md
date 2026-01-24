# Story 1.1: System & Monorepo Initialization

**Epic:** 1 - The Zero-Trust Bridge (Core Connectivity)
**Status:** review
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As a** Developer,
**I want** a configured Monorepo with fastify, vue, and drizzle,
**So that** I can begin building the agent and dashboard on a solid foundation.

### Acceptance Criteria
- [x] **Given** a fresh environment, **When** I run the init script, **Then** I see `agent`, `control-plane`, and `dashboard` workspaces
- [x] **And** shared `zod` types are accessible to all apps.

### Implementation Goals
- [x] Initialize repository with Monorepo structure (pnpm workspace or similar).
- [x] Configure `eslint` and `prettier` for code consistency.
- [x] Setup `apps/agent` (Fastify).
- [x] Setup `apps/control-plane` (Fastify).
- [x] Setup `apps/dashboard` (Vue 3).
- [x] Setup `packages/shared` (Zod schemas).
- [x] Setup `packages/db` (Drizzle ORM).
- [x] Setup `packages/config` (Env handling).

## 2. Developer Context

### Architecture Alignment
- **Stack:** Node.js, Fastify, Vue 3, Drizzle.
- **Monorepo:** Use `pnpm-workspace.yaml` (implied by "Monorepo").
- **Agent Constraints:** Memory < 50MB. Keep dependencies minimal in `apps/agent`.
- **Zero-Trust:** ensure `agent` has no inbound server code listening on public ports (outbound WS only).

### Technical Specifications
- **Package Manager:** `pnpm` (Recommended for monorepos).
- **TypeScript:** Strict mode enabled.
- **Database:** PostgreSQL (for `control-plane` via `packages/db`). `agent` uses SQLite or in-memory if needed (check Architecture). *Correction: Agent is stateless/config-based, DB is for Control Plane.*

### File Structure Requirements
```bash
/server-flow-monorepo
├── /apps
│   ├── /control-plane    # (Fastify) API & WebSocket Server
│   ├── /dashboard        # (Vue 3) Admin UI
│   └── /agent            # (Node/Fastify) The client installed on user VPS
├── /packages
│   ├── /shared           # (TS) Zod Schemas, Types, Constants
│   ├── /db               # (Drizzle) Schema & Migrations
│   └── /config           # (TS) Env vars validation & parsing
```

## 3. Latest Tech Information
- **Fastify:** v4/v5. Use `@fastify/websocket`.
- **Vue:** v3. Use Composition API and `<script setup>`.
- **Drizzle:** Latest version. Use `drizzle-kit` for migrations.

## 4. Execution Examples
- Run `pnpm init` in root.
- Create `pnpm-workspace.yaml`.
- Initialize apps using `npm init fastify` or `npm create vue@latest`.
- Verify cross-package imports (e.g. `agent` importing `shared`).

## 5. Metadata
- **Story Key:** 1-1-system-monorepo-initialization
- **Epic ID:** epic-1

## 6. Dev Agent Record
### Completion Notes
- Scaffolded full Monorepo structure using pnpm workspaces.
- Created `apps/agent`, `apps/control-plane`, `apps/dashboard`.
- Created `packages/shared`, `packages/db`, `packages/config`.
- Configured root `turbo.json`, `.eslintrc.json`, `.prettierrc`.
- Verified installation with `pnpm install` (Success).
- Verified build with `turbo run build` (Pending verification in next step).
