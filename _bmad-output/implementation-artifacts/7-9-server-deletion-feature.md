# Story 7.9 - Server Deletion Feature

## Contexte

Actuellement, seuls les serveurs "managed" (provisionés via Hetzner/DigitalOcean/Vultr) peuvent être supprimés. Les serveurs connectés manuellement via l'agent n'ont **aucun mécanisme de suppression**.

## Problèmes identifiés

1. **Pas d'endpoint API** pour supprimer un serveur connecté
2. **Pas de mécanisme côté agent** pour s'arrêter proprement
3. **Pas de bouton UI** dans le Dashboard pour les serveurs connectés
4. **Pas de nettoyage en cascade** des apps et domaines associés
5. **Agent continue de communiquer** inutilement après suppression manuelle de la DB

## Design proposé

### 1. Nouveau message WebSocket: `SHUTDOWN_AGENT`

```typescript
// packages/shared/src/index.ts
z.object({
  type: z.literal('SHUTDOWN_AGENT'),
  serverId: z.string(),
  action: z.enum(['stop', 'uninstall']) // stop = arrête le service, uninstall = supprime tout
})
```

### 2. Comportement côté Agent

Quand l'agent reçoit `SHUTDOWN_AGENT`:

**Action `stop`:**
1. Envoie confirmation `AGENT_SHUTDOWN_ACK`
2. Ferme la connexion WebSocket
3. Arrête le service systemd (`systemctl stop server-flow-agent`)
4. Désactive le service (`systemctl disable server-flow-agent`)

**Action `uninstall`:**
1. Tout ce qui précède, plus:
2. Supprime le fichier service systemd
3. Supprime le dossier `~/.server-flow/`
4. Supprime les apps pm2 gérées

### 3. Endpoint API: `DELETE /api/nodes/:id`

```typescript
app.delete('/api/nodes/:id', async (req, reply) => {
  // 1. Vérifier que l'utilisateur est propriétaire du node
  // 2. Récupérer les apps et domaines associés
  // 3. Envoyer SHUTDOWN_AGENT si l'agent est connecté
  // 4. Supprimer en cascade: apps, domaines, proxy configs
  // 5. Supprimer le node de la base
  // 6. Logger l'activité
});
```

### 4. Flux de suppression

```
┌─────────────┐     DELETE /api/nodes/:id     ┌────────────────┐
│  Dashboard  │ ─────────────────────────────►│  Control Plane │
└─────────────┘                               └────────────────┘
                                                      │
                                                      │ Si agent online:
                                                      │ SHUTDOWN_AGENT
                                                      ▼
                                               ┌────────────────┐
                                               │     Agent      │
                                               │ (sur le serveur)│
                                               └────────────────┘
                                                      │
                                                      │ Stop service
                                                      │ (optionnel: uninstall)
                                                      ▼
                                               ┌────────────────┐
                                               │   Service      │
                                               │   arrêté       │
                                               └────────────────┘
```

### 5. UI Dashboard

Ajouter un bouton "Supprimer" sur chaque carte serveur avec:
- Dialogue de confirmation avec 2 options:
  - "Déconnecter" (stop) - Le serveur reste intact, l'agent s'arrête
  - "Supprimer complètement" (uninstall) - Supprime tout
- Avertissement si le serveur est offline (pas de garantie que l'agent s'arrêtera)
- Liste des apps/domaines qui seront supprimés

### 6. Gestion des cas limites

| Cas | Comportement |
|-----|--------------|
| Agent online | Envoie SHUTDOWN_AGENT, attend ACK, puis supprime de la DB |
| Agent offline | Avertit l'utilisateur, supprime de la DB (agent orphelin) |
| Apps en cours | Avertit l'utilisateur, force l'arrêt des apps |
| Domaines associés | Supprime les configs nginx, libère les domaines |

## Questions ouvertes

1. **Timeout pour ACK**: Combien de temps attendre la confirmation de l'agent?
   - Proposition: 10 secondes, puis suppression de la DB sans confirmation

2. **Cleanup des logs**: Faut-il supprimer les logs d'activité du serveur?
   - Proposition: Garder les logs pour audit, marquer comme "serveur supprimé"

3. **Reconnexion agent orphelin**: Que faire si un agent supprimé de la DB essaie de se reconnecter?
   - Proposition: Rejeter la connexion avec message explicite

## Estimation

| Tâche | Durée estimée |
|-------|---------------|
| Types shared (message) | 15 min |
| Handler agent shutdown | 30 min |
| Endpoint API DELETE | 45 min |
| UI Dashboard (bouton + modal) | 1h |
| Tests et validation | 30 min |
| **Total** | **~3h** |

## Critères d'acceptation

- [ ] Bouton "Supprimer" visible sur chaque carte serveur
- [ ] Modal de confirmation avec choix stop/uninstall
- [ ] Agent s'arrête proprement quand SHUTDOWN_AGENT reçu
- [ ] Apps et domaines supprimés en cascade
- [ ] Logs d'activité enregistrés
- [ ] Gestion du cas "agent offline"
