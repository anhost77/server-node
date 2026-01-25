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

## Tracking & Progress Updates

**CRITICAL**: At EACH step of implementation, Claude MUST update ALL tracking files:

### Files to Update
1. **`_bmad-output/implementation-artifacts/sprint-status.yaml`**
   - Update story status: `backlog` → `in-progress` → `done`
   - Add new stories if implementing new features
   - Mark epics as `done` when all stories complete

2. **Story Implementation File** (if exists)
   - Add implementation notes at the end
   - Document any deviations from the spec
   - List files created/modified

3. **Create New Implementation Artifact** (if needed)
   - When implementing a feature without existing spec
   - Use format: `{epic}-{story}-{title}.md`
   - Document the implementation approach

### Status Workflow
```
backlog → in-progress → review → done
```

### Example Update
When starting work on a story:
```yaml
# Before
7-1-multi-runtime-support: backlog

# After
7-1-multi-runtime-support: in-progress
```

When completing:
```yaml
7-1-multi-runtime-support: done
```

**Update tracking files BEFORE running `pnpm commit:all`**

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
## Langue
Quand tu parles à un humain, tu parles en français.

## Structuration des fichiers
Afin d'éviter les fichier trop longs (maximum 500 lignes), tu dois structurer les fichiers en plusieurs fichiers. et faire des commentaires pour chaque fonction. (en français)
Lorsque tu commentes, tu dois mettre en gras le nom de la fonction. et commenter en francais la fonction détaillée. en expliquant le but de la fonction et comment elle fonctionne pour un humain comme s'il ne savait rien et qu'il ne savait pas comment fonctionne le code, dis toi que c'est pas un developpeur.
Si tu tombe sur un fichier trop long, tu vois avec l'agent product manager qu'il mette en place un plan pour structurer le fichier, et tu demandes à un dev de refactoriser le code.

## En-têtes de fichiers (OBLIGATOIRE)
**CHAQUE fichier** doit commencer par un bloc de commentaires décrivant :
1. **Nom du fichier** - Le chemin relatif depuis la racine du projet
2. **Description** - Ce que fait le fichier en 2-3 phrases simples (pour un non-développeur)
3. **Fonctions principales** - Liste des fonctions importantes et leur but

Exemple pour TypeScript/JavaScript:
```typescript
/**
 * @file apps/agent/src/index.ts
 * @description Point d'entrée de l'agent ServerFlow.
 * Ce fichier démarre l'agent qui tourne sur le serveur de l'utilisateur.
 * Il gère la connexion WebSocket avec le Control Plane et exécute les commandes reçues.
 *
 * @fonctions_principales
 * - connectToControlPlane() : Établit la connexion sécurisée avec le serveur central
 * - start() : Démarre l'agent et le serveur Fastify local
 */
```

Exemple pour Vue:
```vue
<!--
  @file apps/dashboard/src/components/ServerCard.vue
  @description Carte affichant les informations d'un serveur connecté.
  Cette carte montre le nom du serveur, son statut (en ligne/hors ligne),
  le nombre d'applications déployées et les domaines configurés.

  @fonctions_principales
  - openDetails() : Ouvre la page de détails du serveur
  - deleteServer() : Ouvre le modal de suppression
-->

## Utilisation des outils et agents
Lors d'une proposition de fonctionnalité, tu dois utiliser l'agent product manager pour proposer la fonctionnalité. et celui-ci doit procéder à une analyse approfondie et une planification avec les agent dev, ux, et proceder à des test de sécurité et de performance. Lorsque l'on parle de fonctionnalité, tu dois aussi faire des recherches web pour trouver des informations sur la fonctionnalité et proposer des améliorations.
Chaque conversation doit etre uniformisé par un fichier .md, et un plan de développement.

## UI / UX
Lorsqu'on parle d'interface utilisateur, tu dois utiliser l'agent UX pour proposer des améliorations et des fonctionnalités. le dev ne doit jamais procéder à des modifications sans l'approbation de l'agent UX. Le produit manager doit toujours être consulté pour proposer des améliorations. L'interface doit obligatoirement etre responsive et moderne.