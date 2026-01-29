# Claude Code Instructions

## Documentation Spécifique par Module

**IMPORTANT** : Avant de travailler sur un module spécifique, Claude DOIT lire la documentation correspondante :

| Module        | Fichier de Documentation              | Quand le lire                        |
| ------------- | ------------------------------------- | ------------------------------------ |
| Site de Vente | `apps/sales-website/SALES-WEBSITE.md` | Toute modification du site marketing |
| Agent         | `docs/AGENT-UPDATE-MECHANISM.md`      | Modification du bundle agent         |
| Agent         | `docs/AGENT-GOTCHAS.md`               | Code exécuté sur le VPS client       |

### Site de Vente (`apps/sales-website/`)

**OBLIGATOIRE** : Avant toute modification sur le site de vente, lire `apps/sales-website/SALES-WEBSITE.md`.

Ce fichier contient :

- Règles SEO (meta tags, structured data, sitemap)
- Système i18n (5 langues : EN, FR, DE, ES, IT)
- Design system (couleurs, typography, spacing)
- Règles de performance (Core Web Vitals)
- Accessibilité (WCAG 2.1 AA)
- Structure des composants
- Checklist avant mise en prod

**Port de développement** : 4500

---

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

### Pre-Commit Checklist

Before running `pnpm commit:all`, verify:

- [ ] `pnpm test` passes (unit tests)
- [ ] `pnpm security:check` passes
- [ ] Manual testing of the feature completed
- [ ] `sprint-status.yaml` updated
- [ ] Implementation artifact updated (if exists)

For new features, ensure:

- [ ] Unit tests added (coverage > 80%)
- [ ] Integration tests added if necessary
- [ ] Edge cases documented in tests

---

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

---

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

---

## Development Commands

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm test         # Run tests
pnpm security:check  # Run security validation
pnpm commit:all   # Commit and push (USE THIS!)
```

---

## Langue et Communication

Quand tu parles à un humain, tu parles en **français**.

Les conversations techniques et la documentation doivent être accessibles même pour un non-développeur.

---

## Structuration des Fichiers

### Limites de Taille Recommandées

Pour maintenir la lisibilité et la maintenabilité :

- **Fichiers métier** (services, controllers) : 300-400 lignes max
- **Fichiers de configuration** : 600 lignes OK
- **Fichiers de routes** : 500 lignes max
- **Fichiers de tests** : pas de limite stricte
- **Fichiers utilitaires** : 200-300 lignes max

**Si un fichier dépasse ces limites** :

1. Consulte le Product Manager Agent pour créer un plan de refactoring
2. Demande à un Dev Agent de procéder à la restructuration
3. Documente le refactoring dans un fichier `refactoring/{date}-{file}.md`

### Commentaires de Code

Tous les commentaires de code doivent être en **français** et accessibles à un non-développeur.

**Règle d'or** : Explique comme si tu parlais à quelqu'un qui ne connaît rien au code.

Exemple :

```typescript
/**
 * **authenticateAgent()** - Vérifie l'identité de l'agent
 *
 * Cette fonction s'assure que l'agent qui se connecte est bien celui
 * qu'il prétend être. C'est comme montrer sa carte d'identité à l'entrée
 * d'un bâtiment sécurisé.
 *
 * Elle vérifie :
 * - Le token secret de l'agent (comme un mot de passe)
 * - La signature numérique (comme un sceau officiel)
 * - Que l'agent n'est pas dans la liste noire
 *
 * @param token - Le mot de passe secret de l'agent
 * @param signature - La signature numérique pour prouver l'identité
 * @returns true si l'agent est authentifié, false sinon
 */
async function authenticateAgent(token: string, signature: string): Promise<boolean> {
  // Implementation code here
}
```

---

## En-têtes de Fichiers (OBLIGATOIRE)

**CHAQUE fichier** doit commencer par un bloc de commentaires décrivant :

1. **Nom du fichier** - Le chemin relatif depuis la racine du projet
2. **Description** - Ce que fait le fichier en 2-3 phrases simples (pour un non-développeur)
3. **Dépendances** - Les principales librairies utilisées
4. **Sécurité** - Les aspects de sécurité importants (si applicable)
5. **Fonctions principales** - Liste des fonctions importantes et leur but

### Template TypeScript/JavaScript

```typescript
/**
 * @file apps/agent/src/websocket/client.ts
 * @description Client WebSocket pour communiquer avec le Control Plane.
 * Ce fichier gère la connexion temps-réel entre l'agent sur le serveur
 * et le serveur central qui envoie les commandes de déploiement.
 *
 * @dependencies
 * - ws: Librairie WebSocket pour la communication temps-réel
 * - pino: Système de logs pour tracer les événements
 *
 * @security
 * - Utilise Ed25519 pour l'authentification (cryptographie moderne)
 * - Vérifie les certificats SSL pour éviter les man-in-the-middle
 * - Ne log jamais les tokens ou secrets
 *
 * @fonctions_principales
 * - connect() : Établit la connexion WebSocket sécurisée
 * - sendCommand() : Envoie une commande au serveur
 * - handleMessage() : Traite les messages reçus du serveur
 * - reconnect() : Reconnecte automatiquement en cas de coupure
 */
