<!--
  @file apps/dashboard/src/components/databases/management/DatabaseList.vue

  @description Liste des bases de données installées sur un serveur.

  Ce composant affiche toutes les bases de données d'un serveur, organisées
  par TYPE (PostgreSQL, MySQL, Redis...). Pour chaque type, on voit :
  - La version installée
  - Si le service tourne ou non
  - La liste des bases de données individuelles (instances)

  Pour chaque instance, l'utilisateur peut :
  - Voir les infos de connexion (host, port, user...)
  - Réinitialiser le mot de passe
  - Supprimer la base de données

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : Icônes diverses

  @fonctions_principales
  - getColorClass() : Couleur selon le type de BDD
  - getIcon() : Abréviation du type (PG, My, Rd...)
  - getName() : Nom complet du type
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Server,
  Database,
  RefreshCw,
  Plus,
  HardDrive,
  Eye,
  Key,
  Trash2,
} from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **DatabaseInstance** - Une base de données individuelle
 *
 * Représente une BDD spécifique, par exemple "wordpress_db" ou "app_prod".
 */
interface DatabaseInstance {
  /** Nom de la base de données */
  name: string
  /** Utilisateur propriétaire */
  user?: string
  /** Date de création */
  createdAt?: string
}

/**
 * **DatabaseInfo** - Infos sur un type de BDD installé
 *
 * Regroupe toutes les instances d'un même type.
 * Ex: PostgreSQL avec 3 bases de données.
 */
interface DatabaseInfo {
  /** Type : postgresql, mysql, redis, mongodb */
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb'
  /** Version installée (ex: "15.2") */
  version?: string
  /** Le service tourne-t-il ? */
  running: boolean
  /** Liste des bases de données de ce type */
  instances: DatabaseInstance[]
}

/**
 * **ServerInfo** - Infos minimales du serveur sélectionné
 */
