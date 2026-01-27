# Feature Proposal: Agent Sysadmin IA (Claude DevOps Assistant)

**Date** : 2026-01-27
**Propose par** : Adrien (via PM Agent)
**Status** : draft

---

## Resume Executif

### La Feature en Une Phrase
Un assistant IA integre au dashboard ServerFlow qui agit comme un sysadmin virtuel, capable de diagnostiquer et corriger automatiquement les problemes serveur via conversation naturelle.

### Verdict du Product Manager

**RECOMMANDATION : GO - Feature Differenciante Majeure**

Cette feature represente l'evolution naturelle et strategique de ServerFlow. Elle transforme le produit de "simple outil de deploiement" vers "partenaire IA de gestion d'infrastructure" - exactement le positionnement vise par la vision "The Hands of Claude".

---

## 1. Analyse Strategique

### 1.1 Alignement avec la Vision Produit

Le PRD definit ServerFlow comme **"the hands of AI agents (Claude, Cursor)"** avec la vision d'un **"Universal MCP Bridge"**. Cette feature est la materialisation concrete de cette vision.

| Vision PRD | Feature Proposee |
|------------|------------------|
| "ChatOps 2.0" | Chat integre avec execution |
| "Zero-Trust Execution" | Actions loggees + approbation |
| "Dry-Run Default" | Suggestion avant execution |
| "Proactive Agent (The Janitor)" | Diagnostic et correction auto |

**Score d'alignement : 95%** - Cette feature EST la vision du produit.

### 1.2 Differentiateur Concurrentiel

**Recherches web effectuees :**

Le marche actuel montre :
- **Term-800** : Chatbot SSH basique, pas d'interface web integree
- **n8n workflows** : Requiert configuration complexe (Slack/Telegram + OpenAI)
- **SysAid/ServiceNow** : Focalises sur ticketing IT, pas DevOps
- **Claude Code CLI** : Puissant mais necessite acces terminal

**ServerFlow serait UNIQUE car :**
1. **Zero SSH** - L'utilisateur n'a jamais besoin d'acceder au terminal
2. **Context-Aware** - L'agent connait deja les apps, configs, domaines
3. **Integrated** - Un seul dashboard, pas de setup externe
4. **Safe by Design** - Architecture Zero-Trust deja en place

### 1.3 Impact sur le Positionnement

| Avant | Apres |
|-------|-------|
| "Vercel for VPS" | "Vercel + AI Sysadmin for VPS" |
| Outil de deploiement | Partenaire d'infrastructure |
| Reactive (deploy quand demande) | Proactive (detecte et corrige) |

**Nouvelle tagline potentielle :** "Your AI Sysadmin. Deploy, Monitor, Fix - No SSH Required."

---

## 2. Analyse de Faisabilite

### 2.1 Assets Existants (Reutilisables)

ServerFlow possede DEJA les briques necessaires :

| Asset | Status | Reutilisation |
|-------|--------|---------------|
| MCP Server (Epic 4) | Done | API pour les tools |
| Audit Logging | Done | Tracabilite des actions |
| WebSocket real-time | Done | Streaming des logs |
| Agent commands | Done | Execution sur serveur |
| ExecutionManager | Done | Git, build, services |
| Dry-Run pattern | Done | Confirmation avant action |

**Estimation de reutilisation : 70% du backend existe deja.**

### 2.2 Ce Qu'il Faut Construire

**Nouveaux composants :**

1. **Chat UI** (Dashboard) - Vue 3 component avec historique
2. **LLM Integration** (Control Plane) - Appels API Claude
3. **Prompt Engineering** - Contexte serveur pour l'IA
4. **Tool Definitions** - Nouvelles actions (disk clean, cert renew, etc.)
5. **Safety Layer** - Validation des commandes dangereuses

### 2.3 Risques Techniques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Latence LLM | Medium | Streaming responses + cache |
| Cout API Claude | High | Rate limiting + tiered pricing |
| Commandes dangereuses | Critical | Whitelist + dry-run obligatoire |
| Hallucinations IA | Medium | Grounding avec contexte serveur |

---

## 3. Reponses aux Questions

### Q1 : Est-ce une feature differenciante majeure ?

**OUI - C'est LA feature differenciante de 2026.**

Le marche evolue vers l'IA assistee. Les developpeurs utilisent deja Claude/GPT pour debugger. Integrer cette capacite directement dans le workflow de gestion serveur est une evolution naturelle.

**Preuves marche :**
- Claude Opus 4 decrit comme "game-changer for DevOps workflows"
- Microsoft Azure integre Claude pour diagnostics automatiques
- n8n voit une adoption croissante des workflows AI-sysadmin

### Q2 : Impact sur le positionnement "the hands of Claude" ?

**Impact TRES POSITIF - Concretisation de la vision.**

Actuellement :
- ServerFlow = "les mains de Claude" (execute ce que Claude demande via MCP)

Avec cette feature :
- ServerFlow = "Claude integre qui utilise ses propres mains"