```

### Template Vue.js

```vue
<!--
  @file apps/dashboard/src/components/ServerCard.vue
  @description Carte affichant les informations d'un serveur connecté.
  Cette carte montre le nom du serveur, son statut (en ligne/hors ligne),
  le nombre d'applications déployées et les domaines configurés.
  C'est l'élément visuel principal de la liste des serveurs.

  @dependencies
  - Vue 3: Framework frontend
  - Lucide Icons: Icônes pour l'interface

  @fonctions_principales
  - openDetails() : Ouvre la page de détails du serveur
  - deleteServer() : Ouvre le modal de confirmation de suppression
  - refreshStatus() : Rafraîchit le statut du serveur en temps réel
-->
```

---

## Workflow Agents et Validation

### Workflow Propositions de Fonctionnalités

Lorsqu'une nouvelle fonctionnalité est proposée, suivre ce processus :

1. **User Request** → Claude identifie le besoin et effectue des recherches web si nécessaire

2. **Product Manager Agent** :
   - Analyse de faisabilité technique et métier
   - Définition du scope et des limites
   - Recherche de meilleures pratiques sur le web
   - Création du fichier `_bmad-output/feature-proposals/{date}-{feature}.md`
   - Décomposition en Epic + Stories

3. **UX Agent** (si UI concernée) :
   - Wireframes et maquettes
   - Design responsive (mobile, tablet, desktop)
   - Accessibilité (WCAG 2.1 AA minimum)
   - Design system cohérent

4. **Dev Agent** :
   - Architecture technique détaillée
   - Estimation de charge (story points)
   - Identification des dépendances
   - Plan de tests

5. **Security Agent** :
   - Analyse des risques de sécurité
   - Validation cryptographique (Ed25519, Argon2id)
   - Vérification GDPR et données sensibles
   - Tests de pénétration si nécessaire

6. **Product Manager** → Validation finale :
   - Priorisation dans le backlog
   - Ajout à `sprint-status.yaml`
   - Communication du plan à l'équipe

**Output final** : Epic + Stories documentés et ajoutés au sprint

### Template Feature Proposal

```markdown
# Feature Proposal: {Feature Name}

**Date** : {YYYY-MM-DD}
**Proposé par** : {User/Claude}
**Status** : draft | validated | rejected | in-progress

## 📋 Résumé

Courte description de la fonctionnalité (2-3 phrases)

## 🎯 Objectifs

- Objectif 1
- Objectif 2

## 🔍 Recherches Web

### Meilleures Pratiques

- Lien 1 : Résumé
- Lien 2 : Résumé

### Technologies Similaires

- Outil 1 : Comment ils font
- Outil 2 : Ce qu'on peut en apprendre

## 👥 Analyse UX (si UI)

### Wireframes

[Liens ou descriptions]

### Responsive Design

- Mobile : ...
- Tablet : ...
- Desktop : ...

## 🏗️ Architecture Technique

### Composants Impactés

- Component 1 : Modifications nécessaires
- Component 2 : Nouveaux fichiers

### Dépendances

- Librairie 1 : Version, pourquoi
- Librairie 2 : Version, pourquoi

## 🔒 Sécurité

### Risques Identifiés

- Risque 1 : Mitigation
- Risque 2 : Mitigation

### Validation Crypto

- [ ] Ed25519 utilisé pour signatures
- [ ] Argon2id utilisé pour passwords
- [ ] Pas de secrets en clair

## 📊 Estimation

- Complexité : Low | Medium | High
- Charge : {X} story points
- Durée estimée : {X} jours

## 📝 Epic & Stories

### Epic {X}: {Title}

- **Story {X}-1** : {Title} - {X} points
- **Story {X}-2** : {Title} - {X} points

## ✅ Validation

