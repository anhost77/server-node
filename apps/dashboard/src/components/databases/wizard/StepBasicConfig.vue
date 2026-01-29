<!--
  @file apps/dashboard/src/components/databases/wizard/StepBasicConfig.vue

  @description Étape 3 du wizard : Configuration de base.

  Ce composant permet de configurer les paramètres de base de la BDD :
  - Pour PostgreSQL, MySQL, MongoDB :
    - Nom de la base de données (ex: "app_db")
    - Nom d'utilisateur (ex: "app_user")
  - Pour Redis :
    - Type d'utilisation (cache, sessions, queue, général)

  IMPORTANT : Le mot de passe n'est PAS demandé ici. Il sera généré
  automatiquement pour des raisons de sécurité et affiché une seule
  fois après l'installation.

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : Lock (cadenas pour info sécurité)

  @fonctions_principales
  - Émission des valeurs via v-model pour chaque champ
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Lock } from 'lucide-vue-next'

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
 *
 * Redis peut être utilisé pour différents cas :
 * - cache : Stocker temporairement des données pour accélérer les lectures
 * - sessions : Stocker les sessions utilisateurs
 * - queue : Gérer des files d'attente de tâches (jobs)
 * - general : Utilisation polyvalente
 */
type RedisUsage = 'cache' | 'sessions' | 'queue' | 'general'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Type de BDD sélectionné à l'étape 1 */
  databaseType: DbType

  /** Nom de la base de données (pour PostgreSQL, MySQL, MongoDB) */
  databaseName: string

  /** Nom d'utilisateur (pour PostgreSQL, MySQL, MongoDB) */
  username: string

  /** Type d'utilisation de Redis (pour Redis uniquement) */
  redisUsage: RedisUsage
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Mise à jour du nom de la BDD (v-model) */
  'update:databaseName': [value: string]
  /** Mise à jour du nom d'utilisateur (v-model) */
  'update:username': [value: string]
  /** Mise à jour du type d'utilisation Redis (v-model) */
  'update:redisUsage': [value: RedisUsage]
}>()

const { t } = useI18n()
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
      Titre et description pour guider l'utilisateur
    -->
    <div>
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.config.title') }}
      </h3>
      <p class="text-sm text-slate-600">{{ t('database.wizard.config.description') }}</p>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      FORMULAIRE POUR POSTGRESQL, MYSQL, MONGODB
      ═══════════════════════════════════════════════════════════════════════════
      Ces bases de données relationnelles ont besoin d'un nom de BDD et d'un
      utilisateur. Redis n'a pas ce concept, il utilise une configuration
      différente.
    -->
    <div v-if="databaseType !== 'redis'" class="space-y-4">
      <!--
        NOM DE LA BASE DE DONNÉES
        C'est le nom qui sera utilisé pour créer la BDD.
        Ex: CREATE DATABASE app_db;
      -->
      <label class="block">
        <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.config.dbName') }} *</span>
        <input
          :value="databaseName"
          @input="emit('update:databaseName', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="app_db"
          class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <!-- Aide contextuelle pour le format attendu -->
        <p class="mt-1 text-xs text-slate-500">{{ t('database.wizard.config.dbNameHint') }}</p>
      </label>

      <!--
        NOM D'UTILISATEUR
        C'est l'utilisateur qui aura accès à cette BDD.
        Par convention, on suggère dbname_user (ex: app_db_user)
      -->
      <label class="block">
        <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.config.username') }} *</span>
        <input
          :value="username"
          @input="emit('update:username', ($event.target as HTMLInputElement).value)"
          type="text"
          :placeholder="databaseName ? `${databaseName}_user` : 'app_user'"
          class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p class="mt-1 text-xs text-slate-500">{{ t('database.wizard.config.usernameHint') }}</p>
      </label>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      FORMULAIRE POUR REDIS
      ═══════════════════════════════════════════════════════════════════════════
      Redis ne fonctionne pas avec des "bases de données" au sens traditionnel.
      On demande plutôt l'usage prévu pour optimiser la configuration.
    -->
    <div v-if="databaseType === 'redis'" class="space-y-4">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.config.usage') }}</span>
        <select
          :value="redisUsage"
          @change="emit('update:redisUsage', ($event.target as HTMLSelectElement).value as RedisUsage)"
          class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <!--
            Options d'utilisation de Redis :
            - Cache : Données temporaires (ex: résultats de requêtes)
            - Sessions : Sessions utilisateur (ex: panier e-commerce)
            - Queue : File de tâches en attente (ex: envoi d'emails)
            - Général : Configuration polyvalente
          -->
          <option value="cache">{{ t('database.wizard.config.usageCache') }}</option>
          <option value="sessions">{{ t('database.wizard.config.usageSessions') }}</option>
          <option value="queue">{{ t('database.wizard.config.usageQueue') }}</option>
          <option value="general">{{ t('database.wizard.config.usageGeneral') }}</option>
        </select>
      </label>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      INFO SÉCURITÉ : MOT DE PASSE AUTOMATIQUE
      ═══════════════════════════════════════════════════════════════════════════
      On informe l'utilisateur que le mot de passe sera généré automatiquement.
      C'est une bonne pratique de sécurité car :
      - Les mots de passe générés sont plus forts
      - L'utilisateur ne réutilise pas un mot de passe existant
      - On évite les mots de passe faibles comme "password123"
    -->
    <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
      <div class="flex items-start gap-3">
        <!-- Icône cadenas pour représenter la sécurité -->
        <Lock class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 class="font-medium text-emerald-900">{{ t('database.wizard.config.passwordAuto') }}</h4>
          <p class="text-sm text-emerald-700 mt-1">{{ t('database.wizard.config.passwordAutoDesc') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
