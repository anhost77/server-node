# ServerFlow Architecture

## Overview

**ServerFlow** is a Zero-Trust Bridge between AI coding agents (Claude, Cursor) and your own infrastructure (VPS). It enables secure, automated deployment and management of applications across distributed servers.

## System Components

```
+-------------------+     +----------------------+     +------------------+
|    Dashboard      |     |    Control Plane     |     |      Agent       |
|    (Vue 3)        |<--->|  (Fastify + WS)      |<--->|  (Node.js)       |
+-------------------+     +----------------------+     +------------------+
        |                          |                          |
        |                          |                          |
   Web Browser              PostgreSQL/SQLite            Target VPS
                                   |
                           +-------+-------+
                           |               |
                      Stripe API     VPS Providers
                                    (Hetzner, DO, Vultr)
```

## Monorepo Structure

```
server-node/
├── apps/
│   ├── agent/           # Node.js client installed on user servers
│   ├── control-plane/   # Central API and WebSocket server
│   ├── dashboard/       # Vue 3 administrative interface
│   └── mcp-server/      # MCP (Model Context Protocol) server
├── packages/
│   ├── shared/          # Shared Zod schemas and types
│   ├── db/              # Drizzle ORM schema and database logic
│   ├── config/          # Environment variable validation
│   └── mcp-client/      # MCP client utilities
├── package.json         # Root monorepo configuration
├── pnpm-workspace.yaml  # PNPM workspace definition
└── turbo.json           # Turborepo build configuration
```

## Component Details

### 1. Control Plane (`apps/control-plane`)

The Control Plane is the central hub that orchestrates all operations.

**Responsibilities:**
- User authentication (password, GitHub OAuth)
- WebSocket server for real-time agent communication
- REST API for dashboard and MCP operations
- Signed command generation for secure agent control
- Billing and subscription management (Stripe integration)
- Multi-tenant data isolation
- VPS provisioning via cloud provider APIs

**Key Features:**
- Fastify-based HTTP/WebSocket server
- SQLite database with Drizzle ORM
- Ed25519 cryptographic command signing
- Real-time metrics aggregation from agents
- GDPR-compliant log sanitization

**Directory Structure:**
```
control-plane/src/
├── index.ts           # Main server entry point
├── db/
│   ├── index.ts       # Database connection
│   └── schema.ts      # Drizzle table definitions
├── security/
│   ├── crypto.ts      # Ed25519 verification
│   ├── keys.ts        # CP key management
│   ├── commands.ts    # Signed command creation
│   └── index.ts       # Security exports
├── billing/
│   ├── stripe.ts      # Stripe SDK initialization
│   ├── checkout.ts    # Checkout session handling
│   ├── subscription.ts# Subscription management
│   ├── usage.ts       # Usage limit enforcement
│   └── webhooks.ts    # Stripe webhook handlers
├── providers/
│   ├── hetzner.ts     # Hetzner Cloud API
│   ├── digitalocean.ts# DigitalOcean API
│   ├── vultr.ts       # Vultr API
│   └── index.ts       # Unified provider interface
└── ssh/
    └── SSHSessionManager.ts  # SSH session handling
```

### 2. Agent (`apps/agent`)

The Agent is a lightweight daemon that runs on each managed server.

**Responsibilities:**
- Maintain persistent WebSocket connection to Control Plane
- Execute deployment commands (clone, build, start)
- Manage applications via PM2
- Configure Nginx reverse proxy
- Report system metrics (CPU, RAM, disk)
- Verify cryptographic signatures on commands

**Key Features:**
- Automatic reconnection with exponential backoff
- Ed25519 signature verification for all critical commands
- Hot-path deployment optimization (skip builds when possible)
- Health check verification with automatic rollback
- Real-time log streaming to Control Plane

**Directory Structure:**
```
agent/src/
├── index.ts          # Main agent entry point
├── identity.ts       # Ed25519 key generation
├── execution.ts      # Deployment execution
├── nginx.ts          # Nginx configuration
├── process.ts        # PM2 process management
├── monitor.ts        # System metrics collection
├── diff.ts           # Git diff analysis for hot-path
└── security/
    └── verifier.ts   # Command signature verification
```

### 3. Dashboard (`apps/dashboard`)

The Dashboard provides a web interface for administrators.

**Built With:**
- Vue 3 with Composition API
- Vite for bundling
- TypeScript
- Tailwind CSS (assumed)

