# Sales Website - Règles et Prérogatives

**IMPORTANT** : Ce fichier contient toutes les règles à respecter lors du développement du site de vente ServerFlow.

---

## 1. Objectif du Site

Le site de vente a pour but de :

- Convertir les visiteurs en utilisateurs (signup)
- Expliquer clairement ce que fait ServerFlow
- Rassurer sur la sécurité (Zero-Trust)
- Positionner ServerFlow comme LA solution pour les créateurs AI

**Persona cible** : "Marc le Créateur AI" - 30-50 ans, utilise Claude/Cursor, niveau tech débutant à intermédiaire.

---

## 2. SEO - Règles Obligatoires

### 2.1 Structure des URLs

```
✅ CORRECT (URLs par langue)
/en/
/en/features
/en/pricing
/fr/
/fr/features
/fr/pricing

❌ INCORRECT (query params)
/?lang=en
/features?lang=fr
```

### 2.2 Meta Tags Obligatoires

Chaque page DOIT avoir :

```html
<!-- Meta de base -->
<title>{Page Title} | ServerFlow</title>
<meta name="description" content="{Description 150-160 caractères}" />
<meta name="keywords" content="{keywords séparés par virgule}" />
<link rel="canonical" href="https://serverflow.io/{lang}/{page}" />

<!-- Open Graph (Facebook, LinkedIn) -->
<meta property="og:title" content="{Title}" />
<meta property="og:description" content="{Description}" />
<meta property="og:image" content="https://serverflow.io/og/{page}.png" />
<meta property="og:url" content="https://serverflow.io/{lang}/{page}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ServerFlow" />
<meta property="og:locale" content="{en_US|fr_FR|de_DE|es_ES|it_IT}" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@serveraborada" />
<meta name="twitter:title" content="{Title}" />
<meta name="twitter:description" content="{Description}" />
<meta name="twitter:image" content="https://serverflow.io/og/{page}.png" />

<!-- hreflang pour multi-langue -->
<link rel="alternate" hreflang="en" href="https://serverflow.io/en/{page}" />
<link rel="alternate" hreflang="fr" href="https://serverflow.io/fr/{page}" />
<link rel="alternate" hreflang="de" href="https://serverflow.io/de/{page}" />
<link rel="alternate" hreflang="es" href="https://serverflow.io/es/{page}" />
<link rel="alternate" hreflang="it" href="https://serverflow.io/it/{page}" />
<link rel="alternate" hreflang="x-default" href="https://serverflow.io/en/{page}" />
```

### 2.3 Données Structurées (JSON-LD)

Chaque page DOIT avoir des données structurées appropriées :

```html
<!-- Page d'accueil - Organization -->
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ServerFlow",
    "url": "https://serverflow.io",
    "logo": "https://serverflow.io/logo.png",
    "description": "Zero-Trust deployment platform for AI-native developers",
    "sameAs": [
      "https://twitter.com/serverflow",
      "https://github.com/serverflow",
      "https://linkedin.com/company/serverflow"
    ]
  }
</script>

<!-- Page Pricing - Product -->
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "ServerFlow Pro",
    "description": "...",
    "offers": {
      "@type": "Offer",
      "price": "9",
      "priceCurrency": "EUR"
    }
  }
</script>

<!-- FAQ - FAQPage -->
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [...]
  }
</script>
```

### 2.4 Fichiers SEO Obligatoires

```
/robots.txt
/sitemap.xml
/sitemap-en.xml
/sitemap-fr.xml
/sitemap-de.xml
/sitemap-es.xml
/sitemap-it.xml
```

### 2.5 Balises Sémantiques

Utiliser les balises HTML5 sémantiques :

```html
<header>
  <!-- Navigation principale -->
  <main>
    <!-- Contenu principal (1 seul par page) -->
    <article>
      <!-- Contenu autonome (blog posts, etc.) -->
      <section>
        <!-- Sections thématiques -->
        <aside>
          <!-- Contenu secondaire -->
          <footer>
            <!-- Pied de page -->
            <nav><!-- Navigation --></nav>
          </footer>
        </aside>
      </section>
    </article>
  </main>
</header>
```

### 2.6 Images

- **Format** : WebP avec fallback PNG/JPG
- **Alt tags** : TOUJOURS remplis et descriptifs
- **Lazy loading** : `loading="lazy"` sur toutes les images below the fold
- **Dimensions** : Toujours spécifier `width` et `height`
- **Compression** : Max 100KB pour les images, 500KB pour les hero images

```html
<img
  src="image.webp"
  alt="Description détaillée de l'image"
  width="800"
  height="600"
  loading="lazy"
/>
```

---

## 3. Multi-Langue (i18n)

### 3.1 Langues Supportées

| Code | Langue   | Priorité   |
| ---- | -------- | ---------- |
| en   | English  | 1 (défaut) |
| fr   | Français | 2          |
| de   | Deutsch  | 3          |
| es   | Español  | 4          |
| it   | Italiano | 5          |

### 3.2 Structure des Fichiers de Traduction

