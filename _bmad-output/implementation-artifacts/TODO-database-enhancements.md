# TODO: Améliorations futures du système de base de données

**Date de création** : 2025-01-28
**Statut** : À planifier

---

## 1. Synchronisation des backups vers le cloud

### Description
Ajouter la possibilité de synchroniser automatiquement les backups vers un stockage cloud (S3, Google Cloud Storage, BackBlaze B2, etc.) via rclone.

### Tâches
- [ ] Ajouter une option dans le wizard pour activer la sync cloud
- [ ] Permettre de configurer les credentials rclone depuis le dashboard
- [ ] Modifier les scripts de backup pour appeler `rclone sync` après le backup local
- [ ] Ajouter des notifications (webhook/email) en cas d'échec

### Fichiers concernés
- `apps/dashboard/src/components/databases/DatabaseServerWizard.vue`
- `apps/agent/src/infrastructure/index.ts` (méthode `generateBackupScript`)

---

## 2. Restauration de backup depuis le dashboard

### Description
Permettre de lister les backups disponibles et de restaurer un backup directement depuis l'interface dashboard.

### Tâches
- [ ] Ajouter un message `LIST_DATABASE_BACKUPS` dans l'agent
- [ ] Ajouter un message `RESTORE_DATABASE_BACKUP` dans l'agent
- [ ] Créer une interface dans le dashboard pour voir/restaurer les backups
- [ ] Ajouter des confirmations et warnings pour la restauration

### Fichiers concernés
- `apps/agent/src/index.ts` (nouveaux handlers)
- `apps/agent/src/infrastructure/index.ts` (méthodes restore)
- `apps/dashboard/src/views/ServerSettingsView.vue`

---

## 3. MongoDB Support complet

### Description
Implémenter le support complet pour MongoDB (actuellement marqué "not implemented").

### Tâches
- [ ] Créer `configureMongodb()` dans `databases.ts`
- [ ] Ajouter les options de performance MongoDB (wiredTigerCacheSizeGB)
- [ ] Ajouter le script de backup mongodump
- [ ] Tester sur un serveur réel

### Fichiers concernés
- `apps/agent/src/infrastructure/installers/databases.ts`
- `apps/agent/src/infrastructure/index.ts`

---

## 4. Réplication (Coming Soon dans le wizard)

### Description
Implémenter la configuration de réplication pour chaque base de données.

### PostgreSQL
- Streaming replication (primary/standby)
- Configuration de `pg_hba.conf` pour permettre la réplication
- Scripts de promotion failover

### MySQL/MariaDB
- Master/Slave replication
- GTID based replication
- Configuration de `my.cnf` pour binary logs

### Redis
- Redis Sentinel pour haute disponibilité
- Redis Cluster pour sharding

### MongoDB
- Replica Set configuration
- Arbiter nodes

### Tâches
- [ ] Débloquer la section réplication dans le wizard
- [ ] Implémenter `setupDatabaseReplication()` dans InfrastructureManager
- [ ] Créer les templates de configuration pour chaque scénario

---

## 5. Monitoring et alertes

### Description
Intégrer des métriques de monitoring pour les bases de données.

### Tâches
- [ ] Ajouter des métriques Prometheus/Netdata pour chaque DB
- [ ] Créer des alertes pour : espace disque, connexions, latence
- [ ] Afficher les métriques dans le dashboard

---

## 6. TLS/SSL pour les connexions

### Description
Implémenter le support TLS pour les connexions aux bases de données (actuellement `enableTls` est dans le wizard mais pas implémenté).

### Tâches
- [ ] Générer des certificats auto-signés ou utiliser Let's Encrypt
- [ ] Configurer PostgreSQL pour TLS (`ssl = on`)
- [ ] Configurer MySQL pour TLS (`require_secure_transport`)
- [ ] Configurer Redis pour TLS (`tls-port`, `tls-cert-file`)
- [ ] Mettre à jour les connection strings avec les options SSL

---

## Priorités suggérées

1. **Haute** : MongoDB Support (demandé fréquemment)
2. **Haute** : Restauration de backup (fonctionnalité critique)
3. **Moyenne** : TLS/SSL (sécurité)
4. **Moyenne** : Sync cloud des backups
5. **Basse** : Réplication (complexe, cas avancé)
6. **Basse** : Monitoring (peut utiliser Netdata existant)
