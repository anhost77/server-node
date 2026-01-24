---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
lastStep: 14
status: 'complete'
completedAt: '2026-01-24'
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-serverflow-2026-01-23.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# UX Design Specification ServerFlow

**Author:** Adrien
**Date:** 2026-01-24

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision
ServerFlow is the **"Zero-Trust Bridge"** for AI-generated code. It bridges the gap between the "Magic" of AI creation and the "Reality" of infrastructure management.
**Core Philosophy:** "Vercel simplicity, but on your own VPS."

### Target Users & Personas
**1. Marc (The AI Creator)**
- **Goal:** "I just want my app online."
- **Pain:** Fears the terminal, doesn't understand Nginx config.
- **Needs:** Green buttons, "Active" badges, instant gratification.

**2. Sophie (The Skeptic)**
- **Goal:** "I need to know what this agent is doing to my server."
- **Pain:** Black-box magic that breaks things silently.
- **Needs:** Audit logs, diff validation, "Break Glass" access.

### Key Design Challenges
1.  **Trust vs. Ease:** How to show security without overwhelming the user?
    - *Solution:* **Contextual Terminal.** Hidden by default (Magic mode), expands automatically on errors (Debug mode).
2.  **Latency perception:** The agent is remote.
    - *Solution:* **Optimistic UI** for actions + **Connectivity Indicator** (Heartbeat) to distinguish "Processing" from "Disconnected".
3.  **Zero-Trust Visualization:**
    - *Solution:* Explicit "Outbound Only" badge and Signed Action indicators.

### Design Opportunities
- **The "Alive" Dashboard:** Use real-time WebSocket data to make the server feel "alive" (pulse, stream logs) rather than a static database record.

## Core User Experience

### Defining Experience
The core experience centers on **"The 30-Second Connect"**.
- User Interface: Dashboard "Add Server" -> Copy Command.
- User Action: Paste command in VPS terminal.
- System Action: Auto-install, Auto-connect, Auto-discovery.
- Result: Instant "Online" status on Dashboard.

### Platform Strategy
- **Primary:** **Desktop Web (Dashboard)**. Full configuration and management.
- **Secondary:** **Mobile Web**. Read-only monitoring and simple actions (Start/Stop).
- **Agent CLI:** **Headless**. Usage limited to initial install and status checks. No TUI (Text UI).

### Effortless Interactions
- **Auto-Discovery:** Agent automatically detects environment (Node, Docker, PM2) upon connection.
- **Set & Forget Deploy:** `git push` triggers deployment without user intervention in the dashboard.

### Critical Success Moments
- **The "First Heartbeat":** The millisecond the dashboard turns green after the user runs the install script.
- **The "Rescue":** When a bad deploy is auto-rolled back, offering immediate relief instead of panic.

### Experience Principles
1.  **Don't Ask, Detect:** If the agent can find it (OS, Node version), don't ask the user to type it.
2.  **Optimistic by Default:** UI updates immediately, rolls back only on failure.
3.  **No Hidden Magic:** "Magic" actions (like auto-rollback) must leave a clear audit trail.

## Desired Emotional Response

### Primary Emotional Goal: Relief ("Ouf")
Infrastructure management is anxiety-inducing ("Did I break prod?").
**Goal:** The user should feel a wave of *Relief* when a deployment succeeds.
*   *Design Implication:* Success indicators should be calm, stable, and persistent. No fleeting toasts.

### Secondary Emotional Goal: Confidence ("I've got this")
For the Skeptic persona, the goal is *Mastery*. They must never feel trapped by the abstraction.
*   *Design Implication:* Streaming logs (Matrix-style but readable) convey that the system is working *for* them.

### Micro-Emotions Journey
1.  **Install:** *Anxiety* (Will this break my VPS?) → *Reassurance* (Dry-run checks passed).
2.  **Deploy:** *Suspense* (Spinner) → *Deliverance* (Live Link).
3.  **Error:** *Panic* (Red Alert) → *Hope* (Instant "Rollback" button available).

### Emotional Design Principles
**"Calm by Default, Informative on Demand."**
- The interface should be quiet when things are going well.
- It should become dense and granular only when the user explicitly digs into details or debugging.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis
**1. Vercel (Architecture):**
- **Why:** The mental model "Project > Deployments > Logs" is the industry standard for this persona.
- **Adopt:** The general navigation structure and the "Status Badge" visual language (Pulse = Working, Red = Error).

**2. Linear (Interaction):**
- **Why:** Information density without clutter.
- **Adopt:** Stacked "Toast Notifications" for async actions (like "Server Connecting...") and high-quality typography/spacing.