```
/src/i18n/
├── en.json    # Anglais (source)
├── fr.json    # Français
├── de.json    # Allemand
├── es.json    # Espagnol
└── it.json    # Italien
```

### 3.3 Format des Fichiers de Traduction

```json
{
  "meta": {
    "title": "ServerFlow - Deploy to your own servers",
    "description": "Deploy code to your own VPS in 5 minutes..."
  },
  "nav": {
    "howItWorks": "How it Works",
    "features": "Features",
    "pricing": "Pricing",
    "login": "Log in",
    "getStarted": "Get Started"
  },
  "hero": {
    "title": "Deploy to your own servers.",
    "subtitle": "In 5 minutes. Zero DevOps.",
    "description": "The secure bridge between AI coding agents and your VPS.",
    "cta": "Start Deploying",
    "ctaSecondary": "See how it works"
  }
  // ... etc
}
```

### 3.4 Règles de Traduction

- **NE PAS traduire** : noms de marque (ServerFlow, GitHub, Claude), termes techniques anglais courants (VPS, SSL, API)
- **Adapter** : les expressions idiomatiques, pas les traduire mot à mot
- **Vérifier** : la longueur des textes (certaines langues sont plus longues)

---

## 4. Performance

### 4.1 Objectifs Core Web Vitals

| Métrique                       | Objectif |
| ------------------------------ | -------- |
| LCP (Largest Contentful Paint) | < 2.5s   |
| FID (First Input Delay)        | < 100ms  |
| CLS (Cumulative Layout Shift)  | < 0.1    |
| FCP (First Contentful Paint)   | < 1.8s   |
| TTI (Time to Interactive)      | < 3.8s   |

### 4.2 Règles de Performance

1. **CSS Critical** : Inliner le CSS critique dans le `<head>`
2. **JS Defer** : Tous les scripts avec `defer` ou `async`
3. **Fonts** : Utiliser `font-display: swap` et preload
4. **Images** : Lazy loading, formats modernes (WebP, AVIF)
5. **Pas de framework JS lourd** : Vanilla JS uniquement

```html
<!-- Preload critical assets -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" />

<!-- Critical CSS inline -->
<style>
  /* Critical CSS here */
</style>

<!-- Non-critical CSS async -->
<link
  rel="preload"
  href="/css/style.css"
  as="style"
  onload="this.onload=null;this.rel='stylesheet'"
/>

<!-- JS with defer -->
<script src="/js/main.js" defer></script>
```

---

## 5. Accessibilité (a11y)

### 5.1 Règles WCAG 2.1 AA

- **Contraste** : Ratio minimum 4.5:1 pour le texte, 3:1 pour les grands textes
- **Focus** : États de focus visibles sur tous les éléments interactifs
- **Alt tags** : Sur toutes les images
- **Labels** : Sur tous les inputs de formulaire
- **Keyboard** : Navigation complète au clavier
- **Skip links** : Lien "Skip to content" en premier élément

```html
<!-- Skip link -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Accessible form -->
<label for="email">Email address</label>
<input type="email" id="email" name="email" required aria-describedby="email-hint" />
<span id="email-hint" class="hint">We'll never share your email.</span>
```

### 5.2 ARIA Landmarks

```html
<nav role="navigation" aria-label="Main navigation">
  <main role="main" id="main-content">
    <footer role="contentinfo"></footer>
  </main>
</nav>
```

---

## 6. Structure des Pages

### 6.1 Pages à Créer

| Page      | URL               | Priorité SEO |
| --------- | ----------------- | ------------ |
| Home      | /{lang}/          | 1.0          |
| Features  | /{lang}/features  | 0.9          |
| Pricing   | /{lang}/pricing   | 0.9          |
| About     | /{lang}/about     | 0.7          |
| Contact   | /{lang}/contact   | 0.6          |
| Privacy   | /{lang}/privacy   | 0.3          |
| Terms     | /{lang}/terms     | 0.3          |
| Security  | /{lang}/security  | 0.8          |
| Changelog | /{lang}/changelog | 0.5          |

### 6.2 Structure des Composants

```
/src/components/
├── layout/
│   ├── header.html      # Navigation principale
│   ├── footer.html      # Pied de page
│   └── head.html        # Meta tags, CSS, etc.
├── sections/
│   ├── hero.html        # Section hero
│   ├── how-it-works.html
│   ├── features.html
│   ├── security.html
│   ├── testimonials.html
│   ├── pricing.html
│   ├── faq.html
│   └── cta.html
└── ui/
    ├── button.html
    ├── card.html
    ├── terminal.html
    └── ...
```

---

## 7. Design System

### 7.1 Couleurs

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  --bg-elevated: #1a1a1a;

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  /* Accent */
  --accent-primary: #8b5cf6; /* Violet */
  --accent-secondary: #3b82f6; /* Bleu */
  --accent-gradient: linear-gradient(135deg, #8b5cf6, #3b82f6);

  /* Semantic */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-default: rgba(255, 255, 255, 0.15);
}
```

### 7.2 Typography

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Fira Code', 'Consolas', monospace;

  /* Scale */
  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.125rem; /* 18px */
  --text-xl: 1.25rem; /* 20px */
  --text-2xl: 1.5rem; /* 24px */
  --text-3xl: 2rem; /* 32px */
  --text-4xl: 2.5rem; /* 40px */
  --text-5xl: 3rem; /* 48px */
  --text-6xl: 4rem; /* 64px */
}
```