C'est une evolution vers un produit plus autonome et intelligent, tout en gardant l'humain dans la boucle (approbation).

### Q3 : Pricing - Gratuite ou Premium ?

**RECOMMANDATION : Modele Hybrid**

| Tier | Fonctionnalites |
|------|-----------------|
| **Free** | 5 requetes/jour, diagnostics seulement (lecture) |
| **Pro** | 50 requetes/jour, actions correctives, historique |
| **Enterprise** | Illimite, audit compliance, custom prompts |

**Raison economique :**
- Cout API Claude ~$0.015/1K tokens (input) + $0.075/1K tokens (output)
- Requete moyenne estimee : ~2K tokens = ~$0.18/requete
- Free tier (5 req/jour) = $0.90/user/mois (acceptable pour conversion)
- Pro couvre les couts avec marge

### Q4 : Risque de cannibaliser le support humain ?

**RISQUE FAIBLE - Opportunite de scaling.**

| Type de support | AI Agent | Support humain |
|-----------------|----------|----------------|
| "Pourquoi Nginx ne demarre pas ?" | Auto-diagnostic | Escalade si echec |
| "Libere de l'espace disque" | Action automatique | N/A |
| "Architecture multi-serveur" | N/A | Conseil expert |
| Bug produit ServerFlow | N/A | Correction code |

L'IA gere le **Tier 1** (repetitif), les humains gererent le **Tier 2-3** (complexe).

**Avantage :** Permet de scaler le support sans embaucher proportionnellement.

### Q5 : MVP vs Full - Fonctionnalites V1 ?

**MVP (Phase 1) - "Le Diagnostic Intelligent"**

| Feature | Description | Effort |
|---------|-------------|--------|
| Chat UI | Interface conversation basique | 3 pts |
| Diagnostics | Lecture logs, status services, disk/RAM | 5 pts |
| Suggestions | Propose des fixes sans executer | 3 pts |
| Context injection | Injecte info serveur dans le prompt | 5 pts |

**Total MVP : 16 points** (~2 semaines)

**Phase 2 - "Les Mains"**

| Feature | Description | Effort |
|---------|-------------|--------|
| Actions correctives | Execute les fixes approuves | 5 pts |
| Historique chat | Persistance des conversations | 3 pts |
| Multi-serveur | Contexte multi-server | 5 pts |

**Phase 3 - "L'Autonomie"**

| Feature | Description | Effort |
|---------|-------------|--------|
| Alertes proactives | L'IA notifie avant les problemes | 8 pts |
| Routines automatiques | Maintenance planifiee | 5 pts |
| Custom prompts | Entreprises definissent leurs regles | 5 pts |

---

## 4. Architecture Technique Proposee

### 4.1 Vue d'Ensemble

```
+----------------+     +------------------+     +---------------+
|  Dashboard     |     |  Control Plane   |     |  Agent        |
|  (Vue 3)       |     |  (Fastify)       |     |  (Node)       |
+-------+--------+     +--------+---------+     +-------+-------+
        |                       |                       |
        | WebSocket             | HTTP                  | WebSocket
        v                       v                       |
+-------+--------+     +--------+---------+             |
|  Chat Component|---->|  /api/ai/chat    |             |
|  - History     |     |  - LLM Router    |             |
|  - Streaming   |     |  - Tool Executor |<------------+
+----------------+     +------------------+
                                |
                                | API Call
                                v
                       +--------+---------+
                       |  Claude API      |
                       |  (Anthropic)     |
                       +------------------+
```

### 4.2 Nouveaux Endpoints

```typescript
// Control Plane - Nouvelle route AI
POST /api/ai/chat
Body: { serverId: string, message: string, conversationId?: string }
Response: Streaming (SSE) { type: 'text' | 'tool_call' | 'tool_result', content: string }

GET /api/ai/conversations/:serverId
Response: { conversations: Conversation[] }

POST /api/ai/approve-action
Body: { conversationId: string, actionId: string }
Response: { success: boolean, result: any }
```

### 4.3 Tools MCP Existants (Reutilisables)

Depuis l'Epic 4, ces tools existent deja :
- `deploy_app` - Deploiement application
- `get_logs` - Lecture logs (PM2, Nginx, system)
- `restart_service` - Redemarrage services
- `list_apps` - Liste applications deployees

### 4.4 Nouveaux Tools a Creer

```typescript
// Diagnostic tools (lecture seule)
get_disk_usage: () => DiskInfo[]
get_memory_status: () => MemoryInfo
get_service_status: (service: string) => ServiceStatus
get_nginx_config: (domain: string) => NginxConfig
get_ssl_status: (domain: string) => SSLInfo

// Action tools (require approval)
clean_disk: (paths: string[], dryRun: boolean) => CleanResult
renew_certificate: (domain: string) => RenewResult
fix_nginx_config: (domain: string, fix: string) => FixResult
restart_failed_service: (service: string) => RestartResult
```

