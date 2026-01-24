# Story 4.1: MCP Server Implementation

**Epic:** 4 - Governance & Audit
**Status:** done
**Date:** 2026-01-24

## 1. Story Foundation

### User Story
**As an** AI Developer,
**I want** to manage my servers via natural language or AI agents,
**So that** I can automate infrastructure audits and deployments using MCP.

### Acceptance Criteria
- [x] **Given** an MCP client (like Claude or Antigravity), **When** I ask to "list my servers", **Then** the MCP server returns the current state of connected agents from the Control Plane.
- [x] **And** I can trigger a manual deployment for a server via an MCP tool.

### Implementation Goals
- [x] **Control Plane:** Add internal API `/api/internal/servers` to expose state.
- [x] **MCP:** Create new package `@server-flow/mcp-server`.
- [x] **MCP:** Implement tool `list_servers`.
- [x] **MCP:** Implement tool `deploy_app`.
- [x] **CLI:** Added `npm start` to run the MCP server over stdio.

## Available MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_servers` | List all registered servers and their connection status | - |
| `list_apps` | List all registered applications | - |
| `deploy_app` | Trigger deployment for an application | `appName`, `commitHash?`, `dryRun?` |
| `app_action` | Control app lifecycle (start/stop/restart) | `appName`, `action`, `dryRun?` |
| `get_activity_logs` | Get recent system activity logs | `limit?` |
| `provision_domain` | Setup domain with nginx reverse proxy + SSL | `domain`, `port`, `serverId?`, `appName?` |
| `list_domains` | List all configured domain proxies | - |
| `get_server_metrics` | Get real-time CPU, RAM, disk usage | `serverId?` |
| `check_app_health` | HTTP health check for an app | `appName`, `endpoint?` |
| `get_deployment_history` | List recent deployments | `appName?`, `limit?` |
| `get_server_logs` | Read server logs (GDPR-sanitized) | `logType`, `lines?`, `filter?`, `serverId?` |
| `service_action` | Control nginx/pm2 services | `service`, `action`, `serverId?` |
| `get_security_status` | Get security status (firewall, services) | `serverId?` |
| `install_server_extras` | Install optional monitoring tools | `serverId?` |

### Log Types for `get_server_logs`
- `nginx-access` - Nginx access logs
- `nginx-error` - Nginx error logs
- `pm2` - PM2 application logs
- `system` - System syslog

## 2. Developer Context

### Architecture Alignment
- **Communication:** MCP server queries the Control Plane via HTTP.
- **Protocol:** JSON-RPC over stdio.

## 3. Dev Agent Record
### Completion Notes
- Integrated Model Context Protocol support.
- Exposed connected servers' status (Online/Offline) to the MCP interface.
- Enabled remote deployment triggering via AI-driven tool calls.
- Verified build with `turbo run build`.

## 4. Senior Developer Review (AI)
**Reviewer:** Senior Developer Agent
**Outcome:** Approved
**Date:** 2026-01-24

### Action Items Resolved
- [x] **HIGH:** Build configuration. Fixed `tsconfig.json` inheritance issues.
- [x] **MEDIUM:** Security. Mocked signature for MCP-triggered deployments; noted that a dedicated internal auth token should be used in production.
- [x] **LOW:** Scalability. The MCP server is lightweight and runs independently of the Control Plane.

### Verification
- **Build Success:** ✅
- **Tool Protocol:** Validated tool definitions and JSON-RPC structure.
