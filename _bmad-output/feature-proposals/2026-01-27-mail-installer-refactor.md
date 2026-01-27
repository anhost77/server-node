# Feature Proposal: Refactoring Mail Installer + AI Troubleshooter

**Date** : 2026-01-27
**Proposé par** : User + Claude
**Status** : draft

## Résumé

Refactorer l'installation du mail stack pour séparer l'installation des packages de leur configuration, et ajouter un agent IA pour aider au troubleshooting automatique.

## Objectifs

1. Rendre l'installation mail plus robuste en séparant les étapes
2. Éviter les problèmes de configuration post-install (hostname invalide, etc.)
3. Permettre un troubleshooting automatique en cas d'erreur

## Problème Actuel

Le script post-install de Postfix utilise `hostname` pour dériver `myhostname` et `mydomain`, même avec debconf pré-configuré. Sur des serveurs avec des hostnames invalides (ex: `CT103.1.1.1.1`), cela cause des erreurs fatales.

## Solution Proposée

### Phase 1: Séparation Installation/Configuration

```
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: Installation des packages                          │
│ - DEBIAN_FRONTEND=noninteractive                            │
│ - apt-get install --no-install-recommends                   │
│ - Pas de configuration automatique                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: Génération des configurations                      │
│ - Créer /etc/mailname avec le bon hostname                  │
│ - Générer /etc/postfix/main.cf avec domaine configuré       │
│ - Générer configs Dovecot, OpenDKIM, etc.                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: Post-configuration                                 │
│ - newaliases                                                │
│ - postmap pour les tables hash                              │
│ - Génération clés DKIM                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: Démarrage des services                             │
│ - systemctl enable/start postfix dovecot etc.               │
│ - Vérification que les services tournent                    │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: AI Troubleshooter (Optionnel)

En cas d'erreur à n'importe quelle étape:

```
┌─────────────────────────────────────────────────────────────┐
│ Erreur Détectée                                             │
│ ↓                                                           │
│ Collecter le contexte:                                      │
│ - Message d'erreur                                          │
│ - Logs systemd/journalctl                                   │
│ - Configuration actuelle                                    │
│ ↓                                                           │
│ Sanitizer les données (OBLIGATOIRE):                        │
│ - Masquer tokens, passwords, IPs internes                   │
│ - Masquer domaines si demandé                               │
│ ↓                                                           │
│ Envoyer à l'API IA:                                         │
│ - Prompt: "Comment corriger cette erreur Postfix?"          │
│ - Contexte sanitizé                                         │
│ ↓                                                           │
│ Recevoir suggestions:                                       │
│ - Commandes de correction                                   │
│ - Modifications de config                                   │
│ ↓                                                           │
│ Appliquer automatiquement OU demander validation user       │
└─────────────────────────────────────────────────────────────┘
```

## Analyse Sécurité

### Risques de l'AI Troubleshooter

| Risque | Niveau | Mitigation |
|--------|--------|------------|
| Fuite de données sensibles | ÉLEVÉ | Sanitization obligatoire avant envoi |
| Exécution de commandes malveillantes | MOYEN | Validation whitelist des commandes suggérées |
| Dépendance externe | FAIBLE | Fallback sur logs d'erreur standard |
| Coût API | FAIBLE | Rate limiting, cache des réponses similaires |

### Conformité GDPR

- Les logs envoyés à l'IA DOIVENT être sanitizés
- Aucune donnée personnelle ne doit être envoyée
- L'utilisateur doit consentir à l'utilisation de l'IA (opt-in)

### Whitelist de commandes

L'IA ne peut suggérer que des commandes pré-approuvées:

```typescript
const ALLOWED_TROUBLESHOOT_COMMANDS = [
  'postconf -e *',
  'systemctl restart *',
  'systemctl status *',
  'newaliases',
  'postmap *',
  'doveconf -n',
  'postfix check',
  // ... liste exhaustive
];
```

## Estimation

| Tâche | Complexité | Points |
|-------|------------|--------|
| Phase 1: Refactor installer | Medium | 5 |
| Phase 2: AI Troubleshooter | High | 8 |
| Tests et validation | Medium | 3 |
| **Total** | | **16** |

## Questions pour le PM

1. **Phase 2 est-elle prioritaire ?** Ou peut-on livrer Phase 1 d'abord et Phase 2 plus tard ?
2. **Quel provider IA ?** OpenAI, Anthropic, ou modèle local ?
3. **Opt-in ou Opt-out ?** L'utilisateur doit-il activer explicitement l'AI troubleshooter ?
4. **Budget API ?** Estimation des coûts mensuels pour les appels IA

## Questions pour le Security Agent

1. La whitelist de commandes est-elle suffisante ?
2. Faut-il un audit des données envoyées à l'IA ?
3. Le consentement utilisateur est-il suffisant pour GDPR ?

## Décision Recommandée

**Livrer Phase 1 immédiatement** (refactor installation) car c'est critique pour le fonctionnement du Mail Wizard.

**Phase 2 en backlog** pour évaluation ultérieure après discussion sur sécurité et budget.
