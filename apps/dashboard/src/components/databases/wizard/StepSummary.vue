<!--
  @file apps/dashboard/src/components/databases/wizard/StepSummary.vue

  @description Étape 6 du wizard : Récapitulatif avant installation.

  Ce composant affiche un résumé de toute la configuration choisie
  par l'utilisateur avant de lancer l'installation. C'est la dernière
  étape de révision avant l'action irréversible.

  Il montre :
  - Le type de BDD choisi (avec icône colorée)
  - Le serveur cible
  - Le nom de la BDD (ou usage pour Redis)
  - Le nom d'utilisateur
  - Un rappel important sur les credentials

  L'utilisateur peut revenir en arrière pour modifier, ou confirmer
  pour lancer l'installation.

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : AlertTriangle (avertissement)

  @fonctions_principales
  - getColorClass() : Couleur selon le type de BDD
  - getIcon() : Abréviation du type (PG, My, Rd, Mg)
  - getName() : Nom complet du type
  - getRedisUsageLabel() : Label traduit pour l'usage Redis
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **DbType** - Types de bases de données supportés
 */
type DbType = 'postgresql' | 'mysql' | 'redis' | 'mongodb'

/**
 * **RedisUsage** - Types d'utilisation de Redis
 */
type RedisUsage = 'cache' | 'sessions' | 'queue' | 'general'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Type de BDD sélectionné */
  databaseType: DbType
  /** Nom de la base de données (non utilisé pour Redis) */
  databaseName: string
  /** Nom d'utilisateur (non utilisé pour Redis) */
  username: string
  /** Type d'utilisation de Redis (uniquement pour Redis) */
  redisUsage: RedisUsage
  /** Nom du serveur cible (affiché dans le résumé) */
  serverName: string
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FONCTIONS D'AFFICHAGE
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **getColorClass()** - Retourne les classes CSS de couleur selon le type
 *
 * Chaque type de BDD a sa couleur signature pour une identification visuelle
 * rapide dans l'interface.
 */
function getColorClass(): string {
  const colors: Record<string, string> = {
    postgresql: 'bg-blue-100 text-blue-600',
    mysql: 'bg-orange-100 text-orange-600',
    redis: 'bg-red-100 text-red-600',
    mongodb: 'bg-green-100 text-green-600',
  }
  return colors[props.databaseType] || 'bg-slate-100 text-slate-600'
}

/**
 * **getIcon()** - Retourne l'abréviation du type de BDD (2 lettres)
 *
 * Utilisé comme "icône textuelle" dans les badges et boutons.
 */
function getIcon(): string {
  const icons: Record<string, string> = {
    postgresql: 'PG',
    mysql: 'My',
    redis: 'Rd',
    mongodb: 'Mg',
  }
  return icons[props.databaseType] || 'DB'
}

/**
 * **getName()** - Retourne le nom complet du type de BDD
 *
 * Nom affiché dans l'interface pour l'utilisateur.
 */
function getName(): string {
  const names: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL / MariaDB',
    redis: 'Redis',
    mongodb: 'MongoDB',
  }
  return names[props.databaseType] || ''
}

/**
 * **getRedisUsageLabel()** - Retourne le label traduit pour l'usage Redis
 *
 * Affiche le type d'utilisation choisi pour Redis dans la langue
 * configurée de l'utilisateur.
 */
function getRedisUsageLabel(): string {
  const labels: Record<string, string> = {
    cache: t('database.wizard.config.usageCache'),
    sessions: t('database.wizard.config.usageSessions'),
    queue: t('database.wizard.config.usageQueue'),
    general: t('database.wizard.config.usageGeneral'),
  }
  return labels[props.redisUsage] || ''
}
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    CONTENEUR PRINCIPAL
    ═══════════════════════════════════════════════════════════════════════════
  -->
  <div class="space-y-6">
    <!--
      EN-TÊTE DE L'ÉTAPE
      Titre et description pour expliquer le but de cette étape
    -->
    <div>
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.summary.title') }}
      </h3>
      <p class="text-sm text-slate-600">{{ t('database.wizard.summary.description') }}</p>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      CARTE RÉCAPITULATIVE
      ═══════════════════════════════════════════════════════════════════════════
      Résume visuellement toutes les informations de configuration.
      L'utilisateur peut vérifier que tout est correct avant de lancer
      l'installation.
    -->
    <div class="p-4 bg-slate-50 rounded-xl space-y-4">
      <!--
        EN-TÊTE : TYPE DE BDD + SERVEUR
        Montre l'icône colorée du type avec le nom du serveur cible
      -->
      <div class="flex items-center gap-3">
        <!-- Icône colorée selon le type de BDD -->
        <div class="w-12 h-12 rounded-xl flex items-center justify-center" :class="getColorClass()">
          <span class="text-lg font-bold">{{ getIcon() }}</span>
        </div>
        <div>
          <!-- Nom complet du type de BDD -->
          <h4 class="font-semibold text-slate-900">{{ getName() }}</h4>
          <!-- Nom du serveur cible -->
          <p class="text-sm text-slate-500">{{ serverName }}</p>
        </div>
      </div>

      <!--
        DÉTAILS DE LA CONFIGURATION
        Grille 2 colonnes avec les informations clés
      -->
      <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        <!--
          NOM DE LA BDD (non affiché pour Redis)
          Redis n'a pas de concept de "database name" comme les BDD relationnelles
        -->
        <div v-if="databaseType !== 'redis'">
          <span class="text-xs text-slate-500 uppercase">{{ t('database.wizard.summary.database') }}</span>
          <!-- Affiche une valeur par défaut si non renseigné -->
          <p class="font-medium text-slate-900">{{ databaseName || 'app_db' }}</p>
        </div>

        <!--
          NOM D'UTILISATEUR (non affiché pour Redis)
          L'utilisateur qui aura accès à la BDD
        -->
        <div v-if="databaseType !== 'redis'">
          <span class="text-xs text-slate-500 uppercase">{{ t('database.wizard.summary.user') }}</span>
          <!-- Si non renseigné, on génère automatiquement dbname_user -->
          <p class="font-medium text-slate-900">{{ username || `${databaseName}_user` }}</p>
        </div>

        <!--
          USAGE REDIS (affiché uniquement pour Redis)
          Le type d'utilisation choisi
        -->
        <div v-if="databaseType === 'redis'">
          <span class="text-xs text-slate-500 uppercase">{{ t('database.wizard.summary.usage') }}</span>
          <p class="font-medium text-slate-900">{{ getRedisUsageLabel() }}</p>
        </div>
      </div>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      RAPPEL IMPORTANT SUR LES CREDENTIALS
      ═══════════════════════════════════════════════════════════════════════════
      Avertissement pour prévenir l'utilisateur que le mot de passe
      ne sera affiché QU'UNE SEULE FOIS après l'installation.

      Le fond ambre attire l'attention sur cette information critique.
    -->
    <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div class="flex items-start gap-3">
        <!-- Icône d'avertissement -->
        <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 class="font-medium text-amber-900">{{ t('database.wizard.summary.credentialsReminder') }}</h4>
          <p class="text-sm text-amber-700 mt-1">{{ t('database.wizard.summary.credentialsReminderDesc') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