- [ ] Product Manager : Approuvé
- [ ] UX (si UI) : Approuvé
- [ ] Dev : Architecture validée
- [ ] Security : Risques maîtrisés
```

---

## Template Implementation Artifact

Lors de la création d'un fichier `{epic}-{story}-{title}.md` :

````markdown
# Story {epic}-{story}: {Title}

**Epic** : {Epic Title}
**Status** : backlog | in-progress | review | done
**Assigné à** : Claude Code
**Points** : {X}

---

## 📋 Description

### Contexte

Pourquoi cette story existe et comment elle s'intègre dans l'epic global.

### Objectif

Ce que cette story doit accomplir concrètement.

---

## 🎯 Critères d'Acceptation

- [ ] Critère 1 : Description précise du résultat attendu
- [ ] Critère 2 : Description précise du résultat attendu
- [ ] Critère 3 : Description précise du résultat attendu
- [ ] Tests unitaires ajoutés (coverage > 80%)
- [ ] Tests d'intégration passent
- [ ] Documentation mise à jour

---

## 🏗️ Spécifications Techniques

### Architecture

Description de l'approche technique choisie.

### Fichiers à Modifier

- `apps/agent/src/file1.ts` : Modifications prévues
- `apps/control-plane/src/file2.ts` : Modifications prévues

### Fichiers à Créer

- `apps/agent/src/new-file.ts` : Description du contenu

### Dépendances

- Librairie 1 : Version, raison
- Librairie 2 : Version, raison

### Schéma de Données (si applicable)

```sql
-- Migrations nécessaires
```

---

## 🔒 Considérations Sécurité

- Point de sécurité 1
- Point de sécurité 2
- Validation : [ ] Ed25519 / [ ] Argon2id / [ ] SHA-256+

---

## 🧪 Plan de Tests

### Tests Unitaires

- Test 1 : Description du cas testé
- Test 2 : Description du cas testé

### Tests d'Intégration

- Test 1 : Scénario end-to-end
- Test 2 : Scénario edge-case

### Tests Manuels

- [ ] Scénario 1
- [ ] Scénario 2

---

## 📝 Implémentation

### Fichiers Créés

- `path/to/file1.ts` : Description
- `path/to/file2.ts` : Description

### Fichiers Modifiés

- `path/to/existing.ts` : Nature des modifications

### Déviations du Plan Initial

Description des changements par rapport au plan original et pourquoi.

### Challenges Rencontrés

- Challenge 1 : Comment résolu
- Challenge 2 : Comment résolu

### Tests Ajoutés

- `tests/unit/test1.spec.ts` : Coverage {X}%
- `tests/integration/test2.spec.ts` : Scénarios couverts

---

## ✅ Validation Finale

- [ ] Tous les critères d'acceptation validés
- [ ] Tests unitaires passent (coverage > 80%)
- [ ] Tests d'intégration passent
- [ ] `pnpm security:check` passe
- [ ] Documentation mise à jour
- [ ] Code review effectué (auto-review par Claude)
- [ ] `sprint-status.yaml` mis à jour

**Date de complétion** : {YYYY-MM-DD}
**Committé dans** : {commit-hash}
````

---

## Rôle de Claude Code dans le Projet

Claude agit comme un **développeur senior autonome** avec ces responsabilités :

### 🟢 Autonomie Totale

- ✅ Lire la documentation BMAD avant implémentation
- ✅ Implémenter les stories validées du sprint
- ✅ Écrire et exécuter les tests
- ✅ Mettre à jour les tracking files (`sprint-status.yaml`, implementation artifacts)
- ✅ Commiter et pusher automatiquement avec `pnpm commit:all`
- ✅ Documenter le code en français pour les non-développeurs
- ✅ Refactoriser du code existant si nécessaire (avec plan documenté)
- ✅ Corriger les bugs identifiés dans le code
- ✅ Optimiser les performances si détecté comme nécessaire

### 🟡 Validation Requise

- ⚠️ Proposer de nouvelles fonctionnalités → **Product Manager Agent**
- ⚠️ Modifier l'UI/UX → **UX Agent** (wireframes, design system)
- ⚠️ Changer l'architecture globale → **Product Manager + Dev Agent**
- ⚠️ Ajouter de nouvelles dépendances majeures → **Product Manager + Security Agent**
- ⚠️ Modifier les schémas de base de données → **Dev Agent + validation migration**
- ⚠️ Implémenter des features de sécurité critiques → **Security Agent**

### 🔴 Interdit (JAMAIS)

- ❌ Modifier les secrets (.env, .pem, credentials)
- ❌ Bypasser les security checks
- ❌ Commiter sans mettre à jour `sprint-status.yaml`
- ❌ Utiliser RSA pour les signatures (Ed25519 obligatoire)
- ❌ Utiliser MD5 ou SHA1 pour le hashing
- ❌ Logger des passwords, tokens ou secrets
- ❌ Implémenter une feature sans avoir consulté la documentation BMAD
- ❌ Modifier l'UI sans validation UX Agent

---

## Communication avec les Agents

### Quand Consulter le Product Manager Agent

```bash
# Trigger automatique pour :
- Nouvelle fonctionnalité proposée par l'utilisateur
- Changement de scope d'une feature existante
- Ajout de dépendances majeures
- Modification de l'architecture globale
- Priorisation de bugs vs features
```

**Comment consulter** :

```markdown
@product-manager Je propose d'ajouter la fonctionnalité X.
Peux-tu analyser la faisabilité et créer un plan ?

Contexte : [description du besoin]
Recherches web effectuées : [liens/résumé]
```

### Quand Consulter l'UX Agent

```bash
# Trigger automatique pour :
- Modification de composants UI existants
- Création de nouveaux composants UI
- Refonte d'une page ou d'un workflow
- Questions sur le design system
- Problèmes d'accessibilité
```

**Comment consulter** :

```markdown
@ux-agent J'ai besoin de valider le design pour [composant/page].

