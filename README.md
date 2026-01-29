# ServerFlow

**ServerFlow** is a Zero-Trust Bridge between AI coding agents (Claude, Cursor) and your own infrastructure (VPS).

## ⚡ Quick Start (Recommended)

**For a fully automated installation**, use the provided scripts:

```bash
# Windows
start.bat

# Linux / macOS
./start.sh
```

These scripts automatically handle:

- ✅ pnpm installation
- ✅ Dependencies installation
- ✅ Package compilation
- ✅ Interactive configuration (GitHub OAuth)
- ✅ Database initialization
- ✅ Service startup

📖 **See [INSTALLATION.md](INSTALLATION.md) for detailed instructions**

## 🌐 Access Points

Once started, access:

- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3000
- **WebSocket**: ws://localhost:3000/api/connect

---

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

## Manual Setup (Advanced)

If you prefer manual setup instead of using the automated scripts:

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Build shared package:**

   ```bash
   pnpm --filter @server-flow/shared build
   ```

3. **Configure environment:**

   ```bash
   cp apps/control-plane/.env.example apps/control-plane/.env
   # Edit .env with your GitHub OAuth credentials
   ```

4. **Initialize database:**

   ```bash
   cd apps/control-plane
   npx drizzle-kit generate:sqlite
   # Apply migrations manually
   ```

5. **Start Development:**
   ```bash
   pnpm dev
   ```

💡 **Tip**: Using `start.bat` or `start.sh` is much easier and handles all of this automatically!
