<!--
  @file apps/dashboard/src/components/databases/DatabaseCard.vue

  @description Carte visuelle représentant une base de données sur le dashboard.

  Ce composant affiche une "carte" pour chaque type de base de données (PostgreSQL,
  MySQL, Redis). La carte montre le nom de la BDD, son statut (en cours d'exécution
  ou arrêtée), sa version, et propose des boutons d'action.

  C'est comme une fiche d'identité pour chaque base de données :
  - Si elle n'est pas installée → bouton "Configurer"
  - Si elle est installée → boutons pour reconfigurer, voir les logs, ou supprimer

  @dependencies
  - Vue 3 : Framework frontend pour l'interface

  @fonctions_principales
  - Affichage du statut (running/stopped/not configured)
  - Actions : configure, reconfigure, view logs, remove
  - Indicateur visuel (point vert quand la BDD tourne)
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Database, DatabaseType } from '@/types'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DÉFINITION DES PROPS (données reçues du composant parent)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les "props" sont comme des paramètres qu'on passe à ce composant.
 * Quand on utilise <DatabaseCard :database="maDb" />, on lui envoie ces données.
 */
interface Props {
  /** La base de données à afficher (type, version, statut...) */
  database: Database
  /** ID de la BDD en cours de configuration (pour désactiver les boutons) */
  configuringDatabase?: string | null
  /** ID de la BDD en cours de suppression */
  removingDatabase?: string | null
  /** ID de la BDD en cours de reconfiguration */
  reconfiguringDatabase?: string | null
}

const props = defineProps<Props>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DÉFINITION DES ÉVÉNEMENTS ÉMIS (signaux envoyés au composant parent)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Quand l'utilisateur clique sur un bouton, ce composant "émet" un signal
 * au composant parent pour lui dire "l'utilisateur veut faire telle action".
 * C'est comme lever la main pour demander quelque chose.
 */