### 4.5 Prompt System (Simplifie)

```markdown
Tu es l'assistant IA de ServerFlow pour le serveur "{serverAlias}".

## Contexte Serveur
- OS: {os}
- RAM: {usedRam}/{totalRam} GB
- Disk: {usedDisk}/{totalDisk} GB
- Apps: {appList}
- Services: {serviceStatus}

## Regles
1. Toujours expliquer le diagnostic avant de proposer une action
2. Les actions destructives (delete, clean) requierent confirmation
3. Ne jamais modifier les fichiers de credentials
4. Logger toutes les actions proposees

## Tools Disponibles
{toolDefinitions}
```

---

## 5. Plan de Developpement

### Epic 8 : AI Sysadmin Agent

#### Story 8-1 : Chat UI Component
**Points** : 3
- Composant Vue avec input/output streaming
- Integration WebSocket pour real-time
- Historique de conversation (localStorage MVP)

#### Story 8-2 : LLM Router & Context Injection
**Points** : 5
- Endpoint `/api/ai/chat`
- Injection contexte serveur dans prompt
- Appel API Claude avec streaming

#### Story 8-3 : Diagnostic Tools
**Points** : 5
- Tools lecture seule (disk, memory, services, logs)
- Integration avec agent existant
- Formatage reponses pour l'IA

#### Story 8-4 : Action Tools avec Approval Flow
**Points** : 5
- Tools actions correctives
- UI d'approbation (modal)
- Execution via agent WebSocket

#### Story 8-5 : Conversation Persistence
**Points** : 3
- Table `ai_conversations` (PostgreSQL)
- API CRUD conversations
- UI historique

---

## 6. Metriques de Succes

### KPIs a Tracker

| Metrique | Target MVP | Target 6 mois |
|----------|------------|---------------|
| Taux d'adoption (users actifs) | 30% | 60% |
| Resolution sans escalade | 50% | 70% |
| Satisfaction (NPS feature) | +30 | +50 |
| Requetes/user/mois (Pro) | 20 | 40 |
| Conversion Free -> Pro | 5% | 15% |

### Instrumentation

```typescript
// Events a tracker
ai.conversation.started
ai.diagnostic.completed
ai.action.suggested
ai.action.approved
ai.action.executed
ai.action.success
ai.action.failed
ai.conversation.escalated_to_support
```

---

## 7. Considerations Securite

### 7.1 Risques Identifies

| Risque | Severite | Mitigation |
|--------|----------|------------|
| Injection prompt | High | Sanitization + validation stricte |
| Execution commande arbitraire | Critical | Whitelist tools uniquement |
| Acces donnees sensibles | High | Masquage auto des secrets dans logs |
| Abus API (DDoS) | Medium | Rate limiting par user/server |
| Fuite data vers Claude | Medium | Pas d'envoi de credentials/secrets |

### 7.2 Checklist Securite

- [ ] Aucun secret dans le contexte envoye a Claude
- [ ] Toutes les actions loggees (audit trail)
- [ ] Whitelist stricte des commandes executables
- [ ] Dry-run par defaut pour actions destructives
- [ ] Rate limiting : 10 req/min/user (MVP)

---

## 8. Recherches Web - Sources

- [Term-800 GitHub](https://github.com/jamro/term-800) - Chatbot sysadmin SSH
- [n8n AI Linux Admin Workflow](https://n8n.io/workflows/3020-ai-linux-system-administrator-for-managing-linux-vps-instance/) - Integration AI + SSH
- [Claude Opus 4 DevOps Revolution](https://devops.com/claude-opus-4-the-ai-revolution-that-could-transform-devops-workflows/) - Vision AI DevOps
- [Claude Code for DevOps](https://milvus.io/ai-quick-reference/how-do-i-use-claude-code-for-devops-tasks) - Capabilities
- [Claude DevOps Agent GitHub](https://github.com/olushile/claude-devops-agent) - Implementation reference
- [Azure + Claude Integration](https://azure.microsoft.com/en-us/blog/introducing-anthropics-claude-models-in-microsoft-foundry-bringing-frontier-intelligence-to-azure/) - Enterprise example

---

## 9. Validation

- [x] Product Manager : Analyse complete, GO recommande
- [ ] UX Agent : Wireframes chat UI a creer
- [ ] Dev Agent : Architecture validee
- [ ] Security Agent : Risques identifies, mitigations proposees

---

## 10. Prochaines Etapes

1. **Immediate** : Validation UX pour design du chat component
2. **Semaine 1** : Story 8-1 et 8-2 (Chat UI + LLM Router)
3. **Semaine 2** : Story 8-3 et 8-4 (Tools + Approval)
4. **Semaine 3** : Story 8-5 + Tests + Polish

**Decision requise** : GO/NO-GO pour demarrer l'Epic 8

---

*Document genere par le Product Manager Agent - Claude Opus 4.5*
*Derniere mise a jour : 2026-01-27*
