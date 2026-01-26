# Mécanisme de Mise à Jour de l'Agent ServerFlow

**IMPORTANT** : Ce document décrit le fonctionnement COMPLET du système de mise à jour automatique de l'agent. **TOUTE modification du bundle, de la structure des fichiers, ou du processus de mise à jour DOIT être faite en connaissance de ce document.**

---

## Vue d'ensemble

L'agent ServerFlow déployé sur les serveurs distants peut se mettre à jour automatiquement via une commande WebSocket `UPDATE_AGENT` envoyée depuis le dashboard.

### Flux de mise à jour

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Dashboard  │────>│  Control Plane  │────>│  Agent (distant) │
│  (Click     │     │  (Relaye la     │     │  (Exécute la     │
│   Update)   │     │   commande)     │     │   mise à jour)   │
└─────────────┘     └─────────────────┘     └──────────────────┘
                            │
                            │ Sert le fichier
                            ▼
                    /agent-bundle.tar.gz
```

---

## Structure du Bundle Agent

### Structure ACTUELLE (v0.1.26+) - Structure Plate

```
agent-bundle/
├── dist/                    # Code compilé de l'agent
│   ├── index.js             # Point d'entrée
│   ├── infrastructure.js
│   ├── execution.js
│   └── ...
├── node_modules/
│   └── @server-flow/
│       └── shared/          # Package shared copié (pas un symlink)
│           ├── dist/
│           │   └── index.js
│           └── package.json
└── package.json             # Version de l'agent
```

### Structure ANCIENNE (< v0.1.26) - À NE PLUS UTILISER

```
agent-bundle/
├── apps/
│   └── agent/
│       ├── dist/
│       └── package.json
├── packages/
│   └── shared/
└── package.json
```

**ATTENTION** : L'ancienne structure imbriquée causait des problèmes avec :
- Les chemins systemd (`WorkingDirectory`)
- Les imports de modules (`@server-flow/shared`)
- Les symlinks pnpm qui ne fonctionnent pas en production

---

## Fichiers Clés

### 1. Bundle Source (développement)

**Chemin** : `apps/agent/bundle/`

Ce dossier contient les fichiers qui seront empaquetés dans le tar.gz :
- `package.json` - Version et dépendances (SANS `workspace:*`)
- `dist/` - Code compilé (copié depuis `apps/agent/dist/`)
- `node_modules/@server-flow/shared/` - Package shared copié

### 2. Bundle Distribué

**Chemin** : `apps/control-plane/public/agent-bundle.tar.gz`

Archive tar.gz servie par le control-plane. Les agents distants téléchargent ce fichier lors d'une mise à jour.

### 3. Agent Déployé (sur serveur distant)

**Chemin** : `~/.server-flow/agent-bundle/`

C'est ici que l'agent extrait le bundle et s'exécute.

### 4. Service Systemd

**Chemin** : `/etc/systemd/system/server-flow-agent.service`

```ini
[Unit]
Description=ServerFlow Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.server-flow/agent-bundle
ExecStart=/usr/bin/node /root/.server-flow/agent-bundle/dist/index.js --url http://CONTROL_PLANE_URL
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**CRITIQUE** : Le `WorkingDirectory` et `ExecStart` doivent pointer vers la structure plate !

---

## Processus de Mise à Jour Automatique

Voici ce que fait l'agent quand il reçoit `UPDATE_AGENT` (voir `apps/agent/src/index.ts`) :

### Étape 1 : Téléchargement
```bash
curl -L "http://CONTROL_PLANE/agent-bundle.tar.gz" -o /tmp/agent-bundle-update.tar.gz
```

### Étape 2 : Backup
```bash
mv ~/.server-flow/agent-bundle ~/.server-flow/agent-bundle-backup
```

### Étape 3 : Extraction
```bash
mkdir -p ~/.server-flow/agent-bundle
tar -xzf /tmp/agent-bundle-update.tar.gz -C ~/.server-flow/agent-bundle
```

### Étape 4 : Nettoyage node_modules (évite les conflits pnpm)
```bash
rm -rf ~/.server-flow/agent-bundle/node_modules
```

### Étape 5 : Installation des dépendances
```bash
cd ~/.server-flow/agent-bundle
pnpm install --prod --ignore-scripts  # ou npm install --omit=dev
```

### Étape 6 : Lien du package shared (si nécessaire)
Si `packages/shared` existe mais pas `node_modules/@server-flow/shared`, on copie :
```bash
cp -r packages/shared node_modules/@server-flow/shared
```

### Étape 7 : Mise à jour du fichier systemd
**NOUVEAU (v0.1.26+)** : L'agent met à jour automatiquement le fichier systemd pour s'assurer que les chemins sont corrects :
```bash
echo '[Unit]
Description=ServerFlow Agent
...
WorkingDirectory=/root/.server-flow/agent-bundle
ExecStart=/usr/bin/node /root/.server-flow/agent-bundle/dist/index.js --url http://...
...' | sudo tee /etc/systemd/system/server-flow-agent.service

sudo systemctl daemon-reload
```