const emit = defineEmits<{
  /** Signal émis quand l'utilisateur veut configurer une nouvelle BDD */
  configure: [type: DatabaseType]
  /** Signal émis quand l'utilisateur veut reconfigurer une BDD existante */
  reconfigure: [type: DatabaseType]
  /** Signal émis quand l'utilisateur veut supprimer une BDD */
  remove: [type: DatabaseType]
  /** Signal émis quand l'utilisateur veut voir les logs d'installation */
  viewLogs: [type: DatabaseType]
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DONNÉES STATIQUES : Icônes et noms des bases de données
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chaque type de base de données a son propre emoji et nom d'affichage.
 * C'est comme un dictionnaire : on cherche "postgresql" et on trouve "🐘".
 */

/** Emojis représentant chaque type de base de données */
const databaseIcons: Record<DatabaseType, string> = {
  postgresql: '🐘',  // L'éléphant est le logo de PostgreSQL
  mysql: '🐬',       // Le dauphin est le logo de MySQL
  redis: '🔴'        // Redis utilise souvent un cercle rouge
}

/** Noms complets pour l'affichage */
const databaseNames: Record<DatabaseType, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL/MariaDB',
  redis: 'Redis'
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPRIÉTÉS CALCULÉES (valeurs qui se mettent à jour automatiquement)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces valeurs sont recalculées automatiquement quand les données changent.
 * Par exemple, si la BDD passe de "stopped" à "running", le texte du statut
 * se met à jour tout seul.
 */

/**
 * **icon** - Récupère l'emoji correspondant au type de BDD
 *
 * Exemple : Si la BDD est PostgreSQL, retourne "🐘"
 */
const icon = computed(() => databaseIcons[props.database.type] || '🗄️')

/**
 * **name** - Récupère le nom complet de la BDD pour l'affichage
 *
 * Exemple : Si la BDD est "mysql", retourne "MySQL/MariaDB"
 */
const name = computed(() => databaseNames[props.database.type] || props.database.type)

/**
 * **isConfiguring** - Vérifie si CETTE base de données est en cours de configuration
 *
 * Permet de savoir si on doit afficher "Setting up..." sur le bouton
 */
const isConfiguring = computed(() => props.configuringDatabase === props.database.type)

/**
 * **isRemoving** - Vérifie si CETTE base de données est en cours de suppression
 *
 * Permet d'afficher "..." pendant la suppression
 */
const isRemoving = computed(() => props.removingDatabase === props.database.type)

/**
 * **isReconfiguring** - Vérifie si CETTE base de données est en cours de reconfiguration
 */
const isReconfiguring = computed(() => props.reconfiguringDatabase === props.database.type)

/**
 * **isBusy** - Vérifie si UNE opération est en cours (n'importe laquelle)
 *
 * Quand une opération est en cours, on désactive tous les boutons pour
 * éviter que l'utilisateur lance plusieurs actions en même temps.
 * C'est comme un feu rouge : on attend que l'action se termine.
 */
const isBusy = computed(() =>
  props.configuringDatabase !== null ||
  props.removingDatabase !== null ||
  props.reconfiguringDatabase !== null
)

/**
 * **statusText** - Texte décrivant l'état actuel de la base de données
 *
 * Trois états possibles :
 * - "Not configured" : La BDD n'est pas installée sur le serveur
 * - "Running" : La BDD est installée et fonctionne
 * - "Stopped" : La BDD est installée mais arrêtée
 */
const statusText = computed(() => {
  if (!props.database.installed) return 'Not configured'
  if (props.database.running) return 'Running'
  return 'Stopped'
})

/**
 * **statusClass** - Classe CSS pour colorer le statut
 *
 * - Vert ("running") quand la BDD tourne
 * - Rouge ("stopped") quand elle est arrêtée
 * - Gris ("not-configured") quand pas installée
 */
const statusClass = computed(() => {
  if (!props.database.installed) return 'not-configured'
  if (props.database.running) return 'running'
  return 'stopped'
})
</script>

<template>
  <!--
    CARTE PRINCIPALE
    La classe "configured" est ajoutée quand la BDD est installée,
    ce qui change légèrement l'apparence (bordure verte)
  -->
  <div
    class="database-card"
    :class="{ configured: database.installed }"
  >
    <!-- ICÔNE : Emoji représentant le type de BDD -->
    <div class="database-icon">{{ icon }}</div>

    <!-- INFORMATIONS : Nom, version, statut -->
    <div class="database-info">
      <span class="database-name">{{ name }}</span>

      <!-- Version (affichée seulement si la BDD est installée et qu'on connaît la version) -->
      <span v-if="database.installed && database.version" class="database-version">
        {{ database.version }}
      </span>

      <!-- Statut avec couleur appropriée -->
      <span :class="['database-status', statusClass]">
        {{ statusText }}
      </span>
    </div>

    <!-- BOUTONS D'ACTION -->
    <div class="database-actions">
      <!--
        BOUTON CONFIGURER (affiché si la BDD n'est pas installée)
        Permet de lancer l'installation de la base de données
      -->
      <button
        v-if="!database.installed"
        class="configure-btn"
        :disabled="isBusy"
        @click="emit('configure', database.type)"
      >
        {{ isConfiguring ? 'Setting up...' : '⚙️ Setup' }}
      </button>

      <!--
        ACTIONS POUR UNE BDD INSTALLÉE
        Ces boutons n'apparaissent que si la BDD est déjà configurée
      -->
      <template v-else>
        <!-- Point vert clignotant quand la BDD tourne -->
        <span v-if="database.running" class="status-dot running" />

        <!-- Bouton reconfigurer (roue qui tourne) -->
        <button
          class="action-btn"
          :disabled="isBusy"
          title="Reconfigure database"
          @click="emit('reconfigure', database.type)"
        >
          {{ isReconfiguring ? '...' : '🔄' }}
        </button>

        <!-- Bouton voir les logs (presse-papiers) -->
        <button
          class="action-btn"
          title="View installation logs"
          @click="emit('viewLogs', database.type)"
        >
          📋
        </button>

        <!-- Bouton supprimer (corbeille) - en rouge au survol -->
        <button
          class="action-btn danger"
          :disabled="isBusy"
          title="Remove database"
          @click="emit('remove', database.type)"
        >
          {{ isRemoving ? '...' : '🗑️' }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STYLES DE LA CARTE
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* Conteneur principal de la carte */
.database-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--surface-color);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  transition: all 0.2s;
}

/* Apparence quand la BDD est installée (bordure verte subtile) */
.database-card.configured {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.03);
}

/* Zone de l'icône (emoji) */
.database-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border-radius: 10px;
  flex-shrink: 0;
}

/* Zone des informations (nom, version, statut) */
.database-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Nom de la base de données */
.database-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-main);
}

/* Version (ex: "15.2") */
.database-version {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

/* Texte du statut */
.database-status {
  font-size: 0.75rem;
  font-weight: 500;
}

/* Couleur grise quand pas configurée */
.database-status.not-configured {
  color: var(--text-muted);
}

/* Couleur verte quand en cours d'exécution */
.database-status.running {
  color: var(--success-color);
}

/* Couleur rouge quand arrêtée */
.database-status.stopped {
  color: var(--error-color);
}

/* Zone des boutons d'action */
.database-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Bouton "Setup" (configuration initiale) */
.configure-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: var(--primary-color);
  color: #fff;
}

.configure-btn:hover:not(:disabled) {
  background: #2563eb;
}

.configure-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Point lumineux indiquant que la BDD tourne */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.running {
  background: var(--success-color);
  box-shadow: 0 0 8px var(--success-color);
}

/* Petits boutons d'action (reconfigurer, logs, supprimer) */
.action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--primary-color);
}

/* Bouton danger (supprimer) - devient rouge au survol */
.action-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error-color);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Adaptation pour les petits écrans (mobile) */
@media (max-width: 600px) {
  .database-card {
    flex-wrap: wrap;
    gap: 12px;
  }

  .database-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
