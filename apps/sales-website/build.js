/**
 * @file apps/sales-website/build.js
 * @description Système de build pour le site de vente ServerFlow.
 * Compile les templates HTML avec les traductions i18n et génère
 * les fichiers statiques optimisés pour la production.
 *
 * @dependencies
 * - fs/path: Manipulation des fichiers et chemins
 *
 * @fonctions_principales
 * - build(): Fonction principale de compilation
 * - compileTemplate(): Compile un template avec les variables
 * - loadTranslations(): Charge les fichiers de traduction
 * - generateSitemap(): Génère le sitemap.xml
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const I18N_DIR = path.join(SRC_DIR, 'i18n');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components');
const PAGES_DIR = path.join(SRC_DIR, 'pages');

// Langues supportées
const LANGUAGES = ['en', 'fr', 'de', 'es', 'it'];
const DEFAULT_LANG = 'en';

// Configuration des pages
const PAGES = [
  { name: 'index', priority: 1.0 },
  { name: 'features', priority: 0.9 },
  { name: 'pricing', priority: 0.9 },
  { name: 'about', priority: 0.7 },
  { name: 'contact', priority: 0.6 },
  { name: 'security', priority: 0.8 },
  { name: 'privacy', priority: 0.3 },
  { name: 'terms', priority: 0.3 },
  { name: 'changelog', priority: 0.5 },
  { name: 'careers', priority: 0.5 },
  { name: 'gdpr', priority: 0.3 },
  { name: 'dpa', priority: 0.3 },
  { name: 'press', priority: 0.4 },
  { name: '404', priority: 0 },
];

/**
 * Charge un fichier de traduction JSON
 * @param {string} lang - Code de la langue (en, fr, etc.)
 * @returns {object} - Objet de traductions
 */
function loadTranslations(lang) {
  const filePath = path.join(I18N_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[i18n] Fichier de traduction manquant: ${filePath}`);
    // Fallback sur l'anglais
    if (lang !== DEFAULT_LANG) {
      return loadTranslations(DEFAULT_LANG);
    }
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Charge un composant HTML
 * @param {string} componentPath - Chemin relatif du composant
 * @returns {string} - Contenu HTML du composant
 */
function loadComponent(componentPath) {
  const fullPath = path.join(COMPONENTS_DIR, componentPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[Component] Composant manquant: ${fullPath}`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Remplace les variables {{variable}} dans un template
 * Supporte aussi {{variable.nested}} pour les objets imbriqués
 * @param {string} template - Template HTML
 * @param {object} data - Données de remplacement
 * @returns {string} - Template compilé
 */
function replaceVariables(template, data) {
  // Remplacer les variables simples et imbriquées
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const keys = key.trim().split('.');
    let value = data;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return match; // Garder le placeholder si non trouvé
      }
    }
    return value !== undefined ? value : match;
  });
}

/**
 * Traite les inclusions de composants {{> componentPath}}
 * @param {string} template - Template HTML
 * @returns {string} - Template avec composants inclus
 */
function processIncludes(template) {
  return template.replace(/\{\{>\s*([^}]+)\s*\}\}/g, (match, componentPath) => {
    const component = loadComponent(componentPath.trim() + '.html');
    // Récursivement traiter les inclusions
    return processIncludes(component);
  });
}

/**
 * Traite les conditions {{#if variable}}...{{/if}}
 * @param {string} template - Template HTML
 * @param {object} data - Données pour évaluer les conditions
 * @returns {string} - Template avec conditions évaluées
 */
function processConditions(template, data) {
  // Traiter {{#if variable}}...{{/if}}
  let result = template.replace(
    /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, condition, content) => {
      const keys = condition.trim().split('.');
      let value = data;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }
      return value ? content : '';
    }
  );

  // Traiter {{#unless variable}}...{{/unless}}
  result = result.replace(
    /\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (match, condition, content) => {
      const keys = condition.trim().split('.');
      let value = data;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }
      return !value ? content : '';
    }
  );

  return result;
}

/**
 * Traite les boucles {{#each items}}...{{/each}}
 * @param {string} template - Template HTML
 * @param {object} data - Données avec les tableaux
 * @returns {string} - Template avec boucles déroulées
 */
function processLoops(template, data) {
  return template.replace(
    /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match, arrayPath, itemTemplate) => {
      const keys = arrayPath.trim().split('.');
      let array = data;
      for (const k of keys) {
        if (array && typeof array === 'object' && k in array) {
          array = array[k];
        } else {
          array = [];
          break;
        }
      }

      if (!Array.isArray(array)) return '';

      return array.map((item, index) => {
        let compiled = itemTemplate;
        // Remplacer {{this}} par l'élément courant (si string)
        if (typeof item === 'string') {
          compiled = compiled.replace(/\{\{this\}\}/g, item);
        }
        // Remplacer {{@index}} par l'index
        compiled = compiled.replace(/\{\{@index\}\}/g, String(index));
        // Remplacer les propriétés de l'item
        if (typeof item === 'object') {
          compiled = replaceVariables(compiled, item);
        }
        return compiled;
      }).join('');
    }
  );
}

/**
 * Compile un template complet
 * @param {string} template - Template HTML source
 * @param {object} data - Données de compilation
 * @returns {string} - HTML compilé
 */