**3. Stripe Dashboard (Developer Experience):**
- **Why:** Deep introspectability.
- **Adopt:** The "Logs Panel" that slides in to show raw JSON details for a specific event.

### Anti-Patterns to Avoid
- **"The AWS Console":** Overwhelming navigation with 50+ services. We need *one* centralized view.
- **Infinite Scroll Logs:** Avoid lazy implementation of logs that crashes the browser. Use smart pagination/tailing.

### Design Inspiration Strategy
**"Vercel's Cleanliness + Stripe's Depth"**
- The high-level view is simple and reassuring (Vercel).
- The drill-down view is technical and exhaustive (Stripe).

## Design System Foundation

### Strategy: "The Modern Standard"
**Stack:** **Tailwind CSS + Shadcn-Vue (Radix UI)**.

### Rationale for Selection
1.  **Vercel-Alignment:** Tailwind allows us to replicate the Vercel/Geist aesthetic "pixel-perfect" without fighting a pre-styled framework.
2.  **Velocity:** Shadcn provides high-quality, accessible primitives (Dialogs, Dropdowns) that we can copy-paste and own. No "node_modules black box".
3.  **Future-Proof:** Using Radix UI under the hood ensures accessibility correctness (ARIA).

### Customization Strategy
- **Font:** Inter (or Geist Sans if available).
- **Radius:** Small (0.375rem) to match the professional "Software" look.
- **Dark Mode:** Class-based, defaulting to "System".
- **Dark Mode:** Class-based, defaulting to "System".
- **Colors:** Slate (Neutral) + Emerald (Success) + Rose (Error). Avoid standard Blue.

## Defining Core Experience

### Defining Experience: "The Command Blast"
The interaction signature is the **Inverse Terminal Interaction**.
Instead of the user typing complex commands, the user **copies a single "Capsule" command** from the GUI and pastes it once.

### User Mental Model
- **Old Model:** "I am giving this SaaS my SSH keys (Security Risk)."
- **New Model:** "I am inviting an automated expert to help me (Pull-based)."

### Experience Mechanics
1.  **Initiation:** Dashboard > "Add Server" (Big Pulse Button).
2.  **Interaction:** Click-to-Copy the Install Command (`curl | bash`). Feedback = Satisfying "Pop" sound/haptic.
3.  **Action:** Paste in VPS Terminal.
4.  **Feedback:** The Dashboard **wakes up** instantly via WebSocket.
    - Terminal shows: `[Agent] Connected`.
    - Dashboard shows: `Server Online` (Green Badge).
    - Terminal shows: `[Agent] Connected`.
    - Dashboard shows: `Server Online` (Green Badge).
5.  **Success Criteria:** Time-to-Green < 15 seconds. No questions asked in CLI.

## Visual Design Foundation

### Color System (Tailwind Palette)
- **Neutral:** `Slate` (Cool Grey). Backgrounds: `bg-slate-950` (App), `bg-slate-900` (Cards).
- **Primary:** `White` text on Dark. High contrast.
- **Success:** `Emerald-500` (Pulse indicators).
- **Error:** `Rose-500`.

### Typography System
- **Sans-Serif:** `Inter` (Standard, Legible).
- **Monospace:** `Geist Mono` or `JetBrains Mono`. Critical for the "Terminal" feel of logs.
- **Scale:** Base 16px. Headers `font-bold tracking-tight`.

### Layout Foundation
- **Density:** Compact/Regular. Matches the "Density" of professional dev tools (Linear/VSCode).
- **Radius:** `rounded-md` (0.375rem).
- **Borders:** Thin, subtle `border-slate-800`.
### Layout Foundation
- **Density:** Compact/Regular. Matches the "Density" of professional dev tools (Linear/VSCode).
- **Radius:** `rounded-md` (0.375rem).
- **Borders:** Thin, subtle `border-slate-800`.
- **Dark Mode:** Default and Primary. Light mode is secondary (or post-MVP).

## Design Direction Decision

### Chosen Direction: "The Hybrid Control"
We combine the best of Vercel (Accessibility) and Stripe (Power).

### Key Elements
1.  **Global Navigation (Top Bar):**
    - Logo | Team Switcher | Projects / Domains / Settings | User Profile.
    - *Why:* Keeps the lateral space free for data. Standard mental model.
2.  **Content Area (Full Width):**
    - No artificial `max-w-5xl` container for logs or tables.
    - We use the full monitor width to display detailed info (Logs + JSON side-by-side).
3.  **Contextual Sidebar:**
    - Only appears *inside* a specific project view (e.g., Project A > Overview | Deployments | Settings).

