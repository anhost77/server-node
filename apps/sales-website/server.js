/**
 * @file apps/sales-website/server.js
 * @description Serveur de développement pour le site de vente ServerFlow.
 * Ce serveur sert les fichiers HTML compilés avec hot reload automatique
 * quand les fichiers sources sont modifiés.
 *
 * @dependencies
 * - express: Framework web léger pour servir les fichiers
 * - chokidar: Surveillance des fichiers pour le hot reload
 *
 * @fonctions_principales
 * - startServer(): Démarre le serveur sur le port 4500
 * - watchFiles(): Surveille les modifications et déclenche le rebuild
 * - injectLiveReload(): Injecte le script de live reload dans les pages HTML
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { build } from './build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4500;
const DIST_DIR = path.join(__dirname, 'dist');
const SRC_DIR = path.join(__dirname, 'src');

// Création de l'application Express
const app = express();
const server = createServer(app);

// WebSocket pour le live reload
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

/**
 * Notifie tous les clients WebSocket de recharger la page
 */
function notifyReload() {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      // OPEN
      client.send('reload');
    }
  });
}

/**
 * Script de live reload à injecter dans les pages HTML
 */
const liveReloadScript = `
<script>
(function() {
  const ws = new WebSocket('ws://localhost:${PORT}');
  ws.onmessage = function(event) {
    if (event.data === 'reload') {
      location.reload();
    }
  };
  ws.onclose = function() {
    console.log('[LiveReload] Connexion perdue, tentative de reconnexion...');
    setTimeout(function() {
      location.reload();
    }, 1000);
  };
})();
</script>
`;

/**
 * Middleware pour injecter le script de live reload dans les pages HTML
 */
function injectLiveReload(html) {
  return html.replace('</body>', `${liveReloadScript}</body>`);
}

/**
 * Middleware pour servir les fichiers HTML avec live reload
 */
app.use((req, res, next) => {
  // Gérer la redirection racine vers la langue par défaut
  if (req.path === '/') {
    return res.redirect('/en/');
  }

  // Déterminer le chemin du fichier
  let filePath = path.join(DIST_DIR, req.path);

  // Si c'est un dossier, chercher index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Si pas d'extension, essayer .html
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath = filePath + '.html';
  }

  // Servir les fichiers HTML avec injection live reload
  if (filePath.endsWith('.html') && fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf-8');
    res.type('html').send(injectLiveReload(html));
    return;
  }

  next();
});

// Proxy pour l'API contact vers le control-plane
app.use('/api/contact', express.json(), async (req, res) => {
  try {
    const response = await fetch('http://localhost:3000/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy] Erreur:', error.message);
    res.status(500).json({ error: 'Failed to reach API server' });
  }
});

// Servir les fichiers statiques
app.use(express.static(DIST_DIR));

// 404 handler
app.use((req, res) => {
  const notFoundPath = path.join(DIST_DIR, 'en', '404.html');
  if (fs.existsSync(notFoundPath)) {
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    res.status(404).type('html').send(injectLiveReload(html));
  } else {
    res.status(404).send('Page not found');
  }
});

/**
 * Démarre la surveillance des fichiers et le rebuild automatique
 */
async function startWatcher() {
  console.log('[Watch] Surveillance des fichiers source...');

  const watcher = chokidar.watch([path.join(SRC_DIR, '**/*')], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true,
  });

  let rebuildTimeout = null;

  const triggerRebuild = async () => {
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout);
    }
    rebuildTimeout = setTimeout(async () => {
      console.log('[Build] Rebuilding...');
      try {
        await build();
        console.log('[Build] Done!');
        notifyReload();
      } catch (error) {
        console.error('[Build] Error:', error.message);
      }
    }, 100); // Debounce de 100ms
  };

  watcher
    .on('change', (filePath) => {
      console.log(`[Watch] Fichier modifié: ${path.relative(__dirname, filePath)}`);
      triggerRebuild();
    })
    .on('add', (filePath) => {
      console.log(`[Watch] Fichier ajouté: ${path.relative(__dirname, filePath)}`);
      triggerRebuild();
    })
    .on('unlink', (filePath) => {
      console.log(`[Watch] Fichier supprimé: ${path.relative(__dirname, filePath)}`);
      triggerRebuild();
    });
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('='.repeat(50));
  console.log('  ServerFlow Sales Website - Dev Server');
  console.log('='.repeat(50));

  // Build initial
  console.log('\n[Build] Build initial...');
  try {
    await build();
    console.log('[Build] Build initial terminé!\n');
  } catch (error) {
    console.error('[Build] Erreur lors du build initial:', error.message);
    console.log('[Build] Le serveur démarre quand même...\n');
  }

  // Démarrer le watcher
  await startWatcher();

  // Démarrer le serveur
  server.listen(PORT, () => {
    console.log(`[Server] Serveur démarré sur http://localhost:${PORT}`);
    console.log(`[Server] Live reload activé via WebSocket`);
    console.log('\nURLs disponibles:');
    console.log(`  - English:  http://localhost:${PORT}/en/`);
    console.log(`  - Français: http://localhost:${PORT}/fr/`);
    console.log(`  - Deutsch:  http://localhost:${PORT}/de/`);
    console.log(`  - Español:  http://localhost:${PORT}/es/`);
    console.log(`  - Italiano: http://localhost:${PORT}/it/`);
    console.log('\nAppuyez sur Ctrl+C pour arrêter.\n');
  });
}

main().catch(console.error);
