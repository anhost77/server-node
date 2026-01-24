---
stepsCompleted: [1, 2, 3, 4]
lastStep: 4
status: 'complete'
completedAt: '2026-01-24'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# ServerFlow - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for ServerFlow, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Agent can auto-detect project type (Node.js, Docker, Static) by analyzing repo files.
FR2: Agent can generate Nginx configuration and obtain Let's Encrypt SSL certificates automatically.
FR3: Agent can "Hot Patch" code via WebSocket for instant feedback loops (< 2s).
FR4: Agent can "Auto-Fix" critical services (e.g., restart Nginx/PM2 on failure).
FR5: User can deploy applications via Git Push (Webhook integration).
FR6: User can deploy and configure services via MCP Chat (Natural Language).
FR7: System executes a "Dry Run" check before any destructive command, requiring user confirmation.
FR8: Owner can invite Members with granular roles (Owner/Viewer) - "Teams".
FR9: System enforces Zero-Trust architecture (Outbound-only connections).
FR10: User can access a central audit log of all agent commands (Pro Plan feature).
FR11: System interface (Dashboard & Chat) supports multiple languages, starting with English and French.
FR12: User can switch preferred language in settings.

### NonFunctional Requirements

NFR1: [Security] Encryption: All stored tokens must be encrypted (AES-256). All traffic must use TLS 1.3.
NFR2: [Security] Auditability: Command logs must be immutable and retained for 1 year.
NFR3: [Security] Footprint: Agent must never listen on inbound ports (Outbound-only WSS).
NFR4: [Performance] Dashboard Latency: UI updates via WebSocket must occur within 100ms of server event.
NFR5: [Performance] Agent Efficiency: Agent must consume < 50MB RAM and < 5% CPU on client VPS.
NFR6: [Performance] Command Lag: Time between user action and agent execution start must be < 1s.
NFR7: [Reliability] Control Plane SLA: 99.9% uptime target.
NFR8: [Reliability] Self-Healing: Agent must auto-restart (via systemd/PM2) after any crash.
NFR9: [Reliability] Decoupling: Client sites must remain online even if ServerFlow Central is down.

### Additional Requirements

**Architecture & Technical:**
- **Stack:** Fastify (Backend/Agent) + Vue 3 (Dashboard) + Drizzle ORM (PostgreSQL).
- **Monorepo:** Structure must isolate `agent`, `control-plane`, and `dashboard` apps with shared `zod` schemas.
- **Protocol:** Outbound WebSocket (WSS) initiated by Agent using Ed25519 Signed Challenge.
- **Safe Patching:** Agent must implement Backup -> Dry-Run -> Write -> Verify flow for all file modifications.
- **Database:** Multi-tenancy enforced via `project_id` on all tables (RLS strategy).

**UX & Design:**
- **Onboarding:** "Command Blast" flow - Copy/Paste one-line `curl` command to connect server.
- **Responsive:** "Mobile Emergency Mode" layout for read-only status and critical actions (Restart/Rollback).
- **Visuals:** "Vercel-like" aesthetic (Tailwind + Shadcn), Dark Mode default.
- **Components:** Custom `<TerminalBlock>` and `<LogStream>` with virtual scrolling.

### FR Coverage Map

- **FR1 (Auto-Detect):** Epic 1
- **FR2 (Nginx/SSL):** Epic 2
- **FR3 (Hot Patch):** Epic 3
- **FR4 (Auto-Fix):** Epic 3
- **FR5 (Git Push):** Epic 2
- **FR6 (MCP Chat):** Epic 4
- **FR7 (Dry Run):** Epic 2
- **FR8 (Teams):** Epic 5
- **FR9 (Zero-Trust):** Epic 1
- **FR10 (Audit Logs):** Epic 4
- **FR11 (i18n UI):** Epic 1
- **FR12 (Lang Settings):** Epic 5

## Epic List

### Epic 1: The Zero-Trust Bridge (Core Connectivity)
**Goal:** Enable a user to securely connect a VPS to the dashboard in < 30 seconds without sharing SSH keys.
**FRs Covered:** FR9 (Zero-Trust), FR1 (Auto-Detect), FR11 (Interface).
**Value:** Establishes the secure channel required for all other operations. Delivers the "Magic" onboarding moment (Command Blast).

### Epic 2: Autonomous Delivery (GitOps Engine)
**Goal:** Transform a Git Push into a live HTTPS URL automatically.
**FRs Covered:** FR5 (Git Push), FR2 (Nginx/SSL), FR7 (Dry Run Checks).
**Value:** Delivers the primary product promise: "Vercel simplicity for VPS".

### Epic 3: Real-Time Resilience (Hot Patching)
**Goal:** Provide instant feedback loops and self-healing infrastructure.
**FRs Covered:** FR3 (Hot Patching), FR4 (Auto-Fix).
**Value:** Differentiates the product via speed (2s deploy) and reliability (auto-restart).

### Epic 4: The AI Interface (MCP Bridge)
**Goal:** Empower AI agents (Claude/Cursor) to perform ops tasks via natural language.
**FRs Covered:** FR6 (MCP Chat), FR10 (Audit Logs).
**Value:** Position ServerFlow as the "Hands" of the AI developer (ChatOps 2.0).

### Epic 5: SaaS Governance & Growth
**Goal:** Enable collaboration and subscription management.
**FRs Covered:** FR8 (Teams), FR12 (Lang Settings).
**Value:** Multi-user support needed for B2B adoption.