Contexte : [description]
Wireframe actuel : [lien ou description]
Questions : [liste des points à valider]
```

### Quand Consulter le Dev Agent

```bash
# Trigger automatique pour :
- Refactoring de code complexe (>400 lignes)
- Architecture technique difficile
- Choix entre plusieurs approches techniques
- Estimation de charge technique
- Review de code complexe
```

**Comment consulter** :

```markdown
@dev-agent J'ai besoin d'aide pour architecturer [feature].

Contexte : [description]
Options considérées : [liste]
Recommendation demandée : [question précise]
```

### Quand Consulter le Security Agent

```bash
# Trigger automatique pour :
- Implémentation d'authentification/autorisation
- Manipulation de données sensibles
- Cryptographie (signatures, encryption)
- Exposition d'API publiques
- Gestion de secrets/credentials
```

**Comment consulter** :

```markdown
@security-agent J'implémente [feature] qui manipule [données sensibles].

Contexte : [description]
Approche cryptographique : [détails]
Validation requise : [points de sécurité]
```

---

## Processus de Résolution de Problèmes

### Debugging Méthodique

Quand un bug ou un problème survient :

1. **Identifier** : Reproduire le problème de manière fiable
2. **Analyser** : Examiner les logs, stack traces, état du système
3. **Hypothèse** : Formuler une hypothèse sur la cause
4. **Tester** : Vérifier l'hypothèse avec des tests ciblés
5. **Corriger** : Implémenter le fix avec tests
6. **Documenter** : Ajouter un commentaire expliquant le bug et le fix

**Template de documentation de bug fix** :

```typescript
/**
 * **FIX BUG #{issue-number}** - {Titre du bug}
 *
 * Problème : Description du bug observé
 * Cause racine : Explication de ce qui causait le bug
 * Solution : Comment le fix résout le problème
 *
 * Avant : [comportement buggé]
 * Après : [comportement correct]
 *
 * @see https://github.com/org/repo/issues/{issue-number}
 */
```

### Gestion des Erreurs

Toujours implémenter une gestion d'erreurs robuste :

```typescript
/**
 * **handleDeployment()** - Gère le processus complet de déploiement
 *
 * Cette fonction orchestre toutes les étapes du déploiement :
 * 1. Vérification des prérequis
 * 2. Préparation de l'environnement
 * 3. Exécution du déploiement
 * 4. Vérification post-déploiement
 *
 * En cas d'erreur à n'importe quelle étape, un rollback automatique
 * est déclenché pour remettre le système dans son état précédent.
 */
async function handleDeployment(config: DeploymentConfig): Promise<DeploymentResult> {
  try {
    // Étape 1 : Vérifications
    await validatePrerequisites(config);

    // Étape 2 : Préparation
    const environment = await prepareEnvironment(config);

    // Étape 3 : Déploiement
    const result = await executeDeployment(environment);

    // Étape 4 : Vérification
    await verifyDeployment(result);

    return result;
  } catch (error) {
    // Log l'erreur de manière sécurisée (sans secrets)
    logger.error({
      operation: 'deployment',
      stage: error.stage,
      message: error.message,
      // JAMAIS de tokens, passwords, ou secrets dans les logs
    });

    // Tentative de rollback automatique
    try {
      await rollbackDeployment(config);
      logger.info('Rollback successful');
    } catch (rollbackError) {
      logger.error('Rollback failed', { error: rollbackError.message });
    }

    // Remonte l'erreur avec un message clair pour l'utilisateur
    throw new DeploymentError('Le déploiement a échoué. Un rollback automatique a été effectué.', {
      originalError: error,
    });
  }
}
```

---

## Standards de Qualité

### Code Review Auto-Checklist

Avant de commiter, Claude doit s'auto-reviewer :

#### ✅ Sécurité

- [ ] Aucun secret en dur dans le code
- [ ] Ed25519 pour signatures (pas RSA)
- [ ] Argon2id pour passwords (pas bcrypt)
- [ ] SHA-256+ pour hashing (pas MD5/SHA1)
- [ ] Validation des entrées utilisateur
- [ ] Échappement des sorties (XSS prevention)
- [ ] Pas de logs de données sensibles

#### ✅ Performance

- [ ] Pas de boucles imbriquées inefficaces
- [ ] Requêtes DB optimisées (indexes, limits)
- [ ] Pas de memory leaks évidents
- [ ] Utilisation appropriée de cache si applicable

#### ✅ Maintenabilité

- [ ] En-tête de fichier présent et complet
- [ ] Commentaires en français pour les non-devs
- [ ] Fonctions < 50 lignes (sauf exceptions justifiées)
- [ ] Fichier < limite recommandée (300-600 lignes selon type)
- [ ] Noms de variables/fonctions explicites
- [ ] Pas de code dupliqué (DRY principle)

#### ✅ Tests

- [ ] Tests unitaires pour la nouvelle logique
- [ ] Coverage > 80% pour les nouveaux fichiers
- [ ] Tests d'intégration si feature end-to-end
- [ ] Edge cases testés

#### ✅ Documentation

- [ ] README mis à jour si changement d'API publique
- [ ] `sprint-status.yaml` mis à jour
- [ ] Implementation artifact mis à jour
- [ ] CHANGELOG.md mis à jour si version release

---

## Standards de Nommage

### Fichiers et Dossiers

```
kebab-case.ts          # Fichiers TypeScript/JavaScript
PascalCase.vue         # Composants Vue
kebab-case.spec.ts     # Fichiers de tests
SCREAMING_SNAKE.md     # Fichiers de config (README, CHANGELOG)
```

### Code

```typescript
// Classes et Types : PascalCase
class DeploymentService {}
interface ServerConfig {}
type DeploymentStatus = 'pending' | 'running' | 'done';

