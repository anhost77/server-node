# Claude Code Instructions

## BMAD Framework Documentation

**IMPORTANT**: Before starting any implementation task, Claude MUST read the relevant BMAD documentation in `_bmad-output/`:

### Planning Artifacts (Read First)
- `_bmad-output/planning-artifacts/prd.md` - Product Requirements Document
- `_bmad-output/planning-artifacts/architecture.md` - System Architecture
- `_bmad-output/planning-artifacts/epics.md` - Epic breakdown and stories

### Implementation Artifacts (Per Feature)
- `_bmad-output/implementation-artifacts/` - Contains detailed specs for each story
- Story format: `{epic}-{story}-{title}.md` (e.g., `2-3-nginx-ssl-automation.md`)

### Current Sprint Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Current sprint progress

When implementing a feature, **always check if there's a corresponding implementation artifact** before writing code.

---

## Automatic Git Workflow

**IMPORTANT**: After completing any code changes, Claude MUST automatically commit and push using:

```bash
pnpm commit:all
```

This command:
- Stages all modified files (excluding sensitive files like .env, .pem, credentials)
- Generates a commit message based on changed files
- Commits with `--no-verify` (security checks are in CI)
- Pushes to remote automatically
- Adds `Co-Authored-By: Claude Opus 4.5` to commits

**Do NOT ask the user for confirmation** - just run `pnpm commit:all` after completing tasks.

## Security Requirements

Before making any changes, review:
- `CONTRIBUTING.md` - GDPR and security guidelines
- `SECURITY.md` - Security policy

Key rules:
- Use **Ed25519** for signatures (RSA is FORBIDDEN)
- Use **Argon2id** for passwords (bcrypt is deprecated, bcryptjs is OK)
- Use **SHA-256+** for hashing (MD5/SHA1 are FORBIDDEN)
- Never log passwords, tokens, or secrets
- Never commit .env, .pem, or credential files

## Project Structure

```
apps/
  agent/          # Node agent (runs on user servers)
  control-plane/  # API server (Fastify + SQLite)
  dashboard/      # Vue.js frontend
packages/
  shared/         # Shared types and utilities
  config/         # Configuration package
```

## Development Commands

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm test         # Run tests
pnpm security:check  # Run security validation
pnpm commit:all   # Commit and push (USE THIS!)
```