**Features:**
- Real-time server status monitoring
- Application deployment management
- Domain/proxy configuration
- Billing and subscription management
- Activity logs and audit trail
- Support ticket system

### 4. Shared Package (`packages/shared`)

Contains shared type definitions and validation schemas.

**Key Exports:**
- `ServerMessageSchema` - Messages from Control Plane to Agent
- `AgentMessageSchema` - Messages from Agent to Control Plane
- Zod schemas for runtime validation

## Communication Protocol

### WebSocket Message Types

**Server to Agent (ServerMessage):**
| Type | Description |
|------|-------------|
| `CHALLENGE` | Authentication challenge with nonce |
| `AUTHORIZED` | Session authorization confirmation |
| `REGISTERED` | Server registration confirmation |
| `DEPLOY` | Deploy application command |
| `APP_ACTION` | Application lifecycle (START/STOP/RESTART/DELETE) |
| `PROVISION_DOMAIN` | Configure Nginx reverse proxy |
| `DELETE_PROXY` | Remove Nginx configuration |
| `SERVICE_ACTION` | Control Nginx/PM2 services |

**Agent to Server (AgentMessage):**
| Type | Description |
|------|-------------|
| `CONNECT` | Initial connection with public key |
| `REGISTER` | Registration with token |
| `RESPONSE` | Challenge response signature |
| `LOG_STREAM` | Real-time deployment logs |
| `STATUS_UPDATE` | Deployment status changes |
| `DETECTED_PORTS` | Auto-detected application ports |

### Connection Flow

```
Agent                          Control Plane
  |                                  |
  |-------- CONNECT (pubKey) ------->|
  |                                  |
  |<------- CHALLENGE (nonce) -------|
  |                                  |
  |-------- RESPONSE (sig) --------->|
  |                                  |
  |<------- AUTHORIZED --------------|
  |                                  |
  |<======= Signed Commands ========>|
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with billing info |
| `accounts` | OAuth provider connections |
| `sessions` | Active user sessions |
| `nodes` | Registered server nodes |
| `apps` | Deployed applications |
| `proxies` | Nginx domain configurations |
| `activityLogs` | Audit trail |

### Billing Tables

| Table | Purpose |
|-------|---------|
| `plans` | Subscription plan definitions |
| `subscriptions` | User subscription records |
| `invoices` | Invoice history |
| `usageRecords` | Daily usage aggregates |
| `managedServers` | VPS provisioned via providers |

### Support Tables

| Table | Purpose |
|-------|---------|
| `supportTickets` | Support tickets |
| `ticketMessages` | Conversation threads |
| `ticketAttachments` | File attachments |
| `cannedResponses` | Pre-defined responses |

## Data Flow

### Deployment Flow

```
1. User initiates deploy via Dashboard/MCP
2. Control Plane validates user permissions
3. Control Plane checks usage limits
4. Control Plane creates SIGNED DEPLOY command
5. Command sent to Agent via WebSocket
6. Agent verifies signature
7. Agent executes: git clone -> install -> build -> start
8. Agent performs health check
9. Agent reports status back to Control Plane
10. Dashboard receives real-time updates
```

### Metrics Flow

```
1. Agent collects metrics every 30 seconds
2. Metrics sent as SYSTEM_LOG messages
3. Control Plane caches metrics in memory
4. Dashboard receives real-time updates
5. Metrics available via REST API
```

## Configuration

### Control Plane Environment Variables

```env
DATABASE_URL=file:./data/auth.db
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
HETZNER_API_KEY=xxx
DIGITALOCEAN_API_KEY=xxx
VULTR_API_KEY=xxx
```

### Agent Configuration

Configuration stored in `~/.server-flow/`:
- `agent-key.json` - Agent's Ed25519 identity
- `registration.json` - Server registration data
- `cp-public-key.pem` - Control Plane's public key

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Package Manager | PNPM |
| Build System | Turborepo |
| HTTP Framework | Fastify |
| Database ORM | Drizzle |
| Validation | Zod |
| Frontend | Vue 3 + Vite |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |
| SSL | Certbot (Let's Encrypt) |
| Payments | Stripe |

## Scalability Considerations

1. **Database**: SQLite for single-instance, migrate to PostgreSQL for scale
2. **WebSocket**: Consider Redis pub/sub for multi-instance Control Planes
3. **Agents**: Designed to handle 100+ concurrent deployments per node
4. **Billing**: Stripe handles payment processing scale
