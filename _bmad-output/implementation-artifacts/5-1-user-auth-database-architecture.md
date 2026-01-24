# Architecture Upgrade: User Authentication & Database Storage

## 1. Context & Objective
Currently, "ServerFlow" operates as a single-tenant system using JSON files (`servers.json`, `apps.json`) for persistence. To evolve into a robust SaaS / Multi-User platform, we need to introduce a relational database and proper user authentication.

**Goals:**
- Replace file-based storage with **SQLite** (dev) / **PostgreSQL** (prod) via **Drizzle ORM**.
- Implement **User Authentication** via GitHub OAuth (persisted Session).
- Secure API endpoints (Authenticated User Only).
- Lay the groundwork for Multi-Tenancy (Teams/Projects).

## 2. Technology Stack Upgrade
- **Database**: SQLite (`better-sqlite3`) for local development simplicity.
- **ORM**: `drizzle-orm` for type-safe queries and schema definition.
- **Migrations**: `drizzle-kit` for schema management.
- **Session**: `fastify-secure-session` or custom session management using signed cookies + DB store.

## 3. Database Schema

### `users` table
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID, Primary Key |
| email | TEXT | Unique, from GitHub |
| name | TEXT | Display Name |
| avatar_url | TEXT | From GitHub |
| created_at | INTEGER | Timestamp |
| role | TEXT | 'admin' | 'user' |

### `accounts` table (OAuth links)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | UUID, PK |
| user_id | TEXT | FK -> users.id |
| provider | TEXT | 'github' |
| provider_account_id | TEXT | GitHub User ID |
| access_token | TEXT | Encrypted GitHub Token |
| created_at | INTEGER | |

### `sessions` table
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | Session Token |
| user_id | TEXT | FK -> users.id |
| expires_at | INTEGER | Timestamp |

### `servers` table (Migration from `servers.json`)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PK, UUID of the agent |
| owner_id | TEXT | FK -> users.id (The user who added it) |
| name | TEXT | Friendly name |
| ip | TEXT | |
| status | TEXT | 'online' / 'offline' |
| last_seen | INTEGER | |
| public_key | TEXT | For agent auth verification |

### `apps` table (Migration from `apps.json`)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | PK |
| server_id | TEXT | FK -> servers.id |
| name | TEXT | |
| repo_url | TEXT | |
| env_vars | TEXT | JSON string of encrypted env vars |
| port | INTEGER | |
| created_at | INTEGER | |

## 4. Implementation Phasing

### Phase 1: Database Setup
1. Install Drizzle dependencies.
2. Define Schema in `apps/control-plane/src/db/schema.ts`.
3. Generate and run initial migration.
4. Rewrite `index.ts` to connect to SQLite.

### Phase 2: Authentication Flow
1. Update `/api/auth/github/callback` to:
   - Check if user exists in `accounts`.
   - Create `user` and `account` if new.
   - Create a `session` record.
   - Set a `httpOnly` cookie with the session ID.
2. Create middleware/hook `requireAuth` to protect `/api/servers` and `/api/apps`.

### Phase 3: Data Migration (JSON -> DB)
1. Write a script to read existing `servers.json` and `apps.json`.
2. Insert them into SQLite, assigning them to the first admin user created.

### Phase 4: Frontend Alignment
1. Update Dashboard to check `/api/auth/me`.
2. Show Login Screen if 401.
3. Remove `gh_token` client-side storage (move to server-side `accounts` table).

## 5. Security Improvements
- **No more hardcoded tokens** in `apps.json` or client-side.
- **Tokens stored server-side**, ideally encrypted (later step).
- **Session-based access**, preventing unauthorized Dashboard access.
