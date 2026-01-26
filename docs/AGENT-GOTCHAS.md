# Agent Server Gotchas - Pièges à Éviter

Ce fichier documente les erreurs courantes et les pièges à éviter lors du développement du code agent qui s'exécute sur les serveurs distants.

**CONSULTER CE FICHIER AVANT** de modifier du code qui :
- Exécute des commandes shell (`exec`, `execAsync`, `spawn`)
- Manipule des fichiers/répertoires
- Gère des processus enfants
- Interagit avec systemd ou PM2

---

## 1. Erreur `getcwd() failed: No such file or directory`

### Symptôme
```
sh: 0: getcwd() failed: No such file or directory
Command failed: cd "/path/to/dir" && some-command
```

### Cause
Le shell hérite du répertoire courant (CWD) du processus parent. Si ce répertoire est supprimé ou renommé pendant l'exécution, toute commande shell échouera avec cette erreur.

### Exemple de Code Bugué
```typescript
// MAUVAIS - Le shell hérite du CWD qui peut avoir été supprimé
fs.renameSync(BUNDLE_DIR, backupDir);  // Supprime l'ancien bundle
fs.mkdirSync(BUNDLE_DIR);               // Crée le nouveau
await execAsync(`cd "${BUNDLE_DIR}" && pnpm install`);  // ERREUR: getcwd() failed
```

### Solution
**Toujours utiliser l'option `cwd`** au lieu de la commande `cd` :

```typescript
// BON - Utilise l'option cwd qui ne dépend pas du CWD hérité
fs.renameSync(BUNDLE_DIR, backupDir);
fs.mkdirSync(BUNDLE_DIR);
await execAsync('pnpm install', { cwd: BUNDLE_DIR });  // OK
```

### Règle
> **JAMAIS utiliser `cd` dans une chaîne de commandes** quand le répertoire courant peut changer.
> Toujours préférer l'option `{ cwd: '/path' }` de `exec`/`execAsync`/`spawn`.

---

## 2. Chemins Relatifs vs Absolus

### Symptôme
```
Error: ENOENT: no such file or directory, open './config.json'
```

### Cause
Les chemins relatifs sont résolus par rapport au CWD du processus, pas par rapport au fichier source.

### Solution
**Toujours utiliser des chemins absolus** :

```typescript
// MAUVAIS
const config = fs.readFileSync('./config.json');

// BON
import path from 'path';
const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = fs.readFileSync(CONFIG_PATH);

// ENCORE MIEUX - Pour les agents
const HOME = os.homedir();
const CONFIG_PATH = path.join(HOME, '.server-flow', 'config.json');
```

---

## 3. Variables d'Environnement PATH

### Symptôme
```
Error: command not found: pnpm
```

### Cause
Le processus Node.js peut avoir un PATH différent de celui d'un shell interactif, surtout quand lancé via systemd.

### Solution
**Utiliser des chemins absolus pour les binaires** ou **étendre le PATH explicitement** :

```typescript
// BON - Chemin absolu
await execAsync('/usr/local/bin/pnpm install');

// BON - Étendre le PATH
const nvmPath = `${os.homedir()}/.nvm/versions/node/v20.11.0/bin`;
await execAsync('pnpm install', {
    env: { ...process.env, PATH: `${nvmPath}:${process.env.PATH}` }
});
```

---

## 4. Commandes avec CWD Explicite

### Quand utiliser `cwd`

| Situation | Utiliser `cwd` ? |
|-----------|------------------|
| Le répertoire peut être supprimé/déplacé avant la commande | OUI |
| Commandes dans un bundle/app déployé | OUI |
| Commandes système globales (`apt-get`, `systemctl`) | NON (mais `/tmp` recommandé) |
| Extraction de tarball puis installation | OUI |

### Exemple Complet - Mise à Jour Agent
```typescript
// Téléchargement (CWD = /tmp pour éviter les problèmes)
await execAsync(`curl -L "${url}" -o "${tempBundle}"`, { cwd: '/tmp' });

// Backup et extraction
fs.renameSync(BUNDLE_DIR, backupDir);
fs.mkdirSync(BUNDLE_DIR, { recursive: true });
await execAsync(`tar -xzf "${tempBundle}" -C "${BUNDLE_DIR}"`, { cwd: '/tmp' });

// Installation des dépendances (CWD = BUNDLE_DIR)
await execAsync('pnpm install --prod', { cwd: BUNDLE_DIR });
```

---

## 5. Processus Enfants et Signaux

### Symptôme
Les processus enfants ne se terminent pas correctement ou deviennent orphelins.

### Solution
**Toujours nettoyer les processus enfants** :

```typescript
const child = spawn('long-running-command', [], { cwd: workDir });

// Écouter les signaux pour cleanup
process.on('SIGTERM', () => {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5000);
});

process.on('SIGINT', () => {
    child.kill('SIGINT');
});
```

---

## 6. Systemd et WorkingDirectory

### Symptôme
Le service systemd démarre mais les commandes échouent car elles cherchent des fichiers au mauvais endroit.

### Cause
Le `WorkingDirectory` dans le fichier `.service` doit correspondre à la structure réelle des fichiers.

### Solution
**Vérifier que le WorkingDirectory correspond à la structure du bundle** :

```ini
# Pour un bundle avec structure apps/agent/
[Service]
WorkingDirectory=/root/.server-flow/agent-bundle/apps/agent
ExecStart=/usr/bin/node dist/index.js
```

**Ne pas** :
```ini
# MAUVAIS si le package.json est dans apps/agent/
[Service]
WorkingDirectory=/root/.server-flow/agent-bundle
ExecStart=/usr/bin/node apps/agent/dist/index.js  # Les chemins relatifs seront cassés
```

---

## 7. Permissions et sudo

### Symptôme
```
Error: EACCES: permission denied
```

### Cause
L'agent tourne souvent en root, mais certaines commandes (comme `gem install`) peuvent créer des fichiers avec des permissions incorrectes.

### Solution
```typescript
// Pour les commandes qui doivent tourner en tant qu'utilisateur spécifique
await execAsync('gem install puma', {
    cwd: workDir,
    env: { ...process.env, HOME: '/root' }  // Explicite pour gems
});
```

---

## Checklist Avant Commit

Quand tu modifies du code qui exécute des commandes shell :

- [ ] Utilises-tu `{ cwd: ... }` au lieu de `cd` ?
- [ ] Les chemins sont-ils absolus ?
- [ ] Le PATH inclut-il tous les binaires nécessaires ?
- [ ] Les processus enfants sont-ils correctement nettoyés ?
- [ ] Le WorkingDirectory systemd est-il correct ?
- [ ] As-tu testé avec un répertoire courant différent ?

---

## Historique des Bugs

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2025-01-25 | `getcwd() failed` lors de UPDATE_AGENT | Utilisation de `cd` après suppression du bundle | Utiliser `{ cwd: BUNDLE_DIR }` |

---

**Dernière mise à jour** : 2025-01-25
**Maintenu par** : Claude Code
