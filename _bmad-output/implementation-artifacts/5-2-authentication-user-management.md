# User Management & Authentication Architecture

## Overview
ServerFlow has transitioned from a stateless single-user system to a persistent multi-user architecture. We use a **Hybrid Storage** model:
- **Relational DB (SQLite/LibSQL)**: Handles sensitive user data, accounts, and session management.
- **File System (JSON)**: Temporarily retained for backward compatibility with applications and servers data (migration pending).

## Database Layer
- **Engine**: LibSQL (Pure JS driver for SQLite).
- **ORM**: Drizzle ORM.
- **Location**: `apps/control-plane/data/auth.db`.

### Schema Structure
1. `users`: Stores core profile information (id, name, email, avatar, role).
2. `accounts`: Links external providers (GitHub) to internal users. Stores OAuth access tokens securely.
3. `sessions`: Manages active user sessions. Linked to a `session_id` cookie.

## Authentication Flow (GitHub OAuth)
1. **Initiation**: User clicks "Connect GitHub" in Dashboard.
2. **Authorize**: User is redirected to GitHub.
3. **Callback**: Control Plane receives the code, exchanges it for a token.
4. **Identity**: Control Plane fetches GitHub user profile.
5. **Persistence**: 
   - If user exists (by GitHub ID), session is created.
   - If not, a new user profile is created in DB.
6. **Session**: A UUID is generated, stored in `sessions` table, and sent to client via a `httpOnly` cookie.

## Future Plans (Email/Password)
To implement traditional credentials, the following steps are required:
1. Add `password_hash` column to `users` table.
2. Integrate `bcrypt` or `argon2` for password hashing.
3. Create `/api/auth/signup` and `/api/auth/login` endpoints.
4. Update Dashboard UI to include a login form.

## Security Controls
- **Cookies**: `HttpOnly` and `SameSite: Lax` to prevent XSS and provide CSRF protection in modern browsers.
- **CSRF**: Current implementation relies on SameSite cookies.
- **Token Protection**: GitHub tokens are stored server-side.
