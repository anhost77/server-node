# Feature Proposal: Mail Server Configuration Wizard

**Date** : 2026-01-27
**Proposé par** : User + Claude (Product Manager)
**Status** : draft

## 📋 Résumé

Créer un composant wizard pour configurer et installer une stack mail complète sur un ou plusieurs serveurs, avec support pour différentes architectures (monolithique, distribuée, haute disponibilité).

## 🎯 Objectifs

1. Simplifier l'installation d'une stack mail complète
2. Supporter différentes architectures selon les besoins
3. Générer automatiquement les enregistrements DNS requis
4. Permettre la configuration sur plusieurs serveurs
5. Gérer les certificats TLS automatiquement

## 🔍 Recherches & Meilleures Pratiques

### Standards Mail
- **SPF** : Sender Policy Framework (RFC 7208)
- **DKIM** : DomainKeys Identified Mail (RFC 6376)
- **DMARC** : Domain-based Message Authentication (RFC 7489)
- **MTA-STS** : SMTP MTA Strict Transport Security (RFC 8461)
- **DANE** : DNS-based Authentication (RFC 7671)

### Architectures Référence
- **iRedMail** : Solution monolithique populaire
- **Mailcow** : Docker-based, moderne
- **Mail-in-a-Box** : Simple, tout-en-un
- **Postal** : Orienté transactionnel

## 👥 Personas Utilisateurs

1. **PME/Startup** : Veut un serveur mail simple, un seul serveur
2. **Entreprise** : Besoin de scalabilité, plusieurs serveurs
3. **MSP** : Gère plusieurs domaines/clients, haute disponibilité

## 🏗️ Architecture Technique

### Composant Vue.js : MailServerWizard

```
MailServerWizard.vue
├── Step 1: Architecture Selection
│   ├── Single Server (Monolithic)
│   ├── Distributed (Multi-server)
│   └── High Availability (Cluster)
│
├── Step 2: Server Role Assignment
│   ├── Select servers from connected servers
│   ├── Assign roles: MX Frontend, Mail Storage, Outbound MTA
│   └── Configure internal networking
│
├── Step 3: Domain Configuration
│   ├── Primary domain
│   ├── Additional domains
│   └── Mailbox domains vs relay domains
│
├── Step 4: Security Configuration
│   ├── TLS: Let's Encrypt / Custom / Self-signed
│   ├── DKIM: Key generation
│   ├── SPF: Policy configuration
│   └── DMARC: Policy configuration
│
├── Step 5: Services Selection
│   ├── Antispam: Rspamd (recommended) / SpamAssassin
│   ├── Antivirus: ClamAV (optional)
│   ├── Webmail: Roundcube (optional)
│   └── Admin Panel: Postfixadmin (optional)
│
├── Step 6: Storage Configuration
│   ├── Local Maildir
│   ├── NFS Shared Storage
│   └── Object Storage (S3-compatible)
│
├── Step 7: DNS Records Generation
│   ├── MX records
│   ├── SPF record
│   ├── DKIM record (with public key)
│   ├── DMARC record
│   └── Autodiscover/Autoconfig records
│
└── Step 8: Installation & Verification
    ├── Progress tracking per server
    ├── Service verification
    ├── Send test email
    └── DNS verification
```

### Types TypeScript

```typescript
// Architecture types
type MailArchitecture = 'single' | 'distributed' | 'ha-cluster';

// Server roles
type MailServerRole =
  | 'mx-inbound'      // Receives external mail
  | 'mx-outbound'     // Sends external mail
  | 'mail-storage'    // Dovecot + mailboxes
  | 'antispam'        // Rspamd/ClamAV
  | 'all-in-one';     // Everything on one server

// Configuration
interface MailServerConfig {
  architecture: MailArchitecture;
  servers: MailServerAssignment[];
  domain: DomainConfig;
  security: SecurityConfig;
  services: ServicesConfig;
  storage: StorageConfig;
}

interface MailServerAssignment {
  serverId: string;
  serverName: string;
  roles: MailServerRole[];
  internalIp?: string;
}

interface DomainConfig {
  primaryDomain: string;
  additionalDomains: string[];
  hostname: string;  // mail.example.com
}

interface SecurityConfig {
  tls: {
    provider: 'letsencrypt' | 'custom' | 'selfsigned';
    certificate?: string;
    privateKey?: string;
  };
  dkim: {
    enabled: boolean;
    selector: string;  // e.g., 'default', '2024'
    keySize: 1024 | 2048 | 4096;
  };
  spf: {
    policy: 'strict' | 'softfail' | 'neutral';
    includes: string[];
  };
  dmarc: {
    policy: 'none' | 'quarantine' | 'reject';
    rua?: string;  // Aggregate report email
    ruf?: string;  // Forensic report email
    percentage: number;
  };
}

interface ServicesConfig {
  antispam: 'rspamd' | 'spamassassin' | 'none';
  antivirus: boolean;
  webmail: 'roundcube' | 'none';
  adminPanel: 'postfixadmin' | 'none';
}

interface StorageConfig {
  type: 'maildir' | 'nfs' | 's3';
  path?: string;
  nfsServer?: string;
  s3Endpoint?: string;
  s3Bucket?: string;
}
```

## 🔒 Considérations Sécurité

1. **Clés DKIM** : Générées côté serveur, jamais exposées au dashboard
2. **Mots de passe** : Générés aléatoirement, affichés une seule fois
3. **TLS** : Minimum TLS 1.2, préférence TLS 1.3
4. **Rate limiting** : Par défaut sur l'envoi
5. **Fail2ban** : Intégré pour Postfix/Dovecot

## 📊 Estimation

- **Complexité** : High
- **Story Points** : 13
- **Durée estimée** : 3-5 jours

## 📝 Epic & Stories

### Epic 10: Mail Server Wizard

| Story | Titre | Points | Priorité |
|-------|-------|--------|----------|
| 10-1 | Architecture selection UI | 3 | P1 |
| 10-2 | Server role assignment | 5 | P1 |
| 10-3 | Domain & security config | 3 | P1 |
| 10-4 | DNS records generation | 3 | P1 |
| 10-5 | Multi-server installation orchestration | 8 | P1 |
| 10-6 | Installation verification & testing | 3 | P1 |
| 10-7 | HA/Cluster configuration (future) | 8 | P2 |
| 10-8 | Webmail integration (future) | 5 | P3 |

## ✅ Validation

- [ ] Product Manager : En attente
- [ ] UX : En attente (wireframes nécessaires)
- [ ] Dev : Architecture validée
- [ ] Security : En attente

---

## Notes d'Implémentation

### Phase 1 : MVP (Single Server) ✅ DONE
- Wizard pour architecture monolithique uniquement
- Tous les services sur un serveur
- Génération DNS automatique
- Installation séquentielle des services

### Phase 2 : Distributed 📋 PLANNED (Epic 8)
- Support multi-serveurs
- Communication interne sécurisée
- Configuration des rôles
- **Voir**: `_bmad-output/implementation-artifacts/8-distributed-mail-architecture.md`

### Phase 3 : HA/Cluster (Future)
- Réplication Dovecot
- Multiple MX avec failover
- Shared storage

