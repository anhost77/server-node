# Epic 8: Distributed Mail Architecture

**Status**: backlog
**Priority**: P2 (Post-MVP)
**Complexity**: Very High
**Estimated Points**: 34

---

## 📋 Contexte

L'architecture mail distribuée permet de séparer les composants d'une stack mail sur plusieurs serveurs pour améliorer la scalabilité, la résilience et les performances. C'est essentiel pour les entreprises et MSPs qui gèrent des volumes importants d'emails.

### Pourquoi Distribué ?

| Architecture | Cas d'usage | Avantages | Inconvénients |
|--------------|-------------|-----------|---------------|
| **Single** | PME, < 100 users | Simple, moins cher | Point de défaillance unique |
| **Distributed** | Entreprise, 100-10k users | Scalable, spécialisé | Plus complexe à gérer |
| **HA Cluster** | MSP, > 10k users | Haute dispo, failover | Coût élevé, complexité max |

---

## 🎯 Objectifs de l'Epic

1. Permettre l'installation de composants mail sur différents serveurs
2. Orchestrer la configuration automatique des communications inter-serveurs
3. Gérer les certificats TLS pour chaque serveur
4. Assurer la sécurité des communications internes (réseau privé ou VPN)
5. Fournir une UI claire pour l'assignation des rôles aux serveurs

---

## 🏗️ Architecture Technique

### Rôles des Serveurs

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE DISTRIBUÉE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  MX Frontend │    │ Mail Storage │    │   Antispam   │  │
│  │  (Postfix)   │───▶│  (Dovecot)   │◀───│  (Rspamd)    │  │
│  │              │    │              │    │  (ClamAV)    │  │
│  │  Port: 25    │    │ Port: 143/993│    │  Port: 11334 │  │
│  │       587    │    │       110/995│    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │           │
│         └───────────────────┴───────────────────┘           │
│                    Internal Network                          │
│                    (Private IPs / VPN)                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flux de Communication

```
[Internet] ──SMTP:25──▶ [MX Frontend]
                              │
                              ├──Milter:11332──▶ [Antispam (Rspamd)]
                              │                        │
                              │       ◀──────────────────┘
                              │
                              ├──LMTP:24──▶ [Mail Storage (Dovecot)]
                              │
[User] ──IMAPS:993──▶ [Mail Storage (Dovecot)]
[User] ──Submission:587──▶ [MX Frontend] ──relay──▶ [Internet]
```

### Types TypeScript (Extension)

```typescript
// Roles étendus pour architecture distribuée
type DistributedMailRole =
  | 'mx-inbound'     // Reçoit les emails entrants (Postfix)
  | 'mx-outbound'    // Envoie les emails sortants (Postfix relay)
  | 'mail-storage'   // Stocke les boîtes mail (Dovecot)
  | 'antispam'       // Filtrage spam/virus (Rspamd + ClamAV)
  | 'webmail'        // Interface web (Roundcube)
  | 'admin'          // Panel d'administration (Postfixadmin)

// Configuration multi-serveur
interface DistributedMailConfig {
  architecture: 'distributed';

  // Mapping serveur -> rôles
  serverAssignments: {
    serverId: string;
    serverAlias: string;
    publicIp: string;
    privateIp?: string;  // Pour communication interne
    roles: DistributedMailRole[];
  }[];

  // Configuration réseau interne
  internalNetwork: {
    type: 'direct' | 'vpn' | 'private-network';
    subnet?: string;  // ex: 10.0.0.0/24
    vpnType?: 'wireguard' | 'tailscale';
  };

  // Domain et sécurité (hérité de MailServerConfig)
  domain: DomainConfig;
  security: SecurityConfig;

  // Configuration spécifique distribuée
  replication?: {
    enabled: boolean;
    type: 'dsync' | 'nfs';
  };
}

// Message WebSocket pour orchestration multi-serveur
interface DistributedInstallMessage {
  type: 'DISTRIBUTED_MAIL_INSTALL';
  payload: {
    phase: 'prepare' | 'install' | 'configure' | 'verify';
    config: DistributedMailConfig;
    targetServerId: string;
    dependencies: {
      serverId: string;
      role: DistributedMailRole;
      endpoint: string;  // IP:port ou hostname
    }[];
  };
}
```

