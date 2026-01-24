---
stepsCompleted: ['step-01-init', 'step-01b-continue', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional']
classification:
  projectType: 'saas_b2b'
  domain: 'infrastructure_devops'
  complexity: 'high'
  projectContext: 'greenfield'
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-serverflow-2026-01-23.md
  - _bmad-output/brainstorming/brainstorming-session-2026-01-23.md
workflowType: 'prd'
---

# Product Requirements Document - ServerFlow

**Author:** Adrien
**Date:** 2026-01-24

## Executive Summary
**ServerFlow** is the simplest way to deploy code to your own infrastructure (VPS).
It acts as a "Zero-Trust Bridge" between AI coding agents (Claude, Cursor) and your servers.
*   **Problem:** Deploying to a VPS requires manual SSH/Git ops, breaking the AI coding flow.
*   **Solution:** A pull-based agent installed via `curl` that automates Nginx, SSL, and App Management.
*   **Differentiation:** Multi-Cloud Native, Zero-Trust Architecture, and "Universal MCP Bridge".

## Success Criteria

### User Success
- **Time-to-Deploy:** < 5 minutes between signup and live HTTPS URL.
- **Zero Terminal:** Deployment successful without using SSH commands post-agent installation.
- **Confidence:** "Active" status visible on dashboard + instant site availability.

### Business Success
- **Adoption:** 50 beta signups in Month 1.
- **Monetization:** 5 paid users (Warrior/Pro plan) by Month 3.
- **Retention:** Monthly churn < 10%.

### Technical Success
- **Reliability:** Agent uptime > 99.9% (PM2 auto-restart).
- **Security:** Zero incidents related to key management (Zero-Trust validated).
- **Performance:** Dashboard latency < 100ms (WebSocket).

### Measurable Outcomes
- **"Deploy" Success Rate:** > 90% of initiated deployments succeed without error.
- **Agent Survival:** > 95% of agents remain connected after 24h.

## Product Scope

### MVP - Minimum Viable Product
- **Agent:** Node.js pull-based agent (Installer script).
- **Dashboard:** Vue 3 interface for monitoring and config.
- **Git:** OAuth connection + webhook handling.
- **MCP:** Integration for chat-based control.

### Growth Features (Post-MVP)
- **Multi-Server:** Scaling a project across multiple VPS.
- **Advanced Rollback:** Time-travel deployment.
- **Teams:** Collaboration and RBAC.

### Vision (Future)
- **Universal MCP Bridge:** The standard deployment layer for all AI coding agents.

## User Journeys

### Journey 1: "The One-Click Deploy" (Hero Path)
**Persona:** Marc, AI Creator (Non-Ops).
**Trigger:** Just finished generating an app with Cursor, has a fresh VPS.
1.  **Discovery:** Signs up, sees "Connect Server" command.
2.  **Action:** Runs `curl ... | bash` on VPS.
3.  **Connection:** Dashboard updates instantly to "Online".
4.  **Deployment:** Pastes GitLab Repo URL. Clicks "Deploy".
5.  **Magic:** Agent detects `package.json`, installs Node, builds, configures Nginx/SSL.
6.  **Success:** Receives "Your app is live" notification with HTTPS link.

### Journey 2: "The Security Audit" (Trust Path)
**Persona:** Sophie, Senior Dev (Security Conscious).
**Trigger:** Wants automation but fears black-box agents.
1.  **Skepticism:** Checks documentation for "Zero-Trust".
2.  **Verification:** Reviews agent source/behavior (outbound only).
3.  **Adoption:** Installs agent via SSH.
4.  **Advanced Use:** Uses MCP Chat to request "Deploy docker-compose.prod.yml with persistent volumes".
5.  **Confirmation:** Verifies `docker ps` on server to see clean containers.

### Journey Requirements Summary
- **Agent Capabilities:** Auto-detection of runtime (Node/Docker), Nginx config generation, Let's Encrypt handling.
- **Dashboard Real-time:** WebSocket status updates essential for "Magic" feel.
- **Security:** Outbound-only architecture is a hard requirement for adoption by pros.
- **MCP Integration:** Must handle complex natural language requests for advanced config.

## Domain-Specific Requirements

### Technical Constraints (Zero-Trust)
- **Agent-Initiated Connection:** Agent must never listen on public ports. Outbound-only WSS.
- **No Stored Credentials:** System must never store root passwords or private SSH keys.
- **Auditability:** User must have visibility into all agent actions via verbose logs.

### Supply Chain Security
- **Signed Binaries:** Agent releases must be cryptographically signed to prevent supply chain attacks.
- **Open Source Agent:** Agent code must be visible/auditable to build trust with developer audience.

### Reliability & Resilience
- **Decoupling:** Client sites must remain online and functional even if the ServerFlow control plane goes down.
- **Auto-Recovery:** Agent must be capable of self-healing (PM2) and reconnecting with exponential backoff.

## Innovation & Novel Patterns

### The Universal MCP Bridge
**Concept:** ServerFlow acts as the "hands" for AI agents (Claude, Cursor), enabling ChatOps 2.0.
- **Zero-Trust Execution:**
    - **Dry-Run Default:** Destructive commands require explicit UI confirmation.
    - **Command Whitelist:** Strict limits on execution (no arbitrary root shell).
    - **Hybrid UX:** Chat for intent ("Clean logs"), UI for action ("Confirm delete 50MB").

### Performance Innovation: Hot Patching
- **Atomic Deploy:** Agent applies diff-based patches via WebSocket for < 2s feedback loops.
- **Safety Net:** Agent monitors process stability for 10s after patch. If crash detected, **Auto-Rollback** occurs immediately.
- **Mechanism:** Bypasses full Git clone/build for small code changes during dev sessions.

### Consistency Innovation: Reverse Git Push
- **Problem:** Hot patching creates "Drift" (Server state != Git state).
- **Solution:** "Snapshot Strategy". Agent detects local changes and offers to commit/push them back to the repo to restore sync.

### Proactive Agent ("The Janitor")
- **Auto-Fix:** Self-healing capabilities (e.g., restart Nginx on 502, clean tmp files).
- **Proactive Rightsizing:** Agent analyzes actual resource usage to suggest downgrading VPS plans if over-provisioned.

## SaaS Implementation Requirements

### Multi-Tenancy Architecture
- **Isolation Strategy:** **Row Level Security (RLS)** in PostgreSQL.
- **Identifier:** All sensitive tables must include `project_id` and `user_id`.
- **Data Leak Prevention:** Application logic layer must ENFORCE `where project_id = X` on every query, backed by DB RLS policies as safety net.

### Authentication & Authorization
- **Social Login:** **OAuth GitHub** is the primary method for MVP (Speed & Dev fit).
- **Agent Identity:** Devices authenticate via **Ed25519 Signed Setup Tokens** (Device Flow).
- **Permissions:** Simple Owner/Viewer roles for MVP.

### Subscription & Limits Logic
- **Payment Gateway:** Stripe (implied for SaaS).
- **Non-Payment Behavior (Frozen Control):**
    - **App Uptime:** IMPACT ZERO. User's site remains online (ServerFlow doesn't host it, user's VPS does).
    - **Control Plane:** Disabled. User cannot deploy new versions or change config.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy
**Strategy:** "Feature-Complete Launch".
**Rationale:** We prioritize differentiation (MCP, Teams, Multi-Server) over speed. We accept a longer dev cycle to launch a "Killer Product" rather than a barebones MVP.
**Timeline:** Flexible (> 6 weeks acceptable).

### MVP Feature Set (Phase 1 - The "All-In" Launch)
**Must-Have Capabilities:**
1.  **Universal MCP Bridge:** Full ChatOps integration (Claude/Cursor) with "Dry Run".
2.  **Multi-Server Management:** Load balancing and multi-VPS support from Day 1.
3.  **Advanced Git Ops:** Rollbacks, Branch previews, and commit history.
4.  **Proactive Agent:** Auto-fix capabilities enabled.

### Post-MVP (Phase 2)
1.  **Teams & Collaboration:** Invite members + RBAC (Owner/Viewer).
2.  **Marketplace:** One-click install of databases (Redis, Postgres, MinIO).
2.  **Advanced Monitoring:** Real-time metrics history (Prometheus/Grafana integration).
3.  **Billing Evolution:** Usage-based pricing (per deployment minute or bandwidth).

### Risk Mitigation Strategy
- **Complexity Risk:** With a huge MVP, the risk is "Never Launching".

## Functional Requirements

### Agent Core (The Engine)
- **FR1:** Agent can auto-detect project type (Node.js, Docker, Static) by analyzing repo files.
- **FR2:** Agent can generate Nginx configuration and obtain Let's Encrypt SSL certificates automatically.
- **FR3:** Agent can "Hot Patch" code via WebSocket for instant feedback loops (< 2s).
- **FR4:** Agent can "Auto-Fix" critical services (e.g., restart Nginx/PM2 on failure).

### Deployment (The Action)
- **FR5:** User can deploy applications via Git Push (Webhook integration).
- **FR6:** User can deploy and configure services via MCP Chat (Natural Language).
- **FR7:** System executes a "Dry Run" check before any destructive command, requiring user confirmation.

### Governance & Security
- **FR8:** Owner can invite Members with granular roles (Owner/Viewer) - "Teams".
- **FR9:** System enforces Zero-Trust architecture (Outbound-only connections).
- **FR10:** User can access a central audit log of all agent commands (Pro Plan feature).

### Internationalization (i18n)
- **FR11:** System interface (Dashboard & Chat) supports multiple languages, starting with English and French.
- **FR12:** User can switch preferred language in settings.

## Non-Functional Requirements

### Security (Non-Negotiable)
- **Encryption:** All stored tokens must be encrypted (AES-256). All traffic must use TLS 1.3.
- **Auditability:** Command logs must be immutable and retained for 1 year.
- **Footprint:** Agent must never listen on inbound ports (Outbound-only WSS).

### Performance (The "Vercel Feel")
- **Dashboard Latency:** UI updates via WebSocket must occur within 100ms of server event.
- **Agent Efficiency:** Agent must consume < 50MB RAM and < 5% CPU on client VPS.
- **Command Lag:** Time between user action and agent execution start must be < 1s.

### Reliability & Resilience
- **Control Plane SLA:** 99.9% uptime target.
- **Self-Healing:** Agent must auto-restart (via systemd/PM2) after any crash.
- **Decoupling:** Client sites must remain online even if ServerFlow Central is down.


