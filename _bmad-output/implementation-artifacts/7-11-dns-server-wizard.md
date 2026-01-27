# Story 7-11: DNS Server Wizard

**Epic** : Epic 7 - Multi-Runtime & DevOps Automation
**Status** : done
**Assigné à** : Claude Code
**Points** : 8

---

## Description

### Contexte

Suite au succès du Mail Server Wizard (7-10), nous avons besoin d'un wizard similaire pour la configuration DNS avec BIND9. Ce wizard guide l'utilisateur à travers la configuration complète d'un serveur DNS.

### Objectif

Créer un assistant de configuration DNS avec :
- Choix d'architecture (Primaire, Primaire+Secondaire, Cache, Split-Horizon)
- Configuration des zones DNS
- Options de sécurité (DNSSEC, TSIG, RRL)
- Preview des records générés
- Installation automatisée

---

## Critères d'Acceptation

- [x] Wizard modal avec 6 étapes (Architecture, Config, Zones, Sécurité, Records, Installation)
- [x] 4 architectures DNS proposées (Primaire recommandé, Primaire+Secondaire, Cache, Split-Horizon)
- [x] Configuration des zones avec ajout/suppression dynamique
- [x] Options de sécurité : DNSSEC, TSIG (pour multi-serveur), RRL, Logging
- [x] Preview des records DNS générés (SOA, NS, A)
- [x] Interface cohérente avec le Mail Wizard (même UX/UI)
- [x] Section DNS mise à jour avec wizard CTA, barre de statut, config manuelle
- [x] Traductions FR et EN complètes

---

## Spécifications Techniques

### Architecture Choisie

Pattern identique au MailServerWizard :
- Composant modal Vue 3 avec étapes progressives
- Barre de progression visuelle
- Validation par étape
- Console de logs en temps réel pendant l'installation

### Fichiers Créés

| Fichier | Description |
|---------|-------------|
| `apps/dashboard/src/components/dns/DnsServerWizard.vue` | Composant wizard principal (~900 lignes) |
| `apps/agent/src/infrastructure/templates/bind9/named.conf.local.conf` | Template zones DNS |
| `apps/agent/src/infrastructure/templates/bind9/zone.db.conf` | Template fichier de zone |
| `apps/agent/src/infrastructure/templates/bind9/named.conf.options-secure.conf` | Template options sécurité |

### Fichiers Modifiés

| Fichier | Modifications |
|---------|---------------|
| `apps/dashboard/src/views/ServerSettingsView.vue` | Section DNS avec wizard CTA, barre de statut, config manuelle |
| `apps/dashboard/src/App.vue` | Ajout configureDnsStack() et handler DNS_STACK_CONFIGURED |
| `apps/dashboard/src/i18n/locales/fr.ts` | Traductions françaises pour dns.wizard.* |
| `apps/dashboard/src/i18n/locales/en.ts` | Traductions anglaises pour dns.wizard.* |
| `apps/agent/src/infrastructure/index.ts` | Ajout configureDnsStack() et fonctions associées |
| `apps/agent/src/index.ts` | Handler CONFIGURE_DNS_STACK |
| `apps/control-plane/src/index.ts` | Ajout CONFIGURE_DNS_STACK à la liste des commandes relayées |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 7-11 ajoutée |

---

## Détails d'Implémentation

### Étapes du Wizard

1. **Architecture** : Choix entre 4 types de serveurs DNS
   - Primaire (Recommandé) : Serveur authoritative simple
   - Primaire + Secondaire : Haute disponibilité (nécessite 2 serveurs)
   - Cache/Récursif : Cache DNS local pour réseau interne
   - Split-Horizon : Vues multiples (Coming Soon)

2. **Configuration** : Paramètres du serveur
   - Sélection du serveur
   - Hostname DNS (ex: ns1.example.com)
   - Forwarders (mode cache uniquement)
   - Réseau local autorisé (mode cache uniquement)