## Epic 1: The Zero-Trust Bridge (Core Connectivity)

### Story 1.1: System & Monorepo Initialization
**As a** Developer,
**I want** a configured Monorepo with fastify, vue, and drizzle,
**So that** I can begin building the agent and dashboard on a solid foundation.

**Acceptance Criteria:**
**Given** a fresh environment
**When** I run the init script
**Then** I see `agent`, `control-plane`, and `dashboard` workspaces
**And** shared `zod` types are accessible to all apps.

### Story 1.2: Agent Authentication Protocol
**As a** Security Engineer,
**I want** the Agent to authenticate via Ed25519 signatures,
**So that** no secrets are transmitted over the wire.

**Acceptance Criteria:**
**Given** an unregistered agent
**When** it attempts to connect via WebSocket
**Then** the server challenges it with a nonce
**And** the agent must sign it with its private key to establish the session.

### Story 1.3: The "Connect Server" Interaction
**As a** User,
**I want** to copy a single command from the dashboard,
**So that** I can install the agent on my VPS without SSH knowledge.

**Acceptance Criteria:**
**Given** I am on the dashboard "Add Server" screen
**When** I click "Copy Command"
**Then** a `curl | bash` string including a registration token is copied
**And** executing it on a VPS installs Node.js and starts the Agent service.

### Story 1.4: Real-Time Connection Status
**As a** User,
**I want** to see my server go "Online" instantly in the dashboard,
**So that** I know the installation worked.

**Acceptance Criteria:**
**Given** the agent has just connected
**When** the WebSocket handshake completes
**Then** the Dashboard status badge changes from "Pending" (Grey) to "Online" (Green) wthout page refresh.

## Epic 2: Autonomous Delivery (GitOps Engine)

### Story 2.1: Git Push Webhook Handler
**As a** System,
**I want** to receive GitHub webhooks,
**So that** I know when code has changed.

**Acceptance Criteria:**
**Given** a user pushes code to `main`
**When** GitHub sends a payload to `/api/webhooks/github`
**Then** the system verifies the signature
**And** instructs the relevant Agent to start a deployment.

### Story 2.2: Git Pull & Build (Agent Side)
**As a** User,
**I want** the agent to pull my code and install dependencies,
**So that** the application runs with the latest changes.

**Acceptance Criteria:**
**Given** a deployment instruction received via WS
**When** the Agent executes the job
**Then** it performs `git pull`, `npm install`, and `npm run build`
**Then** it performs `git pull`, `npm install`, and `npm run build`
**And** streams the stdout logs back to the dashboard in real-time
**And** uses the specific Node.js version defined in `package.json > engines` (via Docker or NVM).

### Story 2.3: Nginx & SSL Automation
**As a** User,
**I want** my app accessible via HTTPS,
**So that** it is secure and production-ready.

**Acceptance Criteria:**
**Given** a successful build
**When** the app starts on a local port (e.g. 3000)
**Then** the Agent generates an Nginx config reverse-proxying that port
**And** requests a Let's Encrypt certificate via Certbot
**And** ensures isolation allows multiple apps on the same server (Virtual Hosts).

## Epic 3: Real-Time Resilience (Hot Patching)

### Story 3.1: Hot Path Diffing
**As a** Developer,
**I want** to push small changes without a full rebuild,
**So that** I can debug faster.

**Acceptance Criteria:**
**Given** a modified file in the repo
**When** the Agent receives a "Hot Patch" payload
**Then** it writes the file directly to disk
**And** triggers a service reload (not full restart) if possible.

### Story 3.2: Auto-Rollback Safety Net
**As a** User,
**I want** the system to revert changes if the app crashes,
**So that** I don't break production.

**Acceptance Criteria:**
**Given** a deployment just finished
**When** the process exits with status != 0 within 10 seconds
**Then** the Agent automatically reverts the file changes/git hash
**And** notifies the dashboard of "Rollback Triggered".

## Epic 4: The AI Interface (MCP Bridge)

### Story 4.1: MCP Server Implementation
**As an** AI Assistant (Claude),
**I want** to discover available server tools via MCP,
**So that** I can control the infrastructure.

**Acceptance Criteria:**
**Given** a running ServerFlow instance
**When** an MCP client connects
**Then** it lists tools: `deploy_app`, `get_logs`, `restart_service`.

### Story 4.2: Structured Audit Logging
**As a** Security Auditor,
**I want** to see exactly what commands the AI executed,
**So that** I trust the "Black Box".

**Acceptance Criteria:**
**Given** an MCP action is triggered
**When** the command executes
**Then** the full request and output are logged to the `audit_logs` table
**And** visible in the Dashboard under "Activity".

## Epic 5: SaaS Governance & Growth

### Story 5.1: Team Invitations
**As a** Project Owner,
**I want** to invite my colleagues,
**So that** we can collaborate on the server.

**Acceptance Criteria:**
**Given** I am an Owner
**When** I enter an email in "Team Settings"
**Then** the user receives an invite link
**And** gains access to the specific project upon acceptance.

### Story 5.2: Internationalization (Français)
**As a** French Developer,
**I want** the interface in my language,
**So that** I am comfortable using the tool.

**Acceptance Criteria:**
**Given** my browser locale is `fr-FR`
**When** I load the dashboard
**Then** all text labels are displayed in French.