### Rationale
This supports the **Zero-Trust** requirement: we need screen real estate to show "Evidence" (Audit logs, diffs) without cramping the UI. Top Nav keeps the app feeling "Light" initially, but Full Width allows for "Power User" depth when drilling down.

## User Journey Flows

### 1. The Onboarding (Zero to One)
*   **Trigger:** New User -> Empty Dashboard.
*   **Flow:**
    1.  Copy `curl` command from Dashboard.
    2.  Paste in VPS Terminal.
    3.  **Magic Moment:** Terminal says `[Agent] Connected`. Dashboard auto-refreshes to "Setup Project".
    4.  Input Git Repo URL.
    5.  Agent auto-detects `Node.js`. User confirms.
    6.  **Success:** App online at `http://ip:3000`.

### 2. The "Set & Forget" Deploy
*   **Trigger:** `git push main` on GitHub.
*   **Flow:**
    1.  GitHub Webhook -> Control Plane -> Agent.
    2.  Dashboard shows "Building..." (Orange Badge).
    3.  Agent performs `git pull` & `npm install` & `restart`.
    4.  **Success:** Dashboard shows "Active" (Green Badge). No user interaction required.

### 3. The "Panic Button" (Rollback)
*   **Trigger:** Site is down after deploy (HTTP 500).
*   **Flow:**
    1.  Go to "Deployments" tab.
    2.  Find previous Green deployment.
    3.  Click "Rollback".
    3.  Click "Rollback".
    4.  **Success:** Site restored in < 5s. Anxiety relieved.

## Component Strategy

### Foundation Components (Shadcn-Vue)
- **Navigation:** `Sheet` (Mobile), `DropdownMenu` (User/Actions).
- **Feedback:** `Toast` (Async), `Alert` (Errors), `Skeleton` (Loading).
- **Data Display:** `Table` (Density: Compact).
- **Input:** `Dialog` (Modals for critical actions).

### Custom Components ("The Signature")
1.  **`<TerminalBlock />`**
    - *Purpose:* Safe, copy-paste friendly command display.
    - *Features:* Click-to-copy, Syntax Highlighting, Monospace font.
2.  **`<LogStream />`**
    - *Purpose:* Performant viewing of massive log output.
    - *Features:* Virtual Scrolling (`useVirtualList`), Auto-tail, JSON highlighting on hover.
3.  **`<StatusBadge />`**
    - *Purpose:* Instant health feedback.
    - *Features:* Animated Pulse (Green/Orange/Red).

### Implementation Approach
- Use `shiki` for lightweight syntax highlighting in `<TerminalBlock />` and `<LogStream />`.
### Implementation Approach
- Use `shiki` for lightweight syntax highlighting in `<TerminalBlock />` and `<LogStream />`.
- Ensure all components support **Dark Mode** first.

## UX Consistency Patterns

### Empty States (Cold Start)
- **Problem:** "No Servers" looks broken.
- **Solution:** **Hero Card** with illustration.
- **Micro-copy:** "Takes 30 seconds. No SSH keys needed."
- **Action:** Primary Button "Connect your first Server".

### Error Patterns
- **Network Error:** "Reconnecting" Sticky Toast (Orange -> Red). UI becomes Read-Only.
- **Deployment Failed:** Contextual Red Alert in the deployment row. Action: "View Logs" (Primary), "Rollback" (Secondary).

### Loading Patterns
- **Data (Lists/Tables):** Skeleton Loaders (Shadcn style).
### Loading Patterns
- **Data (Lists/Tables):** Skeleton Loaders (Shadcn style).
- **Actions:** Button Spinners ("Deploying...").
- **Terminal:** Blinking Cursor `_` to indicate liveness.

## Responsive Design & Accessibility

### Responsive Strategy
- **Desktop (1024px+):** Full Power. Split views (Logs + Details), Dense tables.
- **Mobile (<768px):** **"Emergency Mode"**.
    - *Visible:* Server Status, Restart Button, Rollback Button.
    - *Hidden:* Complex Logs, Advanced Config.
    - *Layout:* Tables -> Card Lists.

### Accessibility Strategy (WCAG AA)
- **Contrast:** High contrast text (White on Slate-900). No subtle grey-on-grey for critical info.
- **Keyboard First:** Full keyboard navigation support (e.g., `g` `d` -> Go to Deployments).
- **Screen Readers:** Explicit ARIA labels on all icon-only buttons (e.g., "Server Status: Online").

### Testing Strategy
- **Mobile:** Real device testing on iOS Safari (Critical for mobile web quirks).
- **Automated:** Lighthouse Audit > 90 on all pages.