interface ServerInfo {
  id: string
  hostname: string
  ip: string
  alias?: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Serveur actuellement sélectionné */
  server: ServerInfo
  /** Liste des BDD récupérées depuis l'agent */
  databases: DatabaseInfo[]
  /** Rafraîchissement en cours ? */
  refreshing: boolean
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Rafraîchir la liste des BDD */
  refresh: []
  /** Ouvrir le modal de création */
  create: []
  /** Créer une BDD d'un type spécifique */
  createForType: [type: string]
  /** Voir les infos de connexion d'une instance */
  viewConnection: [dbType: string, instance: DatabaseInstance]
  /** Réinitialiser le mot de passe */
  resetPassword: [dbType: string, instance: DatabaseInstance]
  /** Supprimer une instance */
  delete: [dbType: string, instance: DatabaseInstance]
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
 * Chaque type de BDD a sa couleur signature :
 * - PostgreSQL = bleu (comme son logo éléphant)
 * - MySQL = orange (comme le dauphin MySQL)
 * - Redis = rouge (logo Redis)
 * - MongoDB = vert (logo MongoDB)
 *
 * @param type - Type de base de données
 * @returns Classes CSS pour le fond et le texte
 */
function getColorClass(type: string): string {
  const colors: Record<string, string> = {
    postgresql: 'bg-blue-100 text-blue-600',
    mysql: 'bg-orange-100 text-orange-600',
    redis: 'bg-red-100 text-red-600',
    mongodb: 'bg-green-100 text-green-600',
  }
  return colors[type] || 'bg-slate-100 text-slate-600'
}

/**
 * **getIcon()** - Retourne l'abréviation du type de BDD
 *
 * Utilisé pour afficher une petite icône textuelle dans un cercle.
 *
 * @param type - Type de base de données
 * @returns Abréviation en 2 lettres
 */
function getIcon(type: string): string {
  const icons: Record<string, string> = {
    postgresql: 'PG',
    mysql: 'My',
    redis: 'Rd',
    mongodb: 'Mg',
  }
  return icons[type] || 'DB'
}

/**
 * **getName()** - Retourne le nom complet du type de BDD
 *
 * @param type - Type de base de données
 * @returns Nom complet pour l'affichage
 */
function getName(type: string): string {
  const names: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL / MariaDB',
    redis: 'Redis',
    mongodb: 'MongoDB',
  }
  return names[type] || type
}
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    CONTENU PRINCIPAL
    ═══════════════════════════════════════════════════════════════════════════
  -->
  <div class="flex-1 overflow-y-auto p-6">
    <!--
      BANDEAU SERVEUR SÉLECTIONNÉ
      Rappelle quel serveur est sélectionné + bouton rafraîchir
    -->
    <div class="flex items-center justify-between mb-6 p-4 bg-slate-50 rounded-xl">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Server class="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <span class="font-medium text-slate-900">{{ server.alias || server.hostname }}</span>
          <p class="text-sm text-slate-500">{{ server.ip }}</p>
        </div>
      </div>

      <!-- Bouton Rafraîchir -->
      <button
        @click="emit('refresh')"
        :disabled="refreshing"
        class="px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-2"
      >
        <RefreshCw :class="['w-4 h-4', { 'animate-spin': refreshing }]" />
        {{ t('common.refresh') }}
      </button>
    </div>

    <!--
      MESSAGE SI AUCUNE BDD
      Affiché quand le serveur n'a aucune base de données installée
    -->
    <div v-if="databases.length === 0" class="text-center py-12">
      <Database class="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <h4 class="text-lg font-medium text-slate-900 mb-2">
        {{ t('database.management.noDatabases') }}
      </h4>
      <p class="text-sm text-slate-500 mb-6">{{ t('database.management.noDatabasesDesc') }}</p>
      <button
        @click="emit('create')"
        class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors inline-flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        {{ t('database.management.createFirst') }}
      </button>
    </div>

    <!--
      LISTE DES BASES DE DONNÉES
      Organisée par type (PostgreSQL, MySQL, etc.)
    -->
    <div v-else class="space-y-4">
      <!-- Barre de titre + bouton créer -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900">
          {{ t('database.management.installedDatabases') }}
        </h3>
        <button
          @click="emit('create')"
          class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <Plus class="w-4 h-4" />
          {{ t('database.management.createNew') }}
        </button>
      </div>

      <!-- Cartes par type de BDD -->
      <div class="grid gap-4">
        <div
          v-for="db in databases"
          :key="db.type"
          class="border border-slate-200 rounded-xl overflow-hidden"
        >
          <!--
            EN-TÊTE : Type + version + statut running/stopped
          -->
          <div class="p-4 bg-slate-50 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- Icône colorée selon le type -->
              <div :class="['w-10 h-10 rounded-xl flex items-center justify-center', getColorClass(db.type)]">
                <span class="text-sm font-bold">{{ getIcon(db.type) }}</span>
              </div>
              <div>
                <h4 class="font-semibold text-slate-900">{{ getName(db.type) }}</h4>
                <p class="text-xs text-slate-500">
                  {{ db.version || t('database.management.versionUnknown') }}
                </p>
              </div>
            </div>

            <!-- Badge Running/Stopped -->
            <span
              :class="[
                'px-2 py-1 text-xs rounded-full',
                db.running ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
              ]"
            >
              {{ db.running ? t('common.running') : t('common.stopped') }}
            </span>
          </div>

          <!--
            LISTE DES INSTANCES
            Chaque base de données individuelle avec ses boutons d'action
          -->
          <div class="divide-y divide-slate-100">
            <div
              v-for="instance in db.instances"
              :key="instance.name"
              class="p-4 flex items-center justify-between"
            >
              <!-- Infos de l'instance -->
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <HardDrive class="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <span class="font-medium text-slate-900">{{ instance.name }}</span>
                  <p v-if="instance.user" class="text-xs text-slate-500">
                    {{ t('database.management.user') }}: {{ instance.user }}
                  </p>
                </div>
              </div>

              <!-- Boutons d'action -->
              <div class="flex items-center gap-2">
                <!-- Voir connexion -->
                <button
                  @click="emit('viewConnection', db.type, instance)"
                  class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  :title="t('database.management.viewConnection')"
                >
                  <Eye class="w-4 h-4" />
                </button>

                <!-- Reset password -->
                <button
                  @click="emit('resetPassword', db.type, instance)"
                  class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  :title="t('database.management.resetPassword')"
                >
                  <Key class="w-4 h-4" />
                </button>

                <!-- Supprimer -->
                <button
                  @click="emit('delete', db.type, instance)"
                  class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  :title="t('database.management.deleteDatabase')"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Message si aucune instance pour ce type -->
            <div v-if="db.instances.length === 0" class="p-4 text-center text-sm text-slate-500">
              {{ t('database.management.noInstances') }}
              <button
                @click="emit('createForType', db.type)"
                class="text-emerald-600 hover:underline ml-1"
              >
                {{ t('database.management.createOne') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
