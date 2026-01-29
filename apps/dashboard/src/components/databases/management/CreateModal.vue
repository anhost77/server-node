<!--
  @file apps/dashboard/src/components/databases/management/CreateModal.vue

  @description Modal de création d'une nouvelle base de données.

  Ce modal permet de créer une nouvelle base de données sur le serveur.
  L'utilisateur choisit :
  - Le TYPE de BDD (PostgreSQL, MySQL, Redis)
  - Le NOM de la base de données
  - Le NOM D'UTILISATEUR qui aura accès

  Le mot de passe est TOUJOURS généré automatiquement pour des raisons
  de sécurité. Il sera affiché une seule fois après la création.

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : X, Plus, Lock, Loader2

  @fonctions_principales
  - isFormValid : Vérifie que le formulaire est valide
  - handleCreate() : Lance la création
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Plus, Lock, Loader2 } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */
type DbType = 'postgresql' | 'mysql' | 'redis' | 'mongodb'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Création en cours ? */
  loading: boolean
  /** Type présélectionné (optionnel) */
  preselectedType?: string
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Fermer le modal */
  close: []
  /** Créer la BDD avec les infos saisies */
  create: [dbType: DbType, databaseName: string, username: string]
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT LOCAL
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Type de BDD sélectionné */
const dbType = ref<DbType>('postgresql')

/** Nom de la base de données */
const databaseName = ref('')

/** Nom d'utilisateur */
const username = ref('')

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DONNÉES STATIQUES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **dbTypes** - Types de BDD disponibles avec leurs infos d'affichage
 *
 * Chaque type a :
 * - id : L'identifiant technique
 * - name : Le nom affiché
 * - icon : L'abréviation (2 lettres)
 * - colorClass : Les classes CSS de couleur
 */
const dbTypes = [
  { id: 'postgresql' as DbType, name: 'PostgreSQL', icon: 'PG', colorClass: 'bg-blue-100 text-blue-600' },
  { id: 'mysql' as DbType, name: 'MySQL / MariaDB', icon: 'My', colorClass: 'bg-orange-100 text-orange-600' },
  { id: 'redis' as DbType, name: 'Redis', icon: 'Rd', colorClass: 'bg-red-100 text-red-600' },
]

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPRIÉTÉS CALCULÉES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **isFormValid** - Le formulaire est-il valide ?
 *
 * - Redis n'a pas besoin de nom de BDD (c'est un cache clé-valeur)
 * - Les autres types nécessitent au minimum un nom de BDD
 */
const isFormValid = computed(() => {
  if (dbType.value === 'redis') return true
  return databaseName.value.trim().length > 0
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WATCHERS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Si un type est présélectionné, l'appliquer automatiquement
 */
watch(() => props.preselectedType, (val) => {
  if (val && ['postgresql', 'mysql', 'redis', 'mongodb'].includes(val)) {
    dbType.value = val as DbType
  }
}, { immediate: true })

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **handleCreate()** - Lance la création de la BDD
 *
 * Si aucun username n'est fourni, on en génère un automatiquement
 * basé sur le nom de la BDD (ex: "app_db" → "app_db_user")
 */
function handleCreate() {
  emit('create', dbType.value, databaseName.value, username.value || `${databaseName.value}_user`)
}
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    OVERLAY DU MODAL
    ═══════════════════════════════════════════════════════════════════════════
  -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <!--
        EN-TÊTE
      -->
      <div class="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 class="font-semibold text-slate-900">{{ t('database.management.createNewDatabase') }}</h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!--
        CONTENU
      -->
      <div class="p-4 space-y-4">
        <!--
          SÉLECTION DU TYPE DE BDD
          Grille de boutons pour choisir PostgreSQL, MySQL ou Redis
        -->
        <div>
          <label class="text-sm font-medium text-slate-700 block mb-2">{{ t('database.management.selectType') }}</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="type in dbTypes"
              :key="type.id"
              @click="dbType = type.id"
              :class="[
                'p-3 border rounded-lg text-left transition-all',
                dbType === type.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <div class="flex items-center gap-2">
                <!-- Icône colorée du type -->
                <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', type.colorClass]">
                  <span class="text-xs font-bold">{{ type.icon }}</span>
                </div>
                <span class="font-medium text-slate-900 text-sm">{{ type.name }}</span>
              </div>
            </button>
          </div>
        </div>

        <!--
          NOM DE LA BASE DE DONNÉES
          Non affiché pour Redis (pas de concept de "database name")
        -->
        <div v-if="dbType !== 'redis'">
          <label class="text-sm font-medium text-slate-700 block mb-1">{{ t('database.management.databaseName') }}</label>
          <input
            v-model="databaseName"
            type="text"
            placeholder="my_database"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <!--
          NOM D'UTILISATEUR
          Non affiché pour Redis (pas de concept d'utilisateur par BDD)
        -->
        <div v-if="dbType !== 'redis'">
          <label class="text-sm font-medium text-slate-700 block mb-1">{{ t('database.management.username') }}</label>
          <input
            v-model="username"
            type="text"
            :placeholder="databaseName ? `${databaseName}_user` : 'db_user'"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <!--
          INFO : MOT DE PASSE AUTO-GÉNÉRÉ
          Rappelle que le password sera généré automatiquement
        -->
        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div class="flex items-start gap-2">
            <Lock class="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-emerald-700">{{ t('database.management.passwordAutoGenerated') }}</p>
          </div>
        </div>
      </div>

      <!--
        PIED DE PAGE
        Boutons Annuler et Créer
      -->
      <div class="p-4 border-t border-slate-200 flex justify-end gap-3">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          @click="handleCreate"
          :disabled="loading || !isFormValid"
          class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <!-- Spinner si en cours -->
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          <Plus v-else class="w-4 h-4" />
          {{ t('database.management.create') }}
        </button>
      </div>
    </div>
  </div>
</template>