---

## 📝 Stories

### Story 8-1: Server Role Selection UI

**Points**: 5
**Priority**: P1

**En tant que** utilisateur,
**Je veux** pouvoir sélectionner quels serveurs hébergeront quels composants mail,
**Afin de** construire une architecture mail distribuée adaptée à mes besoins.

**Critères d'acceptation**:
- [ ] UI de sélection des serveurs connectés
- [ ] Drag & drop des rôles vers les serveurs
- [ ] Validation des prérequis par serveur (RAM, disk, OS)
- [ ] Indicateur visuel des conflits (ex: 2x mx-inbound sans load balancer)
- [ ] Preview de l'architecture générée

**Fichiers à créer/modifier**:
- `apps/dashboard/src/components/mail/DistributedRoleSelector.vue`
- `apps/dashboard/src/components/mail/ServerRoleCard.vue`

---

### Story 8-2: Internal Network Configuration

**Points**: 8
**Priority**: P1

**En tant que** utilisateur,
**Je veux** configurer comment les serveurs communiquent entre eux,
**Afin de** sécuriser les échanges internes de ma stack mail.

**Critères d'acceptation**:
- [ ] Choix du type de réseau: Direct IP, VPN (WireGuard), Private Network (cloud provider)
- [ ] Configuration automatique des IPs privées si disponibles
- [ ] Génération des règles firewall (UFW) pour chaque serveur
- [ ] Test de connectivité inter-serveurs avant installation
- [ ] Documentation des ports ouverts

**Fichiers à créer/modifier**:
- `apps/agent/src/infrastructure/installers/services/network.ts`
- `apps/agent/src/infrastructure/templates/ufw/distributed-mail.rules`

---

### Story 8-3: Multi-Server Installation Orchestration

**Points**: 13
**Priority**: P1

**En tant que** control-plane,
**Je veux** orchestrer l'installation sur plusieurs serveurs dans le bon ordre,
**Afin de** garantir que les dépendances sont respectées.

**Critères d'acceptation**:
- [ ] Ordre d'installation défini: Network → Antispam → Storage → MX
- [ ] Installation parallèle quand possible
- [ ] Gestion des erreurs avec rollback partiel
- [ ] Progress tracking par serveur dans l'UI
- [ ] Configuration des endpoints inter-serveurs automatique

**Ordre d'installation**:
```
Phase 1 (Parallel):
  - Server A: Configure firewall rules
  - Server B: Configure firewall rules
  - Server C: Configure firewall rules

Phase 2 (Sequential):
  - Server C (Antispam): Install Rspamd + ClamAV

Phase 3 (Sequential):
  - Server B (Storage): Install Dovecot
    - Configure LMTP listener on internal IP

Phase 4 (Sequential):
  - Server A (MX Frontend): Install Postfix
    - Configure milter → Server C (Rspamd)
    - Configure LMTP transport → Server B (Dovecot)

Phase 5 (Verification):
  - Test mail flow end-to-end
```

**Fichiers à créer/modifier**:
- `apps/control-plane/src/services/mail-orchestrator.ts`
- `apps/control-plane/src/jobs/distributed-mail-install.ts`

---

### Story 8-4: Cross-Server Configuration Templates

**Points**: 5
**Priority**: P1

**En tant que** agent,
**Je veux** recevoir les configurations avec les références aux autres serveurs,
**Afin de** configurer correctement les services pour communiquer entre eux.

**Critères d'acceptation**:
- [ ] Template Postfix avec endpoint Rspamd externe
- [ ] Template Postfix avec transport LMTP vers Dovecot externe
- [ ] Template Dovecot avec listener LMTP sur IP interne
- [ ] Template Rspamd avec listener sur IP interne
- [ ] Gestion des certificats TLS pour communication interne

