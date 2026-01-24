---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-01-23.md
date: 2026-01-23
author: Adrien
project_name: ServerFlow
---

# Product Brief: ServerFlow

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

**ServerFlow** est la façon la plus simple de mettre votre site en ligne sur VOTRE infrastructure.

En 2024, déployer un site web nécessite encore de comprendre Git, SSH, les commandes terminal, et la configuration serveur. C'est une barrière absurde. ServerFlow élimine cette complexité : vous avez un serveur, vous avez du code — ServerFlow fait le reste.

**Ce que ServerFlow N'EST PAS :**
- Un panel de gestion de serveurs (trop technique)
- Un hébergeur managed (pas de contrôle, lock-in)
- Un outil pour DevOps (trop simple pour eux)

**Ce que ServerFlow EST :**
- La façon la plus simple de dire "mon code → mon serveur → c'est en ligne"
- Zero-Trust : même le créateur n'accède jamais à vos serveurs
- Multi-cloud : vos serveurs, vos hébergeurs, votre contrôle
- Conversationnel : commandez via chat au lieu de commandes terminal

**Principes Fondamentaux :**
1. Les gens veulent que leur site fonctionne, pas "gérer un serveur"
2. Le mot "VPS" ne devrait jamais apparaître dans l'UI
3. Chaque minute de configuration est une minute perdue

---

## Core Vision

### Problem Statement

Les développeurs et créateurs de sites web veulent déployer leurs projets rapidement, mais se heurtent à une complexité technique inutile : configuration SSH, gestion de clés, commandes Git, setup Nginx/SSL, gestion de bases de données. Cette friction décourage les non-techniciens et fait perdre du temps aux développeurs expérimentés.

### Problem Impact

- **Temps perdu** : Des heures de configuration au lieu de créer
- **Barrière à l'entrée** : Les non-devs abandonnent ou paient cher pour de l'hébergement managed
- **Lock-in** : Les solutions simples (Vercel, Render) enferment dans leur écosystème
- **Sécurité mal gérée** : SSH keys partagées, .env mal protégés

### Why Existing Solutions Fall Short

| Solution | Problème |
|----------|----------|
| **Coolify/CapRover** | Requiert Docker, config technique, ressources élevées |
| **Dokku** | CLI only, courbe d'apprentissage |
| **Vercel/Render** | Lock-in, coûteux à scale, pas de contrôle serveur |
| **Manuel (SSH)** | Complexe, error-prone, pas de rollback facile |

### Proposed Solution

Un **agent léger** qui s'installe sur le VPS de l'utilisateur en une commande :
```bash
curl -fsSL https://serverflow.io/install | TOKEN=xxx bash
```

L'agent :
1. Se connecte au dashboard central (architecture pull)
2. Clone les repos GitLab configurés
3. Détecte automatiquement package.json, docker-compose, etc.
4. Configure Nginx, SSL, PM2 automatiquement
5. Communique via chat MCP pour les commandes

**Installation Options :**
- **Option A** : Interface web avec connexion SSH temporaire (credentials jamais stockés)
- **Option B** : Script public auditable sur GitHub

### Key Differentiators

1. **Architecture Zero-Trust** : L'agent INITIE les connexions → pas de SSH entrant, pas d'accès créateur
2. **Multi-Cloud Native** : Un dashboard, N hébergeurs (OVH, Scaleway, DigitalOcean...)
3. **Multi-Interface** : Dashboard + Chat conversationnel + MCP (pas que MCP)
4. **Scan Intelligent** : Détection auto de docker-compose, package.json, .nvmrc
5. **IA Incluse** : Support IA 24/7 inclus dans le forfait

---

## Risques et Mitigations

| Risque | Mitigation |
|--------|------------|
| **Support = charge infinie** | IA répond aux questions — inclus dans le forfait |
| **MCP = trop niche** | Multi-interface : Dashboard + Chat + MCP |
| **Cible floue** | Cible précise = "créateurs assistés par IA" (utilisateurs de Cursor, Claude, etc.) |
| **Pricing trop bas** | Modèle Base (5€/mois) + Usage (volume de déploiements) |
| **Marché non validé** | Beta fermée avant lancement public |

### Cible Affinée

> **Persona principal :** Créateurs qui utilisent l'IA pour coder (Cursor, Claude, ChatGPT) mais ne savent pas déployer.
> Ils génèrent du code, ils ont besoin d'un serveur, ils veulent que "ça marche".

---

## Principes de Lancement

### Sagesse du Passé
> *"Fais le produit que tu aurais tué pour avoir."*
- Pas de jargon technique dans l'UI
- Un bouton "déployer" et c'est fini
- Messages d'erreur humains, pas de stack traces

