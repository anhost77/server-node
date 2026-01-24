# 🔍 Réconciliation BMAD - Fonctionnalités Manquantes

**Date:** 2026-01-24  
**Contexte:** Audit des fonctionnalités implémentées vs spécifications BMAD originales

## ❌ Fonctionnalités Manquantes Critiques

### 1. **Authentification & Comptes Utilisateurs**
**Status:** ✅ IMPLÉMENTÉ
**Spécification BMAD:** Epic 5 - SaaS Governance
- [x] Connexion via OAuth (GitHub)
- [x] Gestion de sessions utilisateur
- [x] Base de données Drizzle ORM (SQLite dev / PostgreSQL prod)
- [x] Multi-tenancy (`ownerId` sur toutes les tables)

**Implémenté:** GitHub OAuth, sessions httpOnly, schéma multi-tenant complet.

---

### 2. **Console Logs en Temps Réel**
**Status:** ✅ IMPLÉMENTÉ
- [x] Vue dédiée Console avec logs en temps réel
- [x] Streaming continu des logs système via WebSocket
- [x] Filtrage par type de log (stdout/stderr/system)

**Implémenté:** Monitor.ts sur l'agent, streaming WebSocket, affichage dashboard.

---

### 3. **Boutons de Contrôle des Services**
**Status:** ✅ IMPLÉMENTÉ
**Implémenté:**
- [x] Start/Stop/Restart pour les **applications** (via PM2)
- [x] Boutons UI en place dans le dashboard (Nginx + PM2)
- [x] Logique WebSocket SERVICE_ACTION branchée
- [x] Handler côté agent pour restart Nginx/PM2
- [x] Retour status en temps réel + activity logging

**Spécification BMAD:** FR4 - Auto-Fix critical services

---

### 4. **IA Sysadmin (MCP Integration Avancée)**
**Status:** ✅ IMPLÉMENTÉ
**Implémenté:**
- [x] MCP Server v0.2.0 avec 7 outils
- [x] `list_servers` - Liste des serveurs
- [x] `list_apps` - Liste des applications
- [x] `deploy_app` - Déclencher un déploiement
- [x] `app_action` - Start/Stop/Restart app
- [x] `restart_service` - Restart Nginx/PM2
- [x] `get_activity_logs` - Logs d'activité
- [x] `provision_domain` - Provisionner domaine
- [x] Dry-Run mode sur toutes les actions destructives
- [x] Token MCP pour authentification

**Spécification BMAD:**
- FR6: MCP Chat - Natural Language deployment ✅
- FR7: Dry Run check before destructive commands ✅

---

### 5. **Git OAuth & Webhook Integration**
**Status:** ✅ IMPLÉMENTÉ
**Implémenté:**
- [x] Endpoint `/api/webhooks/github` avec HMAC signature
- [x] OAuth connection avec GitHub
- [x] Vérification de signature webhook (HMAC sha256)
- [x] Auto-déploiement sur push (main/master)
- [x] Activity logging pour webhook deploys

**Manquant (Post-MVP):**
- [ ] Support GitLab webhooks
- [ ] Interface UI pour configurer webhooks

**Spécification BMAD:**
- FR5: Git Push triggers deployment ✅
- Epic 2: "Transform a Git Push into a live HTTPS URL automatically" ✅

---

### 6. **Hot-Path Diffing (Optimisation Build)**
**Status:** IMPLÉMENTÉ MAIS INCOMPLET  
**Implémenté:**
- ✅ `DiffAnalyzer.shouldSkipBuild()` existe

**Manquant:**
- [ ] Logique réelle d'analyse de diff
- [ ] Détection des changements non-code (README, docs)
- [ ] Cache intelligent des builds

**Spécification BMAD:** 
- FR3: Hot Patch code via WebSocket (<2s)
- Epic 3: Real-Time Resilience

---

### 7. **Audit Logs Structurés**
**Status:** BASIQUE IMPLÉMENTÉ  
**Implémenté:**
- ✅ `addAuditLog()` fonction
- ✅ Stockage dans `audit-logs.json`
- ✅ Vue "Activity" dans Dashboard

