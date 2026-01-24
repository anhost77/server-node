---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-01-24'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- **Agent Pull-Based:** Distributed system where agents initiate outbound connections (WebSocket/HTTP2) - No inbound ports allowed.
- **Orchestration:** Dashboard acts as a "control plane" triggering actions asynchronously.
- **MCP Integration:** A dedicated API layer must expose capabilities to AI models (Claude/Cursor) via Model Context Protocol.
- **Security Core:** Authentication relies on device-flow (SSH Ed25519) and strict binary signing.

**Non-Functional Requirements:**
- **Zero-Trust Security:** Architecture must assume the network is hostile.
- **Resilience:** "Auto-Rollback" mechanism required for Hot Patching failures < 10s.
- **Performance:** Real-time feedback (< 100ms) is critical for the "Magic" feel.

**Scale & Complexity:**
- **Primary Domain:** Distributed Systems / Infrastructure (High Complexity).
- **Components:** Agent (Node.js), Control Plane (API+WS), Dashboard (Vue), MCP Server.
- **Risk:** High (Customer uptime depends on Agent stability).

### Technical Constraints & Dependencies
- **Stack Constraints:** Node.js ecosystem preferred for "One Language" advantage (Agent is Node, Backend should be Node).
- **Connection Model:** Long-lived WebSocket connections (WSS) required for "Push" notifications to agents.
- **Data Persistence:** Relational DB (PostgreSQL) required for Tenants/Projects structure.

### Cross-Cutting Concerns Identified
1.  **Supply Chain Security:** How to update 1000 agents securely?
2.  **Concurrency:** Handling thousands of connected WebSockets (Control Plane scaling).
3.  **Observability:** Centralized logs from distributed agents.

## Starter Template Evaluation

### Primary Technology Domain
**Full-Stack Node.js (Distributed System):** Node.js Agent + Node.js API + Vue.js Dashboard.

### Selected Starter: The "Performance" Stack
**Components:**
- **Agent/Backend:** **Fastify**.
- **Frontend:** **Vue 3**.

**Rationale for Selection:**
- **Memory Footprint:** Fastify fits safely within the 50MB RAM limit for the Agent (unlike NestJS).
- **Performance:** Fastify provides the lowest latency for the Control Plane (high concurrency).
- **Simplicity:** Vue 3 Composition API offers a cleaner DX for the dashboard than React's complexity.

**Initialization Commands:**

```bash
# Backend / Agent
npm install fastify fastify-cli ws @fastify/websocket

# Frontend (Dashboard)
npm create vue@latest
```

**Architectural Decisions Provided by Starter:**
- **Runtime:** Node.js (Unified language for Agent/Server).
- **API Pattern:** Fastify Routes & Plugins.
- **Real-time:** `ws` library for raw, optimized WebSocket connections.
- **Frontend State:** Pinia (Standard Vue 3 state management).

## Core Architectural Decisions

### Data Architecture
- **ORM:** **Drizzle ORM**.
    - *Rationale:* Lightweight (<10kb) compared to Prisma (Rust binary), crucial for the 50MB RAM Agent limit.
- **Database:** PostgreSQL (Relationnal, multi-tenant ready).

### API & Communication Patterns
- **Framework:** **Fastify + Type Provider Zod**.
    - *Rationale:* Offers TypeScript type safety AND automatic OpenAPI generator (critical for the MCP Bridge feature).
- **Agent Protocol:** **WebSocket (WSS)** initiated by Agent.
    - *Pattern:* "Long-Polling fallback" not needed (modern environments support WS).

### Authentication & Security (Zero-Trust)
- **User Auth:** **GitHub OAuth** (MVP speed).
- **Agent Auth:** **Ed25519 Signed Challenge**.
    - *Mechanism:* Agent generates KeyPair on install. Dashboard stores PubKey. Agent signs a nonce on every connection. Safe even if headers are intercepted.

## Implementation Patterns & Consistency Rules

### Naming Patterns
- **Database:** `snake_case` for tables/columns (`user_projects`, `created_at`).
- **API:** `kebab-case` for URLs (`/api/v1/deploy-status`), `camelCase` for JSON payloads.
- **Code:**
    - `PascalCase` for Vue Components (`AgentStatus.vue`).
    - `camelCase` for Files/Functions (`checkHealth.ts`).

### Structure Patterns
- **Backend (Fastify):**
    - `/src/plugins`: Reusable logic (DB connector, Auth).
    - `/src/routes`: API endpoints grouped by domain (`/routes/agents`, `/routes/projects`).
    - `/src/schemas`: All Zod schemas centralized here.
- **Frontend (Vue 3):**
    - `stores/`: Pinia stores for global state.
    - `composables/`: Reusable stateful logic (`useAgent.ts`).
    - `views/`: Page-level components.

### Format Patterns
- **API Response:** Unify all responses under `{ success: boolean, data: T, error: { code, message } | null }`.
- **Validation:** Zod schemas MUST be the source of truth for types (using `z.infer<typeof Schema>`).

### Critical Pattern: Safe Patching
**Rule:** Any code modification by the Agent MUST follow this transactional flow:
1.  **Backup:** Copy target file to `/tmp/.backup`.
2.  **Dry-Run:** Apply patch in memory + Syntax Check (AST).
3.  **Write:** Overwrite target file.
4.  **Verify:** If process crashes within 10s -> Restore Backup immediately.

## Project Structure & Boundaries

### Complete Project Directory Structure (Monorepo)

```bash
/server-flow-monorepo
├── /apps
│   ├── /control-plane    # (Fastify) API & WebSocket Server
│   ├── /dashboard        # (Vue 3) Admin UI
│   └── /agent            # (Node/Fastify) The client installed on user VPS
├── /packages
│   ├── /shared           # (TS) Zod Schemas, Types, Constants (Code reuse > 50%)
│   ├── /db               # (Drizzle) Schema & Migrations
│   └── /config           # (TS) Env vars validation & parsing
├── /docker               # Compose files (Postgres, Redis)
└── /scripts              # Build & Deploy utilities
```

### Architectural Boundaries
- **API Boundary:** `packages/shared` defines the contract (Zod). Agent and Control Plane import from here.
- **Data Boundary:** `packages/db` owns the migrations. Apps import the Drizzle connection instance.
- **No-Leak Rule:** The `agent` app MUST NOT depend on `db` (it communicates only via WebSocket).

### Integration Points
- **Internal:** `control-plane` <-> `dashboard` via HTTP/REST.
- **External:** `agent` <-> `control-plane` via WebSocket (Ed25519 Signed).
- **AI:** `control-plane` exposes `/mcp/v1` for Claude/Cursor integration.

## Architecture Validation Results

### Coherence Validation ✅
- **Decision Compatibility:** High. Fastify + Vue + Drizzle form a coherent "Lightweight Node" stack.
- **Pattern Consistency:** Shared Zod schemas ensure API/UI consistency.
- **Structure Alignment:** Monorepo structure properly isolates Agent code from Dashboard code.

### Requirements Coverage Validation ✅
- **Functional Requirements:** All FRs (including Hot Patching & Zero Trust) are supported by specific decisions.
- **Non-Functional Requirements:** 50MB RAM limit addressed by Fastify/Drizzle choice.

### Implementation Readiness Validation ✅
- **Status:** READY FOR IMPLEMENTATION.
- **Key Strengths:** Unified Type System (Shared Zod), Optimized for Performance (Fastify/ws).

### Implementation Handoff
**First Priority:** Initialize Monorepo and basic `agent` + `control-plane` communication via WebSocket.