// Fonctions et Variables : camelCase
function executeDeployment() {}
const serverUrl = 'https://...';

// Constantes : SCREAMING_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 5000;

// Noms en français pour la clarté
const nombreDeServeurs = servers.length; // ✅ OK
const nbSrv = servers.length; // ❌ Éviter les abréviations obscures
```

---

## Gestion des Versions et Releases

### Semantic Versioning

Le projet suit SemVer : `MAJOR.MINOR.PATCH`

- **MAJOR** : Breaking changes (incompatibilité API)
- **MINOR** : Nouvelles features (compatible backward)
- **PATCH** : Bug fixes (compatible backward)

### CHANGELOG.md

Toujours mettre à jour lors d'une release :

```markdown
# Changelog

## [Unreleased]

### Added

- Feature X implémentée (#123)

### Changed

- Amélioration de Y (#124)

### Fixed

- Bug Z corrigé (#125)

### Security

- Upgrade de dépendance vulnérable (#126)

## [1.2.0] - 2025-01-25

### Added

- Multi-runtime support (Node, Bun, Deno)
  ...
```

---

## Bonnes Pratiques Spécifiques

### WebSocket Communication

```typescript
/**
 * **sendCommand()** - Envoie une commande au Control Plane
 *
 * Cette fonction envoie une commande de manière sécurisée via WebSocket.
 * Elle gère automatiquement :
 * - La sérialisation JSON sécurisée
 * - Le timeout de 30 secondes
 * - La reconnexion automatique si la connexion est perdue
 *
 * Important : Ne jamais envoyer de secrets dans les commandes,
 * utiliser plutôt des références (IDs) qui seront résolues côté serveur.
 */
async function sendCommand(command: Command): Promise<CommandResult> {
  // Validation : pas de secrets dans la commande
  if (containsSensitiveData(command)) {
    throw new SecurityError('Command contains sensitive data');
  }

  // Envoi avec timeout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new TimeoutError()), 30000),
  );

  const sendPromise = this.ws.send(JSON.stringify(command));

  return Promise.race([sendPromise, timeoutPromise]);
}
```

### Database Migrations

```typescript
/**
 * **Migration YYYY-MM-DD-description** - Description de la migration
 *
 * Cette migration ajoute/modifie/supprime [tables/colonnes].
 *
 * Raison : Pourquoi cette migration est nécessaire
 * Impact : Quelles données/tables sont affectées
 * Rollback : Comment revenir en arrière si nécessaire
 */
export async function up(db: Database): Promise<void> {
  // Migration SQL ici
  await db.execute(`
    ALTER TABLE servers 
    ADD COLUMN last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
  `);
}

export async function down(db: Database): Promise<void> {
  // Rollback SQL ici
  await db.execute(`
    ALTER TABLE servers 
    DROP COLUMN last_heartbeat
  `);
}
```

### Environment Variables

```typescript
/**
 * **loadConfig()** - Charge la configuration depuis les variables d'environnement
 *
 * Cette fonction lit les variables d'environnement et les valide.
 * Si une variable obligatoire manque, l'application refuse de démarrer
 * plutôt que de fonctionner avec une config incomplète.
 *
 * Variables obligatoires :
 * - CONTROL_PLANE_URL : URL du serveur central
 * - AGENT_TOKEN : Token secret de l'agent
 * - DATABASE_PATH : Chemin vers la base SQLite
 */
function loadConfig(): Config {
  const requiredVars = ['CONTROL_PLANE_URL', 'AGENT_TOKEN', 'DATABASE_PATH'];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new ConfigError(`Missing required env var: ${varName}`);
    }
  }

  return {
    controlPlaneUrl: process.env.CONTROL_PLANE_URL,
    agentToken: process.env.AGENT_TOKEN,
    databasePath: process.env.DATABASE_PATH,
    // Valeurs par défaut pour les optionnelles
    logLevel: process.env.LOG_LEVEL || 'info',
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  };
}
```

---

## Résumé des Commandes Essentielles

```bash
# Développement
pnpm dev                    # Démarre tous les services en mode dev
pnpm dev:agent             # Démarre uniquement l'agent
pnpm dev:control-plane     # Démarre uniquement le control plane
pnpm dev:dashboard         # Démarre uniquement le dashboard

# Tests
pnpm test                  # Lance tous les tests
pnpm test:watch            # Tests en mode watch
pnpm test:coverage         # Tests avec rapport de coverage
pnpm security:check        # Validation sécurité

# Build
pnpm build                 # Build tous les packages
pnpm build:agent           # Build uniquement l'agent
pnpm build:control-plane   # Build uniquement le control plane
pnpm build:dashboard       # Build uniquement le dashboard

# Git (IMPORTANT)
pnpm commit:all            # Commit + push automatique (À UTILISER)

# Autres
pnpm lint                  # Linting du code
pnpm format                # Formatage avec Prettier
pnpm clean                 # Nettoie les builds
```

---

## Lancement des Serveurs de Dev

### Scripts de Démarrage (Recommandé)

Des scripts sont disponibles à la racine du projet pour lancer/arrêter les serveurs facilement :

| Fichier         | Usage                                     |
| --------------- | ----------------------------------------- |
| `start-dev.bat` | **Double-clic** pour lancer les serveurs  |
| `start-dev.ps1` | Version PowerShell (via terminal)         |
| `stop-dev.bat`  | **Double-clic** pour arrêter les serveurs |
| `stop-dev.ps1`  | Version PowerShell (via terminal)         |

**Pour lancer les serveurs** :

- Double-clic sur `start-dev.bat`
- Ou dans PowerShell : `.\start-dev.ps1`

Les scripts font automatiquement :

1. Libération des ports 3000 et 5173 s'ils sont occupés
2. Lancement du Control Plane dans une fenêtre (port 3000)
3. Lancement du Dashboard dans une autre fenêtre (port 5173)

**URLs des serveurs** :

- Control Plane : http://localhost:3000
- Dashboard : http://localhost:5173

### Redémarrage Automatique par Claude (OBLIGATOIRE)

**CRITIQUE** : Après avoir créé/mis à jour un bundle agent ou modifié du code backend, Claude DOIT **AUTOMATIQUEMENT** redémarrer les serveurs de dev sans demander à l'utilisateur.

#### Quand Redémarrer

- ✅ Après création d'un nouveau bundle agent (`agent-bundle.tar.gz`)
- ✅ Après modification du control-plane (`apps/control-plane/`)
- ✅ Après modification du dashboard (`apps/dashboard/`)
- ✅ Quand l'utilisateur dit que le dashboard/API ne répond pas
- ✅ Après un `pnpm build` complet

#### Procédure de Redémarrage (Windows - pour Claude)

```bash
# 1. Trouver les processus sur les ports 3000 et 5173
netstat -ano | findstr ":3000 :5173"

# 2. Tuer les processus via cmd (pour éviter les problèmes Git Bash)
cmd //c "taskkill /PID <PID_PORT_3000> /F"
cmd //c "taskkill /PID <PID_PORT_5173> /F"

# 3. Redémarrer les serveurs (en background)
pnpm --filter @server-flow/control-plane dev  # En background
pnpm --filter @server-flow/dashboard dev       # En background
```

#### Rappel Important

**Ne JAMAIS demander à l'utilisateur** s'il veut redémarrer les serveurs. C'est automatique.

L'utilisateur ne devrait JAMAIS avoir à dire : "redémarre les serveurs".

---

## Pièges à Éviter (OBLIGATOIRE)

**IMPORTANT** : Avant de modifier du code côté agent/serveur, **TOUJOURS consulter** :

📄 **`docs/AGENT-GOTCHAS.md`** - Liste des erreurs courantes et pièges à éviter

Ce fichier documente les problèmes rencontrés et leurs solutions, comme :

- Erreur `getcwd() failed` lors de l'utilisation de `cd` dans `execAsync`
- Problèmes de chemins relatifs vs absolus
- Gestion des processus enfants et du répertoire courant
- Pièges spécifiques à Linux/systemd

**Règle d'or** : Si tu modifies du code qui exécute des commandes shell sur le serveur, consulte ce fichier AVANT d'écrire du code.

---

## Désinstallation de Packages Linux (CRITIQUE)

**IMPORTANT** : Quand tu écris du code pour désinstaller des packages avec `apt-get remove` ou `apt-get purge`, fais attention aux **métapackages** !

### Le Problème des Métapackages

Sur Debian/Ubuntu, certains packages sont des **métapackages** : ils ne contiennent pas de binaires eux-mêmes, mais dépendent d'autres packages qui contiennent les vrais fichiers.

**Exemple avec ProFTPD** :

- `proftpd` = métapackage (vide, juste des dépendances)
- `proftpd-basic` = contient le binaire `/usr/sbin/proftpd`
- `proftpd-core` = librairies core

Si tu fais `apt-get remove proftpd`, seul le métapackage est supprimé, mais **le binaire reste** car `proftpd-basic` n'est pas supprimé !

### Règle d'Or

**TOUJOURS supprimer TOUS les packages associés**, pas juste le package principal.

### Exemples Corrects

```bash
# ❌ INCORRECT - ne supprime que le métapackage
apt-get remove -y proftpd

# ✅ CORRECT - supprime tout
apt-get remove -y proftpd proftpd-basic proftpd-core
```

```bash
# ❌ INCORRECT
apt-get remove -y postgresql

# ✅ CORRECT
apt-get remove -y postgresql postgresql-contrib postgresql-common postgresql-client-common 'postgresql-*'
```

### Packages Connus avec ce Problème

| Package       | Métapackage            | Packages à supprimer                                                                                                                         |
| ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ProFTPD       | `proftpd`              | `proftpd`, `proftpd-basic`, `proftpd-core`                                                                                                   |
| PostgreSQL    | `postgresql`           | `postgresql`, `postgresql-contrib`, `postgresql-common`, `postgresql-client-common`, `postgresql-*`                                          |
| MySQL/MariaDB | `default-mysql-server` | `default-mysql-server`, `default-mysql-client`, `mariadb-server`, `mariadb-client`, `mariadb-common`, `mysql-common`, `mysql-*`, `mariadb-*` |
| PHP           | `php`                  | `php`, `php-fpm`, `php-cli`, `php-common`, `php-*`                                                                                           |

### Comment Vérifier

Pour trouver tous les packages installés d'un logiciel :

```bash
dpkg -l | grep proftpd
dpkg -l | grep postgresql
```

Pour voir quel package fournit un binaire :

```bash
dpkg -S /usr/sbin/proftpd
# Résultat: proftpd-basic: /usr/sbin/proftpd
```

---

## TODO Futur : Gestion des Comptes FTP

**Note pour développement futur** : Quand on implémentera la création des comptes FTP depuis le dashboard :

1. **Stockage local sur l'agent** : Les comptes FTP seront stockés dans un fichier JSON sur le serveur de l'agent (ex: `/opt/serverflow/ftp-accounts.json`)

2. **Synchronisation automatique** : Quand on change de serveur FTP (vsftpd ↔ ProFTPD), l'agent devra automatiquement recréer les comptes FTP à partir de ce fichier JSON

3. **Structure suggérée** :

```json
{
  "accounts": [
    {
      "username": "user1",
      "homeDir": "/home/ftp/user1",
      "createdAt": "2025-01-26T...",
      "permissions": "rw"
    }
  ]
}
```

4. **Comportement** :
   - À l'installation d'un nouveau serveur FTP → lire le JSON et recréer tous les comptes
   - Les mots de passe seront regénérés (ou stockés hashés dans le JSON)
   - Notifier le dashboard des nouveaux credentials si nécessaire

**Story à créer** : Epic 7, Story "FTP Account Management"

---

## Mécanisme de Mise à Jour de l'Agent (CRITIQUE)

**OBLIGATOIRE** : Avant de modifier QUOI QUE CE SOIT lié à :

- La structure du bundle agent (`apps/agent/bundle/`)
- Le fichier `agent-bundle.tar.gz`
- Le processus `UPDATE_AGENT` dans `apps/agent/src/index.ts`
- Le fichier systemd de l'agent
- Les chemins d'installation de l'agent

**Tu DOIS consulter** :

📄 **`docs/AGENT-UPDATE-MECHANISM.md`** - Documentation COMPLÈTE du système de mise à jour

Ce document explique :

- La structure exacte du bundle (plate vs imbriquée)
- Le flux complet de mise à jour automatique
- Comment le fichier systemd est géré
- La procédure de création d'un nouveau bundle
- Les erreurs courantes et leurs solutions
- L'historique des problèmes rencontrés

### Checklist Avant Modification du Bundle

- [ ] J'ai lu `docs/AGENT-UPDATE-MECHANISM.md`
- [ ] Je comprends la structure plate actuelle du bundle
- [ ] Je sais que les agents DÉJÀ déployés doivent pouvoir migrer
- [ ] J'ai vérifié que le fichier systemd sera mis à jour automatiquement
- [ ] J'ai testé la mise à jour sur un serveur réel

### Erreurs qui ont déjà coûté cher

1. **Changement de structure sans migration** : Passer de `apps/agent/dist/` à `dist/` a cassé tous les agents déployés car le fichier systemd pointait vers l'ancien chemin.

2. **Oublier `@server-flow/shared`** : Le package shared doit être COPIÉ dans `node_modules/@server-flow/shared/`, pas en symlink pnpm.

3. **`workspace:*` dans le bundle** : Le package.json du bundle ne doit PAS avoir de dépendances `workspace:*`, ça ne fonctionne qu'en dev.

**Ne JAMAIS improviser sur le système de mise à jour. Toujours consulter la doc.**

---

## Gestionnaire de Templates de Configuration (OBLIGATOIRE)

**IMPORTANT** : Toutes les configurations de services doivent utiliser le **gestionnaire de templates** au lieu d'être hardcodées dans le code TypeScript.

### Emplacement des Templates

Les fichiers de templates sont dans :

```
apps/agent/src/infrastructure/templates/
├── bind9/          # DNS BIND9
├── clamav/         # Antivirus ClamAV
├── dovecot/        # IMAP/POP3
├── fail2ban/       # Protection brute-force
├── haproxy/        # Load balancer
├── nginx/          # Web server / Reverse proxy
├── opendkim/       # DKIM email signing
├── postfix/        # Mail server SMTP
├── redis/          # Cache / DB Redis
├── rspamd/         # Antispam
└── ufw/            # Firewall
```

### Syntaxe des Templates

Les templates utilisent une syntaxe simple de type Mustache/Handlebars :

```
{{ variable }}                    # Variable simple
{{ variable | default:valeur }}   # Variable avec valeur par défaut
{{#if variable}}...{{/if}}        # Condition
{{#unless variable}}...{{/unless}}# Condition négative
{{#each items}}...{{/each}}       # Boucle
```

### Comment Utiliser

**Dans le code TypeScript** (`apps/agent/src/infrastructure/installers/services/*.ts`) :

```typescript
import { writeConfig } from '../../template-manager.js';

// Écrire un fichier de configuration depuis un template
writeConfig('postfix/main.cf', '/etc/postfix/main.cf', {
  hostname: 'mail.example.com',
  domain: 'example.com',
});

// Avec options
writeConfig(
  'fail2ban/jail.local',
  '/etc/fail2ban/jail.local',
  {
    bantime: '1h',
    maxretry: 5,
  },
  { append: true, mode: 0o644 },
);
```

### Règles OBLIGATOIRES

1. **JAMAIS de configuration hardcodée** : Ne pas écrire de strings de configuration directement dans le code TypeScript

   ```typescript
   // ❌ INTERDIT
   const config = `[DEFAULT]
   bantime = 1h
   maxretry = 5`;
   fs.writeFileSync('/etc/fail2ban/jail.local', config);

   // ✅ CORRECT
   writeConfig('fail2ban/jail.local', '/etc/fail2ban/jail.local', {
     bantime: '1h',
     maxretry: 5,
   });
   ```

2. **Créer un template pour chaque nouveau service** : Si tu installes un nouveau service qui nécessite une configuration, crée d'abord le template

3. **Nommage des fichiers templates** :
   - Utiliser `.conf` comme extension
   - Nom du fichier = nom de la config cible (ex: `main.cf.conf` pour `/etc/postfix/main.cf`)

4. **Documenter les variables** : Ajouter un commentaire en haut du template listant les variables utilisées

### Créer un Nouveau Template

1. Créer le fichier dans `apps/agent/src/infrastructure/templates/{service}/`
2. Ajouter le mapping dans `TEMPLATE_FILE_MAP` de `template-manager.ts` si nécessaire
3. Utiliser `writeConfig()` dans l'installateur du service
4. Tester le rendu avec différentes valeurs de variables

### Après Modification des Templates

**OBLIGATOIRE** : Après avoir modifié ou ajouté des templates, il faut recréer le bundle :

```bash
cd apps/agent
pnpm build                    # Compile + copie les templates dans dist/
cd bundle
rm -rf dist && cp -r ../dist .  # Met à jour le bundle
cd ../../..
# Recréer le tar.gz
cd apps/agent/bundle && tar -czf ../../control-plane/public/agent-bundle.tar.gz .
```

---

## En Cas de Doute

Si Claude n'est pas sûr de quelque chose :

1. **Consulter la documentation BMAD** dans `_bmad-output/`
2. **Chercher dans le code existant** des patterns similaires
3. **Consulter l'agent approprié** (PM, UX, Dev, Security)
4. **Documenter l'incertitude** dans les commentaires
5. **Demander clarification à l'utilisateur** si vraiment bloqué

**Ne jamais deviner ou improviser sur** :

- La sécurité (crypto, auth)
- L'architecture globale
- Les schémas de base de données
- Les contrats d'API publiques

---

## Philosophie Générale

- **Code for humans** : Le code est lu 10x plus qu'il n'est écrit
- **Security by default** : La sécurité n'est pas optionnelle
- **Test early, test often** : Les bugs coûtent moins cher tôt
- **Document as you go** : La documentation n'est jamais "pour plus tard"
- **Keep it simple** : La solution la plus simple est souvent la meilleure
- **Fail fast** : Mieux vaut planter rapidement qu'échouer silencieusement

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2025-01-25  
**Maintenu par** : Adrien (Product Owner) + Claude Code (Dev Senior)
