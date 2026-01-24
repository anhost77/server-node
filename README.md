# ServerFlow

**ServerFlow** is a Zero-Trust Bridge between AI coding agents (Claude, Cursor) and your own infrastructure (VPS).

## Monorepo Structure

This project is a **PNPM Workspace** monorepo containing:

### Apps
- **`apps/agent`**: The Node.js client installed on user servers.
- **`apps/control-plane`**: The central API and WebSocket server.
- **`apps/dashboard`**: The Vue 3 administrative interface.

### Packages
- **`packages/shared`**: Shared Zod schemas and types.
- **`packages/db`**: Drizzle ORM schema and database connection logic.
- **`packages/config`**: Environment variable validation and parsing.

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build all packages:**
   ```bash
   turbo run build
   ```

3. **Start Development:**
   ```bash
   turbo run dev
   ```