### Sagesse du Futur
> *"Less is more. Les vrais insights viennent des vrais utilisateurs."*

| Principe | Application |
|----------|-------------|
| **3 features max au lancement** | Agent + Dashboard + Déploiement Git |
| **Validation rapide** | Si personne ne paie en 3 mois → pivot |
| **IA pour le support** | Non-négociable pour un solo-founder |
| **Ship > Perfect** | Lance, itère, améliore |

### MVP Définition
Le MVP ServerFlow c'est :
1. ✅ Installer l'agent en une commande
2. ✅ Connecter un repo Git
3. ✅ Déployer en un clic
4. ✅ **Chat MCP inclus** (différenciateur, non-négociable)
5. ❌ Pas de : multi-serveurs, rollback avancé, monitoring (Phase 2)

---

## Décisions Produit (War Room)

### Features MVP Confirmées
| Feature | Status | Justification |
|---------|--------|---------------|
| Déploiement Git one-click | ✅ MVP | Core value |
| Dashboard basique | ✅ MVP | Nécessaire |
| Install en 1 commande | ✅ MVP | Onboarding |
| **Chat MCP** | ✅ MVP | **Différenciateur clé** |
| IA Debug/Support | ✅ MVP | Obligatoire pour scale |

### Principes UX Non-Négociables
| Principe | Implementation |
|----------|----------------|
| **Masquer le jargon** | "Token" → "Clé de connexion" ou invisible |
| **Messages humains** | Pas de stack traces, suggestions claires |
| **IA assistante** | Debug automatique si problème serveur |
| **< 5 min premier déploiement** | Métrique de succès UX |

### Timeline Ajustée
| Phase | Durée | Contenu |
|-------|-------|---------|
| **MVP** | 6 sem | Agent + Dashboard + Git + Chat MCP |
| **Phase 2** | +4 sem | Multi-serveurs, Rollback |
| **Phase 3** | +4 sem | Monitoring, Marketplace |

---

## Vision Long-Terme

### Le Pont MCP Universel

> *"ServerFlow devient l'endroit où TOUTE IA envoie son code."*

**Concept :**
- L'utilisateur a Claude/Cursor/ChatGPT avec un agent MCP
- L'agent MCP est connecté à ServerFlow
- Quand l'IA termine le code → déploiement AUTOMATIQUE
- L'utilisateur ne pense même plus au déploiement

```
┌─────────────┐     MCP     ┌─────────────┐     Agent     ┌─────────────┐
│   Claude    │────────────►│ ServerFlow  │──────────────►│   VPS       │
│   Cursor    │  "deploy"   │   Central   │   auto-push   │  Client     │
│   ChatGPT   │             │             │               │             │
└─────────────┘             └─────────────┘               └─────────────┘
```

### Updates Centralisés
- Vous déployez une mise à jour de l'agent
- TOUS les serveurs clients se mettent à jour automatiquement
- Zero intervention utilisateur

---

## Scénarios et Contingences

| Scénario | Réponse |
|----------|---------|
| **Vercel lance pareil** | Zero-Trust = moat défendable |
| **0 conversions** | → Open-source + support payant |
| **IA fait tout** | → Devenir LE pont MCP universel |
| **Retard MVP** | → Livraisons incrémentales toutes les 2 sem |

---

## Target Users

### Persona Principal : "Marc le Créateur IA"

| Attribut | Détail |
|----------|--------|
| **Âge** | 30-50 ans |
| **Profil** | Créateur, fondateur startup, side-project |
| **Niveau tech** | Débutant à intermédiaire |
| **Outils** | Cursor, Claude, ChatGPT pour coder |
| **Frustration** | "Mon app marche en local... et maintenant ?" |
| **Besoin** | Déployer VITE sans apprendre DevOps |

**Journée type :**
1. Idée d'app ou feature
2. Code avec Claude/Cursor pendant 2h
3. Ça marche en local !
4. "Comment je mets ça en ligne...?"
5. Google "deploy node app" → 15 articles, 3h perdues
6. Abandonne ou paie un dev

**Moment ServerFlow :**
> *"Installe l'agent, connecte ton GitLab, clique Déployer. C'est en ligne en 5 min."*

### Persona Secondaire : "Sophie la Senior Dev"

| Attribut | Détail |
|----------|--------|
| **Profil** | Dev expérimentée, 10+ ans |
| **Frustration** | "Je sais faire, mais j'ai pas le temps" |
| **Besoin** | Automatiser ce qui est répétitif |

### Personas Futures (Phase 2+)

| Persona | Potentiel |
|---------|-----------|
| **Agences web** | Gérer N clients avec un dashboard |
| **Formateurs/Bootcamps** | Déployer les projets élèves facilement |

---
