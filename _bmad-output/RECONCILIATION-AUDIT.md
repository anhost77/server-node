# 🔍 Réconciliation BMAD - Fonctionnalités Manquantes

**Date:** 2026-01-24  
**Contexte:** Audit des fonctionnalités implémentées vs spécifications BMAD originales

## ❌ Fonctionnalités Manquantes Critiques

### 1. **Authentification & Comptes Utilisateurs**
**Status:** NON IMPLÉMENTÉ  
**Spécification BMAD:** Epic 5 - SaaS Governance
- [ ] Connexion via OAuth (GitHub, GitLab, Google)
- [ ] Gestion de sessions utilisateur
- [ ] Base de données PostgreSQL + Drizzle ORM
- [ ] Multi-tenancy (`project_id` sur toutes les tables)

**Impact:** Actuellement, pas de système d'authentification. Le dashboard est accessible sans login.

---

### 2. **Console Logs en Temps Réel**
**Status:** PARTIELLEMENT IMPLÉMENTÉ  
**Problème identifié:** La vue "Infrastructure" affiche les logs de déploiement, mais :
- [ ] Pas de vue dédiée "Console" pour voir les logs d'un serveur spécifique
- [ ] Pas de streaming continu des logs système
- [ ] Pas de filtrage par type de log (stdout/stderr/system)

**Spécification BMAD:** 
- UX Design: Custom `<TerminalBlock>` et `<LogStream>` avec virtual scrolling
- Dashboard doit afficher les logs en temps réel via WebSocket

**Action requise:** Restaurer/améliorer la vue Console avec :
```vue
<TerminalBlock 
  :serverId="selectedServerId" 
  :autoScroll="true"
  :filter="['stdout', 'stderr', 'system']"
/>
```

---

### 3. **Boutons de Contrôle des Services**
**Status:** PARTIELLEMENT IMPLÉMENTÉ  
**Implémenté:**
- ✅ Start/Stop/Restart pour les **applications** (via PM2)

**Manquant:**
- [ ] Contrôle des **services système** (Nginx, PostgreSQL, Redis, etc.)
- [ ] Bouton "Restart Nginx" visible dans l'interface
- [ ] Bouton "Restart All Services"
- [ ] Status en temps réel des services système

**Spécification BMAD:** FR4 - Auto-Fix critical services
- Dashboard doit permettre de redémarrer Nginx/PM2 manuellement
- "Mobile Emergency Mode" avec actions critiques (Restart/Rollback)

**Action requise:** Ajouter une section "System Services" dans Infrastructure :
```
┌─────────────────────────────┐
│ System Services             │
├─────────────────────────────┤
│ ● Nginx        [Restart]    │
│ ● PM2          [Restart]    │
│ ● PostgreSQL   [Restart]    │
└─────────────────────────────┘
```

---

### 4. **IA Sysadmin (MCP Integration Avancée)**
**Status:** BASIQUE IMPLÉMENTÉ  
**Implémenté:**
- ✅ MCP Server avec outils `list_servers` et `deploy_app`

**Manquant:**
- [ ] Commandes en langage naturel complexes
- [ ] "Deploy docker-compose.prod.yml with persistent volumes"
- [ ] Auto-Fix via IA (détection d'erreurs et correction automatique)
- [ ] Dry-Run mode (simulation avant exécution)
- [ ] Confirmation utilisateur pour actions destructives

**Spécification BMAD:** 
- FR6: MCP Chat - Natural Language deployment
- FR7: Dry Run check before destructive commands
- Journey 2: "Uses MCP Chat to request complex deployments"

**Action requise:** Améliorer le MCP Server :
```typescript
// Exemples de commandes IA à supporter :
"Restart nginx on server prod-01"
"Show me the last 100 lines of error logs"
"Deploy my-app to production with blue-green strategy"
"Rollback to previous version"
```

---

### 5. **Git OAuth & Webhook Integration**
**Status:** PARTIELLEMENT IMPLÉMENTÉ  
**Implémenté:**
- ✅ Endpoint `/api/webhooks/github` (basique)

**Manquant:**
- [ ] OAuth connection avec GitHub/GitLab
- [ ] Interface pour connecter un repo Git
- [ ] Vérification de signature webhook (HMAC)
- [ ] Support GitLab webhooks
- [ ] Auto-déploiement sur push (actuellement manuel)

**Spécification BMAD:** 
- FR5: Git Push triggers deployment
- Epic 2: "Transform a Git Push into a live HTTPS URL automatically"

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
**Status:** NON IMPLÉMENTÉ  
**Actuel:** Stockage en fichiers JSON (`servers.json`, `apps.json`)

**Spécification BMAD:**
- Architecture: Drizzle ORM + PostgreSQL
- Multi-tenancy via `project_id`
- RLS (Row Level Security)

**Impact:** Limite la scalabilité et les fonctionnalités avancées (recherche, relations, transactions)

---

## 📊 Récapitulatif

| Fonctionnalité | Status | Priorité | Epic |
|----------------|--------|----------|------|
| Auth OAuth | ❌ Manquant | 🔴 Critique | Epic 5 |
| Console Logs | 🟡 Partiel | 🔴 Critique | Epic 1 |
| Service Controls | 🟡 Partiel | 🟠 Important | Epic 3 |
| IA Sysadmin | 🟡 Basique | 🟠 Important | Epic 4 |
| Git OAuth | 🟡 Partiel | 🟠 Important | Epic 2 |
| Hot-Path Diffing | 🟡 Incomplet | 🟢 Nice-to-have | Epic 3 |
| Audit Logs | 🟡 Basique | 🟢 Nice-to-have | Epic 4 |
| Teams/RBAC | ❌ Manquant | 🟢 Post-MVP | Epic 5 |
| i18n | ❌ Manquant | 🟢 Post-MVP | Epic 5 |
| PostgreSQL | ❌ Manquant | 🟠 Important | Architecture |

---

## 🎯 Plan d'Action Recommandé

### Phase 1: Corrections Critiques (Cette Session)
1. **Restaurer la Console Logs** - Vue dédiée avec streaming temps réel
2. **Ajouter les boutons Service Controls** - Restart Nginx/PM2 depuis UI
3. **Améliorer MCP** - Commandes naturelles + Dry-Run mode

### Phase 2: Fondations Manquantes (Prochaine Session)
4. **Implémenter Auth OAuth** - GitHub/GitLab login
5. **Migration PostgreSQL** - Remplacer JSON par Drizzle ORM
6. **Git Webhook Complet** - Auto-deploy sur push

### Phase 3: Fonctionnalités Avancées
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