### Étape 8 : Redémarrage
```bash
sudo systemctl restart server-flow-agent
```

---

## Création du Bundle (Procédure)

Quand tu modifies l'agent et veux créer un nouveau bundle :

### 1. Build l'agent
```bash
cd apps/agent
pnpm build
```

### 2. Copie le dist dans le bundle
```bash
rm -rf apps/agent/bundle/dist
cp -r apps/agent/dist apps/agent/bundle/
```

### 3. Copie le package shared
```bash
mkdir -p apps/agent/bundle/node_modules/@server-flow
rm -rf apps/agent/bundle/node_modules/@server-flow/shared
cp -r packages/shared apps/agent/bundle/node_modules/@server-flow/shared
```

### 4. Vérifie le package.json du bundle
Le fichier `apps/agent/bundle/package.json` doit :
- Avoir la bonne version
- NE PAS avoir `"@server-flow/shared": "workspace:*"` (on le copie manuellement)
- Avoir les dépendances runtime (fastify, ws, pm2, zod)

### 5. Crée le tar.gz
```bash
cd apps/agent/bundle
tar -czvf /tmp/agent-bundle.tar.gz .
mv /tmp/agent-bundle.tar.gz ../../../control-plane/public/
```

---

## Erreurs Courantes et Solutions

### Erreur : `ERR_MODULE_NOT_FOUND: Cannot find package '@server-flow/shared'`

**Cause** : Le package shared n'est pas dans `node_modules/@server-flow/shared/`

**Solution** :
1. Vérifie que `apps/agent/bundle/node_modules/@server-flow/shared/` existe
2. Vérifie qu'il contient un `dist/index.js`
3. Recrée le bundle

### Erreur : `status=200/CHDIR` dans systemd

**Cause** : Le `WorkingDirectory` pointe vers un chemin qui n'existe pas

**Solution** :
1. Vérifie que le fichier systemd pointe vers `/root/.server-flow/agent-bundle` (pas `/root/.server-flow/agent-bundle/apps/agent`)
2. Le nouveau code (v0.1.26+) corrige automatiquement ce problème

### Erreur : L'agent ne démarre pas après mise à jour

**Diagnostic** :
```bash
journalctl -u server-flow-agent -f
systemctl status server-flow-agent
ls -la ~/.server-flow/agent-bundle/
```

**Vérifications** :
1. Est-ce que `dist/index.js` existe ?
2. Est-ce que `node_modules/@server-flow/shared/dist/index.js` existe ?
3. Est-ce que le fichier systemd a les bons chemins ?

---

## Checklist Avant Release

- [ ] Version incrémentée dans `apps/agent/package.json`
- [ ] Version incrémentée dans `apps/agent/bundle/package.json`
- [ ] Code buildé (`pnpm build` dans `apps/agent`)
- [ ] `dist/` copié dans `bundle/`
- [ ] `@server-flow/shared` copié dans `bundle/node_modules/`
- [ ] `bundle/package.json` ne contient PAS `workspace:*`
- [ ] tar.gz créé et placé dans `control-plane/public/`
- [ ] Test de la mise à jour sur un serveur réel

---

## Résumé des Chemins Importants

| Quoi | Où (dev) | Où (serveur) |
|------|----------|--------------|
| Code source agent | `apps/agent/src/` | - |
| Code compilé agent | `apps/agent/dist/` | `~/.server-flow/agent-bundle/dist/` |
| Bundle source | `apps/agent/bundle/` | - |
| Bundle tar.gz | `apps/control-plane/public/agent-bundle.tar.gz` | `/tmp/agent-bundle-update.tar.gz` |
| Agent déployé | - | `~/.server-flow/agent-bundle/` |
| Service systemd | - | `/etc/systemd/system/server-flow-agent.service` |
| Shared package | `packages/shared/` | `~/.server-flow/agent-bundle/node_modules/@server-flow/shared/` |

---

## Historique des Problèmes

### 2025-01-26 : Changement de structure du bundle

**Problème** : Passage de structure imbriquée (`apps/agent/`) à structure plate (`dist/`), mais le fichier systemd sur les serveurs existants pointait toujours vers l'ancien chemin.

**Symptômes** :
- `ERR_MODULE_NOT_FOUND: Cannot find package '@server-flow/shared'`
- `status=200/CHDIR` dans systemd
- Agent en crash loop

**Solution** : Ajout de la mise à jour automatique du fichier systemd dans le processus `UPDATE_AGENT` (v0.1.26).

**Leçon** : Toujours penser aux agents DÉJÀ déployés quand on change la structure du bundle. Le mécanisme de mise à jour doit gérer la migration.

---

**Version du document** : 1.0
**Dernière mise à jour** : 2025-01-26
**Auteur** : Claude Code
