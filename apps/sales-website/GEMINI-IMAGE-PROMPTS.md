# Prompts Gemini pour Générer les Images ServerFlow

## Contexte du Projet

ServerFlow est une plateforme SaaS Zero-Trust permettant de déployer des applications sur des VPS personnels. L'agent s'installe sur le serveur de l'utilisateur et communique via WebSocket sortant uniquement (jamais entrant).

**Design System:**
- Couleurs principales: Noir (#000), Violet (#8b5cf6, #a78bfa), Vert (#10b981)
- Style: Futuriste, minimaliste, tech premium
- Fond: Toujours noir/sombre avec effets de glow subtils

---

## 1. Icônes de Runtime (SVG recommandé, sinon PNG 128x128)

### Node.js
```
Generate a minimalist icon for Node.js programming runtime.
Style: Flat design with subtle glow effect on black background.
Colors: Green (#68a063) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic suitable for a dark-themed developer dashboard.
```

### Python
```
Generate a minimalist icon for Python programming language.
Style: Flat design with subtle glow effect on black background.
Colors: Blue (#3776ab) and yellow (#ffd43b), with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic suitable for a dark-themed developer dashboard.
```

### PHP
```
Generate a minimalist icon for PHP programming language.
Style: Flat design with subtle glow effect on black background.
Colors: Purple/blue (#777bb4) as primary, with soft violet glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic suitable for a dark-themed developer dashboard.
```

### Go (Golang)
```
Generate a minimalist icon for Go/Golang programming language.
Style: Flat design with subtle glow effect on black background.
Colors: Cyan/teal (#00add8) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic suitable for a dark-themed developer dashboard.
Do not include the gopher mascot, just abstract geometric representation.
```

### Rust
```
Generate a minimalist icon for Rust programming language.
Style: Flat design with subtle glow effect on black background.
Colors: Orange/copper (#dea584) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic suitable for a dark-themed developer dashboard.
Abstract gear-like design representing Rust's safety and performance.
```

### Ruby
```
Generate a minimalist icon for Ruby programming language.
Style: Flat design with subtle glow effect on black background.
Colors: Red (#cc342d) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic suitable for a dark-themed developer dashboard.
Gemstone-inspired abstract design.
```

### Docker
```
Generate a minimalist icon for Docker containerization platform.
Style: Flat design with subtle glow effect on black background.
Colors: Blue (#2496ed) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic suitable for a dark-themed developer dashboard.
Abstract container/whale-inspired design.
```

---

## 2. Icônes de Base de Données (128x128px)

### PostgreSQL
```
Generate a minimalist icon for PostgreSQL database.
Style: Flat design with subtle glow effect on black background.
Colors: Blue (#336791) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic. Abstract elephant-inspired or database cylinder design.
```

### MySQL/MariaDB
```
Generate a minimalist icon for MySQL database.
Style: Flat design with subtle glow effect on black background.
Colors: Orange (#f29111) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic. Abstract dolphin-inspired or database design.
```

### Redis
```
Generate a minimalist icon for Redis in-memory database.
Style: Flat design with subtle glow effect on black background.
Colors: Red (#dc382d) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic. Abstract design representing speed and caching.
```

---

## 3. Icônes Web & Proxy (128x128px)

### Nginx
```
Generate a minimalist icon for Nginx web server.
Style: Flat design with subtle glow effect on black background.
Colors: Green (#009639) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic. Abstract design representing reverse proxy/web server.
```

### HAProxy
```
Generate a minimalist icon for HAProxy load balancer.
Style: Flat design with subtle glow effect on black background.
Colors: Blue/teal (#0099cc) as primary, with soft purple glow (#8b5cf6) accent.
Size: 128x128px, transparent background.
Modern, tech aesthetic. Abstract design representing load balancing/distribution.
```

---

## 4. Hero Image pour la Page Features (1920x1080px)

```
Create a futuristic hero image for a DevOps deployment platform.

Scene: Abstract visualization of server infrastructure with floating 3D cubes
representing different services (databases, web servers, runtimes) connected
by glowing purple (#8b5cf6) data streams.

Style:
- Dark background (almost black #0a0a1a)
- Neon glow effects in purple (#8b5cf6) and green (#10b981)
- Isometric or 3D perspective
- Minimalist, clean, premium tech aesthetic
- No people, purely abstract tech visualization

Elements to include:
- Central glowing orb representing the control plane
- Satellite nodes representing VPS servers
- Connection lines with animated data packets
- Subtle grid pattern in background
- Floating icons for: Node.js, Python, PostgreSQL, Docker

Resolution: 1920x1080px, optimized for web (< 500KB)
```

---

## 5. Section Background - Deployments (1920x800px)

```
Create an abstract background image for a deployment services section.

Style:
- Very dark gradient (black to dark purple #0a0a1a to #1a1a2e)
- Subtle hexagonal grid pattern fading into darkness
- Small glowing nodes scattered representing services
- Light rays in purple (#8b5cf6) emanating from center
- Very subtle, should not distract from text overlay

Purpose: Background for a section listing deployment capabilities
Must be subtle enough to have white text readable on top.

Resolution: 1920x800px, optimized for web (< 300KB)
```

---

## 6. Illustration "29+ Services" (800x600px)

```
Create an infographic-style illustration showing multiple services.

Concept: A circular arrangement of small glowing icons representing:
- 7 programming languages (Node, Python, PHP, Go, Rust, Ruby, Docker)
- 3 databases (PostgreSQL, MySQL, Redis)
- 4 web services (Nginx, HAProxy, SSL, Certbot)
- 3 security tools (Firewall, VPN, Fail2ban)
- 5 email services (SMTP, IMAP, Antispam, DKIM, Antivirus)
- 3 monitoring tools (PM2, Netdata, Loki)
- 3 backup tools (Rsync, Rclone, Restic)

Style:
- Dark background (#000)
- Icons arranged in concentric circles
- Central "29+" number in glowing purple (#8b5cf6)
- Each category has its own subtle color theme
- Minimalist, schematic style
- Connecting lines between related services

Resolution: 800x600px
```

---

## 7. Security Diagram - Zero Trust (1200x400px)

```
Create a technical diagram showing Zero-Trust architecture.

Layout (left to right):
1. "Your VPS" box with green glow (#10b981) - contains server icon
2. Arrow pointing RIGHT ONLY (one-way) with "WebSocket" label
3. "ServerFlow" box with purple glow (#8b5cf6)

Key visual elements:
- The arrow must clearly show ONE-WAY communication (outbound only)
- "Your VPS" should have a shield/lock icon
- No incoming arrows to the VPS
- Data packets (small dots) flowing on the arrow
- Labels: "Outbound Only", "No SSH", "No Open Ports"

Style:
- Dark background
- Clean, schematic
- Glow effects on boxes
- Technical/blueprint aesthetic

Resolution: 1200x400px
```

---

## 8. Email Stack Diagram (1000x600px)

```
Create a technical diagram showing email server architecture.

Components to show (as connected boxes):
1. Internet (cloud icon)
2. Postfix (SMTP) - receives/sends mail
3. Rspamd (spam filter) - filters incoming
4. ClamAV (antivirus) - scans attachments
5. OpenDKIM (signing) - signs outgoing
6. Dovecot (storage) - stores in mailboxes
7. User mailboxes

Flow:
- Incoming mail: Internet → Postfix → Rspamd → ClamAV → Dovecot → Mailbox
- Outgoing mail: Mailbox → Postfix → OpenDKIM → Internet

Style:
- Dark background
- Each component has its own subtle color
- Arrows showing mail flow direction
- Clean, schematic, easy to understand
- Purple (#8b5cf6) for outgoing, green (#10b981) for incoming

Resolution: 1000x600px
```

---

## 9. Runtime Detection Animation Frames (400x300px each)

Pour une animation montrant la détection automatique du stack :

### Frame 1 - Scanning
```
Create frame 1 of a runtime detection animation.
Show: A folder icon being scanned with a magnifying glass
Text overlay: "Scanning project..."
Style: Dark background, purple glow scanning effect
Resolution: 400x300px
```

### Frame 2 - Detected
```
Create frame 2 of a runtime detection animation.
Show: Multiple file icons (package.json, requirements.txt, Cargo.toml)
      with checkmarks appearing
Text overlay: "Stack detected!"
Style: Dark background, green (#10b981) checkmarks with glow
Resolution: 400x300px
```

### Frame 3 - Deploying
```
Create frame 3 of a runtime detection animation.
Show: Rocket or upload icon with motion lines
Text overlay: "Deploying..."
Style: Dark background, purple (#8b5cf6) energy trails
Resolution: 400x300px
```

### Frame 4 - Live
```
Create frame 4 of a runtime detection animation.
Show: Globe icon with "HTTPS" badge and checkmark
Text overlay: "Live!"
Style: Dark background, green (#10b981) success glow
Resolution: 400x300px
```

---

## 10. Social Media / OG Image (1200x630px)

```
Create an Open Graph image for social media sharing.

Content:
- ServerFlow logo/text at top
- Tagline: "Deploy your entire stack. In one click."
- Visual: Abstract server/cloud infrastructure
- Badge: "29+ Services | Zero-Trust | Open Source"

Style:
- Dark gradient background (black to purple)
- White text, bold typography
- Purple (#8b5cf6) and green (#10b981) accent colors
- Clean, professional, premium tech aesthetic

Resolution: 1200x630px (OG image standard)
```

---

## Notes d'Utilisation

1. **Format recommandé**: SVG pour les icônes (scalable), PNG pour les illustrations
2. **Compression**: Utiliser TinyPNG ou Squoosh pour optimiser le poids
3. **Emplacement**: Sauvegarder dans `apps/sales-website/public/assets/`
4. **Naming convention**: `{category}-{name}.{ext}` (ex: `runtime-nodejs.svg`)

## Palette de Couleurs Officielle

| Nom | Hex | Usage |
|-----|-----|-------|
| Primary Purple | #8b5cf6 | Accents, CTAs, highlights |
| Light Purple | #a78bfa | Hover states, secondary |
| Success Green | #10b981 | Success states, security |
| Background | #000000 | Main background |
| Surface | #0a0a1a | Card backgrounds |
| Text Primary | #ffffff | Main text |
| Text Secondary | #9ca3af | Muted text |
| Border | rgba(255,255,255,0.1) | Subtle borders |