**Manquant:**
- [ ] Logs immutables (NFR2: retained for 1 year)
- [ ] Filtrage avancé (par type, date, serveur)
- [ ] Export des logs (CSV, JSON)
- [ ] Recherche full-text
- [ ] Intégration avec systèmes externes (Sentry, DataDog)

**Spécification BMAD:** 
- NFR2: Command logs must be immutable
- FR10: Central audit log (Pro Plan feature)

---

### 8. **Teams & RBAC**
**Status:** NON IMPLÉMENTÉ  
**Spécification BMAD:** Epic 5 - Story 5.1
- [ ] Inviter des membres
- [ ] Rôles (Owner/Viewer/Admin)
- [ ] Permissions granulaires
- [ ] Audit des actions par utilisateur

---

### 9. **Internationalisation (i18n)**
**Status:** NON IMPLÉMENTÉ  
**Spécification BMAD:** Epic 5 - Story 5.2
- [ ] Support Français/Anglais
- [ ] Sélecteur de langue dans Settings
- [ ] Traductions complètes de l'interface

---

### 10. **Base de Données PostgreSQL**
**Status:** ✅ IMPLÉMENTÉ
- [x] Drizzle ORM configuré
- [x] SQLite pour dev, PostgreSQL pour prod
- [x] Multi-tenancy via `ownerId`
- [x] Schéma complet: users, accounts, sessions, nodes, proxies, apps, activityLogs

**Fichiers:** [schema.ts](apps/control-plane/src/db/schema.ts), [index.ts](apps/control-plane/src/db/index.ts)

---

## 📊 Récapitulatif

| Fonctionnalité | Status | Priorité | Epic |
|----------------|--------|----------|------|
| Auth OAuth | ✅ Fait | ✅ Terminé | Epic 5 |
| Console Logs | ✅ Fait | ✅ Terminé | Epic 1 |
| Service Controls | ✅ Fait (Nginx + PM2) | ✅ Terminé | Epic 3 |
| IA Sysadmin (MCP) | ✅ Fait (7 outils + dry-run) | ✅ Terminé | Epic 4 |
| Git OAuth + Webhook | ✅ Fait (HMAC + auto-deploy) | ✅ Terminé | Epic 2 |
| Hot-Path Diffing | 🟡 Incomplet | 🟢 Nice-to-have | Epic 3 |
| Audit Logs | 🟡 Basique | 🟢 Nice-to-have | Epic 4 |
| Teams/RBAC | ❌ Manquant | 🟢 Post-MVP | Epic 5 |
| i18n | ❌ Manquant | 🟢 Post-MVP | Epic 5 |
| PostgreSQL | ✅ Fait (Drizzle ORM + SQLite/PostgreSQL) | ✅ Terminé | Architecture |

---

## 🎯 Plan d'Action Recommandé

### Phase 1: ✅ TERMINÉ
1. ~~**Restaurer la Console Logs**~~ ✅
2. ~~**Migration PostgreSQL**~~ ✅ (Drizzle ORM)
3. ~~**Auth OAuth GitHub**~~ ✅

### Phase 2: ✅ TERMINÉ
4. ~~**Brancher les boutons Service Controls**~~ ✅ (Nginx + PM2)
5. ~~**Git Webhook Complet**~~ ✅ (HMAC + auto-deploy main/master)
6. ~~**Améliorer MCP**~~ ✅ (7 outils + dry-run mode)

### Phase 3: Fonctionnalités Avancées (Post-MVP)
7. **Teams & RBAC**
8. **Internationalisation**
9. **Hot-Path Diffing complet**

---

## 💬 Questions pour Priorisation

1. **Auth OAuth** - Voulez-vous GitHub, GitLab, ou les deux ?
2. **Console Logs** - Faut-il afficher les logs système (syslog, journalctl) ou seulement les logs d'application ?
3. **Service Controls** - Quels services doivent être contrôlables ? (Nginx, PM2, PostgreSQL, Redis, Docker ?)
4. **IA Sysadmin** - Quelles sont les 5 commandes les plus importantes à supporter en langage naturel ?

---

**Prochaine étape suggérée:** Commencer par restaurer la Console Logs et ajouter les Service Controls, car ce sont des fonctionnalités visibles et critiques pour l'UX.