**Templates à créer**:
```
apps/agent/src/infrastructure/templates/
├── postfix/
│   ├── main.cf.distributed  # Config pour MX dans arch distribuée
│   └── transport.distributed # Transport vers Dovecot externe
├── dovecot/
│   └── lmtp.distributed.conf # LMTP listener externe
└── rspamd/
    └── worker-proxy.distributed.inc # Listener externe
```

---

### Story 8-5: Distributed Health Monitoring

**Points**: 3
**Priority**: P2

**En tant que** utilisateur,
**Je veux** voir l'état de santé de chaque composant de ma stack distribuée,
**Afin de** détecter rapidement les problèmes.

**Critères d'acceptation**:
- [ ] Dashboard avec vue topologique de l'architecture
- [ ] Status de chaque service sur chaque serveur
- [ ] Alertes si un composant est down
- [ ] Latence inter-services
- [ ] Queue mail sur chaque serveur

**Fichiers à créer/modifier**:
- `apps/dashboard/src/components/mail/DistributedMailTopology.vue`
- `apps/agent/src/commands/MAIL_HEALTH_CHECK.ts`

---

## 🔒 Considérations Sécurité

### Communication Inter-Serveurs

1. **Réseau privé** : Toujours préférer les IPs privées quand disponibles
2. **Firewall** : N'ouvrir que les ports nécessaires entre serveurs
3. **TLS interne** : Optionnel mais recommandé pour LMTP/Milter
4. **Authentication** : SASL pour les communications Postfix ↔ Dovecot

### Ports à Ouvrir

| Source | Destination | Port | Service | Requis |
|--------|-------------|------|---------|--------|
| Internet | MX Frontend | 25 | SMTP | Oui |
| Internet | MX Frontend | 587 | Submission | Oui |
| Internet | Mail Storage | 993 | IMAPS | Oui |
| MX Frontend | Antispam | 11332 | Rspamd Milter | Oui |
| MX Frontend | Mail Storage | 24 | LMTP | Oui |
| Antispam | Mail Storage | 11334 | Rspamd HTTP | Non (optionnel) |

---

## 🧪 Plan de Tests

### Tests Unitaires
- [ ] Validation des configurations distribuées
- [ ] Génération des templates avec variables externes
- [ ] Ordre d'installation correct

### Tests d'Intégration
- [ ] Installation complète sur 3 VMs (MX, Storage, Antispam)
- [ ] Flow email complet: Internet → MX → Rspamd → Dovecot
- [ ] Submission: User → MX → Internet

### Tests de Résilience
- [ ] Comportement si Rspamd down (mail passent en mode bypass)
- [ ] Comportement si Dovecot down (mail en queue sur MX)
- [ ] Reconnexion automatique après redémarrage

---

## 📊 Dépendances

### Prérequis
- [x] Story 7-10: Mail Server Wizard (architecture single)
- [x] Agent capable d'installer services mail individuellement
- [ ] API pour récupérer les IPs des serveurs connectés

### Bloqué par
- Rien (peut commencer après MVP mail single-server)

### Débloque
- Epic 9: HA Mail Cluster (futur)

---

## ✅ Checklist de Validation

- [ ] Product Manager : Architecture approuvée
- [ ] Security : Réseau interne validé
- [ ] UX : Wireframes validés
- [ ] Dev : Faisabilité confirmée
- [ ] Tests : Plan de test défini

---

## 📅 Estimation Totale

| Story | Points |
|-------|--------|
| 8-1: Server Role Selection UI | 5 |
| 8-2: Internal Network Configuration | 8 |
| 8-3: Multi-Server Installation Orchestration | 13 |
| 8-4: Cross-Server Configuration Templates | 5 |
| 8-5: Distributed Health Monitoring | 3 |
| **Total** | **34** |

**Estimation durée** : 2-3 semaines (1 développeur)
