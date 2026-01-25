# ServerFlow Roadmap 2026 - Q1 à Q3

**Date:** Janvier 2026
**Approche:** Hybride (intégrations externes + self-hosted)

---

## Philosophie

Pour chaque service, proposer **deux options** :
- **Option A** : Intégration externe (Cloudflare, S3, Resend) - Simple, rapide
- **Option B** : Self-hosted (PowerDNS, backup server, Postfix) - Indépendance totale

---

## TIER 0 - SÉCURITÉ (Priorité Critique)

| Feature | Effort | Status |
|---------|--------|--------|
| **Agent Authentication** (Ed25519 signatures bidirectionnelles) | 2j | IN PROGRESS |

**Approche:** Ed25519 (déjà partiellement implémenté) au lieu de RSA 4096
- CP vérifie signature agent (challenge/response)
- CP signe ses commandes (DEPLOY, APP_ACTION, etc.)
- Agent vérifie signatures avant exécution
- Anti-replay (nonce + timestamp)
- UI admin pour rotation des clés (CP + agents)

Spec: [security-agent-authentication.md](security-agent-authentication.md)

---

## TIER 1 - Q1 2026 (Fondations) ~40-45 jours

| # | Feature | Effort | Priorité | Description |
|---|---------|--------|----------|-------------|
| 1 | **Sous-domaines automatiques** | 5-7j | P0 | `*.serverflow.app` pour chaque serveur |
| 2 | **CRON Jobs** | 6-8j | P0 | Gestion des tâches planifiées via agent |
| 3 | **Agent Scriptable** | 8-10j | P1 | Actions prédéfinies sécurisées |
| 4 | **Safe Config Mode** | 5-6j | P1 | Rollback automatique si config échoue |
| 5 | **Système de Backups** | 10-12j | P1 | Serveur dédié (rsync) OU S3/Backblaze |

### Détails Q1

#### 1. Sous-domaines automatiques
- DNS wildcard `*.serverflow.app`
- Certificat wildcard Let's Encrypt
- Auto-assignation à chaque serveur enregistré
- Format: `{server-alias}.serverflow.app` (ex: `mon-serveur.serverflow.app`)
- L'utilisateur route ses apps via Nginx sur ce domaine (ports/paths)

#### 2. CRON Jobs
- UI création/édition de cron jobs
- Agent configure `/etc/cron.d/serverflow`
- Historique d'exécution
- Notifications en cas d'échec

#### 3. Agent Scriptable
- Registry d'actions prédéfinies (system.update, app.clear-cache, etc.)
- Sandbox d'exécution sécurisé
- Timeout et limites mémoire
- Pas de scripts arbitraires (sécurité)

#### 4. Safe Config Mode
- Snapshot avant modification
- Timeout de confirmation (2 min)
- Rollback automatique si pas de confirmation
- Tests de validation post-modification

#### 5. Système de Backups
**Option A - Cloud:**
- S3, Backblaze B2
- Configuration simple

**Option B - Self-hosted:**
- Serveur dédié "backup"
- rsync over SSH
- Rétention configurable (daily/weekly/monthly)
- UI explorateur de backups

---

## TIER 2 - Q2 2026 (Expansion) ~40-50 jours

| # | Feature | Effort | Priorité | Description |
|---|---------|--------|----------|-------------|
| 6 | **Docker Runtime** | 12-15j | P2 | Alternative à PM2 pour isolation |
| 7 | **DNS Management** | 8-10j | P2 | Cloudflare API + PowerDNS self-hosted |
| 8 | **Database Management** | 10-12j | P2 | PostgreSQL, MySQL, Redis |
| 9 | **Monitoring + Alertes** | 10-12j | P2 | Métriques serveur, notifications |

### Détails Q2

#### 6. Docker Runtime
- RuntimeAdapter abstraction (PM2 vs Docker)
- L'utilisateur choisit par app
- PM2 = default (simplicité)
- Docker = isolation, multi-langage

#### 7. DNS Management
**Option A - Cloudflare:**
- Intégration API Cloudflare
- Auto-création records A/CNAME

**Option B - Self-hosted:**
- PowerDNS installation
- Primary/Secondary replication
- UI gestion zones/records
- DNSSEC optionnel

#### 8. Database Management
- PostgreSQL (priorité)
- MySQL
- Redis (cache)
- Connection strings auto-générées
- Backups intégrés

#### 9. Monitoring + Alertes
- Métriques: CPU, RAM, Disk, Network
- Métriques apps: requests, latence, erreurs
- Alertes configurables
- Canaux: Email, Slack, Webhook

---

## TIER 3 - Q3 2026+ (Diversification)

| # | Feature | Effort | Priorité | Description |
|---|---------|--------|----------|-------------|
| 10 | **App Templates** | 10-12j | P3 | n8n, Minecraft, Metabase, etc. |
| 11 | **Mail Server** | 12-15j | P3 | Postfix/Dovecot self-hosted (avancé) |

### Détails Q3

#### 10. App Templates
- Marketplace de templates
- Catégories: Node.js, Automation, Games, etc.
- One-click deploy
- Configuration pré-remplie

#### 11. Mail Server (Self-hosted)
- Postfix + Dovecot
- DKIM/SPF/DMARC auto-config
- Wizard de configuration
- **Avertissement:** Complexe, utilisateurs avancés uniquement

---

## Architecture Multi-Rôles

Un serveur peut avoir plusieurs rôles :

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  🖥️ APP     │  │  💾 BACKUP  │  │  🌐 DNS     │  │  📧 MAIL    │
│  SERVER     │  │  SERVER     │  │  SERVER     │  │  SERVER     │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

Configurations typiques :
- **Solo Dev:** 1 serveur = App + DB
- **Startup:** 2 serveurs = App + Backup
- **Entreprise:** 5+ serveurs = App(s) + DB + Backup + DNS + Mail

---

## Notes Techniques

### Sécurité
- Certificate Pinning obligatoire
- Signatures RSA des commandes
- Anti-replay (nonce + timestamp)
- Jamais de scripts arbitraires

### Approche Hybride
- Toujours proposer option externe ET self-hosted
- L'utilisateur choisit selon ses besoins
- Documentation claire pour chaque option

---

## Prochaines Étapes

1. [ ] Implémenter sécurité agent (Certificate Pinning + Signatures)
2. [ ] Sous-domaines automatiques
3. [ ] CRON Jobs
4. [ ] Agent Scriptable
5. [ ] Safe Config Mode
6. [ ] Backups

---

*Document généré lors de la session de brainstorming du 25 janvier 2026*