3. **Zones** : Configuration des zones DNS
   - Liste des zones avec ajout/suppression
   - Type de zone (Master, Forward)
   - Option de zone inverse automatique
   - Mode cache : aucune zone nécessaire

4. **Sécurité** : Options de protection
   - DNSSEC : Signature cryptographique (algorithme configurable)
   - TSIG : Authentification transferts (auto si multi-serveur)
   - RRL : Rate Limiting contre DDoS
   - Logging : Journalisation des requêtes

5. **Records** : Preview des enregistrements
   - SOA, NS, A générés automatiquement
   - Bouton copier tout
   - Rappel de mise à jour chez le registrar

6. **Installation** : Lancement et suivi
   - Résumé de configuration
   - Liste des services à installer
   - Console de logs en temps réel
   - Indicateurs de progression

### Structure du Composant

```typescript
// Configuration principale
const config = ref({
  architecture: 'primary' | 'primary-secondary' | 'cache' | 'split-horizon',
  serverId: string,
  secondaryServerId: string,
  hostname: string,
  forwarders: string[],
  localNetwork: string,
  zones: Array<{ name: string, type: 'master' | 'forward', ttl: number }>,
  createReverseZone: boolean,
  security: {
    dnssec: { enabled: boolean, algorithm: string, autoRotate: boolean },
    tsig: { enabled: boolean },
    rrl: { enabled: boolean, responsesPerSecond: number, window: number },
    logging: boolean
  }
});
```

### Section DNS Mise à Jour

La section DNS dans ServerSettingsView.vue suit maintenant le même pattern que Mail :

1. **Wizard CTA Card** (collapsible)
   - État expanded : description + bouton "Lancer l'assistant"
   - État collapsed : icône + titre cliquable

2. **Barre de statut** (si services installés)
   - Badges avec indicateur de statut (running/stopped)
   - Boutons start/stop/logs inline
   - Lien "Reconfigurer"

3. **Configuration manuelle** (accordéon)
   - Toggle pour afficher/masquer
   - Grille de cartes de services (BIND9)

---

## Considérations Sécurité

- DNSSEC utilise ECDSAP256SHA256 par défaut (Ed25519 équivalent)
- TSIG obligatoire pour architecture multi-serveur
- RRL activé par défaut (protection DDoS)
- Logging désactivé par défaut (privacy)

---

## Tests

### Tests Manuels Effectués

- [x] Wizard s'ouvre correctement depuis le CTA
- [x] Navigation entre étapes fonctionne
- [x] Validation empêche la progression si champs manquants
- [x] Preview des records s'affiche correctement
- [x] Traductions FR/EN fonctionnent
- [x] Section DNS avec barre de statut et config manuelle

---

## Notes de Développement

### Intégration Backend

L'intégration backend est complète :

1. ✅ Commande `CONFIGURE_DNS_STACK` ajoutée dans l'agent (`apps/agent/src/index.ts`)
2. ✅ Fonction `configureDnsStack()` dans InfrastructureManager avec 4 étapes :
   - Installation de BIND9
   - Configuration des zones DNS
   - Application des paramètres de sécurité (DNSSEC, TSIG, RRL, Logging)
   - Sauvegarde et redémarrage
3. ✅ Templates BIND9 créés :
   - `named.conf.local.conf` - Configuration des zones
   - `zone.db.conf` - Fichier de zone (SOA, NS, A records)
   - `named.conf.options-secure.conf` - Options avec sécurité
4. ✅ Handler control-plane pour relayer la commande vers l'agent
5. ✅ Fonction `configureDnsStack()` dans App.vue pour le WebSocket
6. ⏳ DNSSEC avec génération de clés (future story)

### Points d'Attention

- Split-Horizon désactivé (Coming Soon) - complexité élevée
- Architecture multi-serveur nécessite 2+ serveurs connectés
- Mode cache ne crée pas de zones, juste des forwarders

---

## Validation Finale

- [x] Code review (auto-review par Claude)
- [x] Traductions complètes
- [x] `sprint-status.yaml` mis à jour
- [x] Documentation créée

**Date de complétion** : 2026-01-27