function compileTemplate(template, data) {
  let result = template;

  // 1. Inclure les composants
  result = processIncludes(result);

  // 2. Traiter les boucles
  result = processLoops(result, data);

  // 3. Traiter les conditions
  result = processConditions(result, data);

  // 4. Remplacer les variables (premier passage)
  result = replaceVariables(result, data);

  // 5. Second passage pour les variables dans les traductions (ex: {{currentYear}} dans footer.copyright)
  result = replaceVariables(result, data);

  return result;
}

/**
 * Génère le fichier sitemap.xml
 * @param {string} baseUrl - URL de base du site
 */
function generateSitemap(baseUrl = 'https://serverflow.io') {
  const urls = [];
  const today = new Date().toISOString().split('T')[0];

  for (const page of PAGES) {
    if (page.priority === 0) continue; // Skip 404

    for (const lang of LANGUAGES) {
      const pagePath = page.name === 'index' ? '' : `${page.name}/`;
      urls.push({
        loc: `${baseUrl}/${lang}/${pagePath}`,
        lastmod: today,
        changefreq: page.priority >= 0.8 ? 'weekly' : 'monthly',
        priority: page.priority,
      });
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
${LANGUAGES.map(lang => {
  const altLoc = url.loc.replace(/\/(en|fr|de|es|it)\//, `/${lang}/`);
  return `    <xhtml:link rel="alternate" hreflang="${lang}" href="${altLoc}" />`;
}).join('\n')}
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
}

/**
 * Génère le fichier robots.txt
 * @param {string} baseUrl - URL de base du site
 */
function generateRobotsTxt(baseUrl = 'https://serverflow.io') {
  const robots = `# ServerFlow Sales Website
User-agent: *
Allow: /

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml

# Disallow admin/internal paths
Disallow: /api/
Disallow: /admin/
`;

  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots);
}

/**
 * Copie les assets statiques (CSS, JS, images)
 */
function copyAssets() {
  const assetsDir = path.join(SRC_DIR, 'assets');
  const distAssetsDir = path.join(DIST_DIR, 'assets');

  if (fs.existsSync(assetsDir)) {
    copyDirRecursive(assetsDir, distAssetsDir);
  }

  // Copier le CSS
  const cssDir = path.join(SRC_DIR, 'css');
  const distCssDir = path.join(DIST_DIR, 'css');
  if (fs.existsSync(cssDir)) {
    copyDirRecursive(cssDir, distCssDir);
  }

  // Copier le JS
  const jsDir = path.join(SRC_DIR, 'js');
  const distJsDir = path.join(DIST_DIR, 'js');
  if (fs.existsSync(jsDir)) {
    copyDirRecursive(jsDir, distJsDir);
  }
}

/**
 * Copie récursive d'un dossier
 * @param {string} src - Dossier source
 * @param {string} dest - Dossier destination
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Fonction principale de build
 */
export async function build() {
  // Nettoyer le dossier dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // Charger le layout de base
  const layoutPath = path.join(COMPONENTS_DIR, 'layout', 'base.html');
  if (!fs.existsSync(layoutPath)) {
    console.warn('[Build] Layout de base manquant, création du dossier structure...');
    // Créer la structure de dossiers si elle n'existe pas
    const dirs = [
      path.join(SRC_DIR, 'components', 'layout'),
      path.join(SRC_DIR, 'components', 'sections'),
      path.join(SRC_DIR, 'components', 'ui'),
      path.join(SRC_DIR, 'pages'),
      path.join(SRC_DIR, 'i18n'),
      path.join(SRC_DIR, 'css'),
      path.join(SRC_DIR, 'js'),
      path.join(SRC_DIR, 'assets', 'images'),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    return;
  }

  const layout = fs.readFileSync(layoutPath, 'utf-8');

  // Compiler chaque page pour chaque langue
  for (const lang of LANGUAGES) {
    const translations = loadTranslations(lang);
    const langDir = path.join(DIST_DIR, lang);
    fs.mkdirSync(langDir, { recursive: true });

    for (const page of PAGES) {
      const pagePath = path.join(PAGES_DIR, `${page.name}.html`);
      if (!fs.existsSync(pagePath)) {
        console.warn(`[Build] Page manquante: ${pagePath}`);
        continue;
      }

      const pageContent = fs.readFileSync(pagePath, 'utf-8');

      // Préparer les données de compilation
      const data = {
        ...translations,
        lang,
        page: page.name,
        pageUrl: page.name === 'index' ? '' : page.name + '/',
        currentYear: new Date().getFullYear(),
        availableLanguages: LANGUAGES,
        isDefaultLang: lang === DEFAULT_LANG,
        // Générer les URLs alternatives pour hreflang
        alternateUrls: LANGUAGES.map(l => ({
          lang: l,
          url: `https://serverflow.io/${l}/${page.name === 'index' ? '' : page.name + '/'}`,
        })),
      };

      // Injecter le contenu de la page dans le layout
      let html = layout.replace('{{> content}}', pageContent);

      // Compiler le template
      html = compileTemplate(html, data);

      // Écrire le fichier
      const outputDir = page.name === 'index'
        ? langDir
        : path.join(langDir, page.name);

      if (page.name !== 'index') {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = page.name === 'index'
        ? path.join(langDir, 'index.html')
        : path.join(outputDir, 'index.html');

      fs.writeFileSync(outputPath, html);
    }
  }

  // Copier les assets
  copyAssets();

  // Générer sitemap et robots.txt
  generateSitemap();
  generateRobotsTxt();

  console.log(`[Build] ${LANGUAGES.length} langues x ${PAGES.length} pages générées`);
}

// Si exécuté directement
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build()
    .then(() => console.log('Build terminé!'))
    .catch(console.error);
}