### 7.3 Spacing

```css
:root {
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-10: 2.5rem; /* 40px */
  --space-12: 3rem; /* 48px */
  --space-16: 4rem; /* 64px */
  --space-20: 5rem; /* 80px */
  --space-24: 6rem; /* 96px */
}
```

---

## 8. Contenu - Règles Éditoriales

### 8.1 Tone of Voice

- **Confiant** mais pas arrogant
- **Simple** mais pas simpliste
- **Direct** mais pas agressif
- **Technique** quand nécessaire, mais accessible

### 8.2 Règles de Copywriting

1. **Bénéfices > Features** : Parler des résultats, pas des fonctionnalités
2. **Phrases courtes** : Max 20 mots par phrase
3. **Verbes d'action** : "Deploy", "Ship", "Build", pas "is able to"
4. **Chiffres concrets** : "47 seconds" au lieu de "very fast"
5. **Social proof** : Témoignages, logos, chiffres

### 8.3 Ce qu'on NE DIT PAS

- ❌ Pas de superlatifs non prouvables ("best", "fastest", "most secure")
- ❌ Pas de promesses qu'on ne peut pas tenir
- ❌ Pas de jargon inutile
- ❌ Pas de négativité excessive sur les concurrents

### 8.4 Ce qu'on DIT

- ✅ "Zero-Trust by design" (prouvable)
- ✅ "Deploy in < 5 minutes" (mesurable)
- ✅ "Ed25519 encryption" (factuel)
- ✅ "Your servers, your rules" (différenciateur)

---

## 9. Sécurité du Site

### 9.1 Headers HTTP

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 9.2 HTTPS

- Toujours HTTPS en production
- Redirect HTTP → HTTPS
- HSTS header activé

---

## 10. Analytics et Tracking

### 10.1 Outils Autorisés

- **Analytics** : Plausible (GDPR-friendly) ou Umami (self-hosted)
- **Pas de** : Google Analytics, Facebook Pixel (problèmes GDPR)

### 10.2 Events à Tracker

```javascript
// Pages vues (automatique)
// Clics sur CTA
trackEvent('cta_click', { location: 'hero', text: 'Get Started' });
// Signup
trackEvent('signup_start');
trackEvent('signup_complete');
// Langue changée
trackEvent('language_change', { from: 'en', to: 'fr' });
```

---

## 11. Build et Déploiement

### 11.1 Structure de Build

```
/dist/                    # Output du build
├── en/
│   ├── index.html
│   ├── features/index.html
│   ├── pricing/index.html
│   └── ...
├── fr/
│   └── ...
├── de/
│   └── ...
├── css/
│   └── style.min.css
├── js/
│   └── main.min.js
├── assets/
│   └── images/
├── robots.txt
├── sitemap.xml
└── _redirects           # Pour Netlify/Cloudflare
```

### 11.2 Process de Build

1. Compiler les templates avec les traductions
2. Minifier CSS
3. Minifier JS
4. Optimiser les images
5. Générer le sitemap
6. Générer les fichiers OG images

### 11.3 Environnements

| Env        | URL                   | Port Local |
| ---------- | --------------------- | ---------- |
| Dev        | localhost:4500        | 4500       |
| Staging    | staging.serverflow.io | -          |
| Production | serverflow.io         | -          |

---

## 12. Checklist Avant Mise en Prod

### SEO

- [ ] Toutes les pages ont des meta tags uniques
- [ ] Sitemap.xml généré et à jour
- [ ] robots.txt configuré
- [ ] Données structurées validées (schema.org validator)
- [ ] hreflang sur toutes les pages

### Performance

- [ ] Score Lighthouse > 90 sur toutes les métriques
- [ ] Images optimisées et en WebP
- [ ] CSS/JS minifiés
- [ ] Fonts preloadées

### Accessibilité

- [ ] Score Lighthouse Accessibility > 95
- [ ] Navigation clavier fonctionnelle
- [ ] Contrastes validés

### Contenu

- [ ] Traductions complètes pour toutes les langues
- [ ] Pas de "Lorem ipsum" ou placeholder
- [ ] Liens tous fonctionnels
- [ ] Images avec alt tags

### Technique

- [ ] HTTPS actif
- [ ] Headers de sécurité configurés
- [ ] Analytics configuré
- [ ] Formulaires fonctionnels

---

## 13. Commandes Utiles

```bash
# Développement
pnpm --filter @server-flow/sales-website dev

# Build
pnpm --filter @server-flow/sales-website build

# Preview du build
pnpm --filter @server-flow/sales-website preview

# Vérifier le SEO
pnpm --filter @server-flow/sales-website seo:check

# Générer le sitemap
pnpm --filter @server-flow/sales-website sitemap
```

---

**Version** : 1.0.0
**Dernière mise à jour** : 2025-01-29
**Maintenu par** : Claude Code
