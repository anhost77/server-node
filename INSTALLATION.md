# 🚀 ServerFlow - Guide d'Installation

Ce guide vous explique comment installer et démarrer ServerFlow sur Windows, Linux ou macOS.

## ⚡ Démarrage Rapide

Les scripts d'installation automatiques gèrent tout pour vous :

- Installation de pnpm si nécessaire
- Installation des dépendances
- Compilation des packages
- Initialisation de la base de données
- Configuration de l'environnement
- Démarrage du projet

### Windows

Double-cliquez sur [start.bat](start.bat) ou exécutez dans PowerShell/CMD :

```batch
start.bat
```

### Linux / macOS

Exécutez dans le terminal :

```bash
./start.sh
```

## 📋 Prérequis

### Requis

- **Node.js** version 18+ ([Télécharger](https://nodejs.org/))

### Automatiquement installé par les scripts

- **pnpm** (gestionnaire de paquets)

## 🔧 Ce que font les scripts automatiquement

1. **Vérification de Node.js** : S'assure que Node.js est installé
2. **Installation de pnpm** : Installe pnpm globalement s'il n'est pas présent
3. **Installation des dépendances** : Télécharge tous les packages npm nécessaires
4. **Compilation du package shared** : Compile les types et utilitaires partagés
5. **Configuration interactive** : Vous propose de configurer GitHub OAuth (optionnel)
6. **Création du fichier .env** : Génère la configuration d'environnement avec vos clés
7. **Initialisation de la base de données** : Crée et migre la base SQLite
8. **Démarrage du projet** : Lance tous les services en mode développement

> **Note** : Si le fichier `.env` existe déjà et contient des clés valides, le script ne vous demandera pas de les reconfigurer.

## 🌐 Accès aux services

Une fois démarré, vous pouvez accéder à :

- **Dashboard** : http://localhost:5173
- **API Control Plane** : http://localhost:3000
- **MCP Server** : ws://localhost:3000/api/connect

## 🔑 Configuration GitHub OAuth

GitHub OAuth est **requis pour l'authentification** des utilisateurs dans ServerFlow.

### Configuration automatique (Recommandé)

Les scripts `start.bat` et `start.sh` vous proposent de configurer GitHub OAuth lors du premier démarrage. Si vous choisissez "oui", suivez ces étapes :

1. **Créez une OAuth App** sur https://github.com/settings/developers
2. **Cliquez sur "New OAuth App"**
3. **Configurez** :
   - **Application name** : ServerFlow Local
   - **Homepage URL** : http://localhost:5173
   - **Callback URL** : http://localhost:3000/api/auth/github/callback
4. **Copiez** le Client ID et le Client Secret
5. **Collez-les** dans le terminal quand le script vous le demande

### Configuration manuelle (si vous avez sauté l'étape)

Si vous n'avez pas configuré GitHub OAuth pendant l'installation :

1. Éditez [apps/control-plane/.env](apps/control-plane/.env)
2. Remplissez les champs :
   ```env
   GITHUB_CLIENT_ID=votre_client_id
   GITHUB_CLIENT_SECRET=votre_client_secret
   ```
3. Redémarrez le serveur avec `start.bat` ou `./start.sh`

## 🔄 Migration vers un nouveau PC

Sur un nouveau PC serveur, il suffit de :

1. Cloner ou copier le projet
2. Exécuter `start.bat` (Windows) ou `./start.sh` (Linux/macOS)
3. Le script réinstallera et configurera tout automatiquement

## 🛠️ Commandes manuelles (avancé)

Si vous préférez gérer manuellement :

```bash
# Installation
pnpm install

# Compilation du package shared
pnpm --filter @server-flow/shared build

# Démarrage
pnpm dev

# Démarrage d'un service spécifique
pnpm --filter @server-flow/dashboard dev
pnpm --filter @server-flow/control-plane dev
pnpm --filter @server-flow/agent dev
```

## 📦 Structure du projet

```
server-node/
├── apps/
│   ├── agent/           # Agent de déploiement
│   ├── control-plane/   # API backend
│   ├── dashboard/       # Interface web (Vue.js)
│   └── mcp-server/      # MCP Server
├── packages/
│   └── shared/          # Code partagé (types, utils)
├── start.bat            # Script de démarrage Windows
├── start.sh             # Script de démarrage Linux/macOS
└── INSTALLATION.md      # Ce fichier
```

## ❓ Résolution de problèmes

### pnpm n'est pas reconnu (Windows)

Si vous obtenez l'erreur "pnpm n'est pas reconnu" après la première installation :

1. Fermez complètement votre terminal
2. Rouvrez un nouveau terminal
3. Relancez `start.bat`

### Port 3000 déjà utilisé

Si le port 3000 est occupé :

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/macOS
lsof -ti:3000 | xargs kill -9
```

### Erreur de base de données

Si la base de données est corrompue :

```bash
# Supprimer la base de données
rm apps/control-plane/data/auth.db

# Relancer le script pour la régénérer
start.bat  # ou ./start.sh
```

## 🆘 Support

Pour toute question ou problème, consultez :

- [CONTRIBUTING.md](CONTRIBUTING.md) pour contribuer au projet
- Issues GitHub du projet
