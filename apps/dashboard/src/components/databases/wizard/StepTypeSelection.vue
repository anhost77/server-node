<!--
  @file apps/dashboard/src/components/databases/wizard/StepTypeSelection.vue

  @description Étape 1 du wizard : Sélection du type de base de données.

  Ce composant permet à l'utilisateur de choisir quel type de base de données
  il souhaite installer sur son serveur. Les options sont :
  - PostgreSQL (recommandé) : BDD relationnelle puissante
  - MySQL / MariaDB : BDD populaire pour WordPress et PHP
  - Redis : Cache et stockage clé-valeur ultra-rapide
  - MongoDB : BDD NoSQL orientée documents

  Chaque option est présentée avec :
  - Une icône colorée (2 lettres)
  - Un titre et une description
  - Des tags montrant les cas d'usage
  - Un badge "Recommandé" pour PostgreSQL

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : CheckCircle2 (coche de sélection)

  @fonctions_principales
  - select() : Émet le type sélectionné au composant parent
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CheckCircle2 } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **DbType** - Les types de bases de données supportés
 *
 * - postgresql : Base de données relationnelle open-source avancée
 * - mysql : Base de données populaire (compatible MariaDB)
 * - redis : Stockage clé-valeur en mémoire (cache, sessions)
 * - mongodb : Base de données NoSQL orientée documents
 */
type DbType = 'postgresql' | 'mysql' | 'redis' | 'mongodb'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /**
   * Type de BDD actuellement sélectionné.
   * Ce composant utilise v-model, donc cette prop est liée à 'update:modelValue'.
   */
  modelValue: DbType
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /**
   * Émis quand l'utilisateur sélectionne un type de BDD.
   * Le parent reçoit la nouvelle valeur et peut mettre à jour son état.
   */
  'update:modelValue': [value: DbType]
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **select()** - Sélectionne un type de base de données
 *
 * Cette fonction est appelée quand l'utilisateur clique sur une des cartes.
 * Elle émet l'événement 'update:modelValue' pour informer le parent.
 *
 * @param type - Le type de BDD sélectionné ('postgresql', 'mysql', etc.)
 */
function select(type: DbType) {
  emit('update:modelValue', type)
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
      Titre et description pour expliquer ce que l'utilisateur doit faire
    -->
    <div>
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.selection.title') }}
      </h3>
      <p class="text-sm text-slate-600">{{ t('database.wizard.selection.description') }}</p>
    </div>

    <!--
      GRILLE DES OPTIONS
      Chaque type de BDD est représenté par une carte cliquable
    -->
    <div class="grid gap-4">
      <!--
        ═══════════════════════════════════════════════════════════════════════
        OPTION 1 : POSTGRESQL (Recommandé)
        ═══════════════════════════════════════════════════════════════════════
        PostgreSQL est la BDD recommandée car elle est :
        - Open-source et gratuite
        - Très performante et fiable
        - Supportant des fonctionnalités avancées (JSON, extensions...)
      -->
      <label
        :class="[
          'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
          modelValue === 'postgresql' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300',
        ]"
      >
        <!-- Input radio caché (pour l'accessibilité) -->
        <input type="radio" :checked="modelValue === 'postgresql'" @change="select('postgresql')" class="sr-only" />

        <!-- Icône de la BDD (fond bleu, lettres PG) -->
        <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <span class="text-lg font-bold text-blue-600">PG</span>
        </div>

        <!-- Contenu textuel -->
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <h4 class="font-semibold text-slate-900">PostgreSQL</h4>
            <!-- Badge "Recommandé" en vert -->
            <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{{ t('database.wizard.recommended') }}</span>
          </div>
          <p class="text-sm text-slate-600 mt-1">{{ t('database.wizard.selection.postgresql.description') }}</p>
          <!-- Tags des fonctionnalités -->
          <div class="flex flex-wrap gap-2 mt-2">
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Transactions ACID</span>
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">JSON/JSONB</span>
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Extensions</span>
          </div>
        </div>

        <!-- Coche de sélection (visible uniquement si sélectionné) -->
        <CheckCircle2 v-if="modelValue === 'postgresql'" class="absolute top-4 right-4 w-5 h-5 text-blue-500" />
      </label>

      <!--
        ═══════════════════════════════════════════════════════════════════════
        OPTION 2 : MYSQL / MARIADB
        ═══════════════════════════════════════════════════════════════════════
        MySQL est populaire pour :
        - WordPress et les sites PHP
        - Sa facilité d'utilisation
        - Sa grande communauté
      -->
      <label
        :class="[
          'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
          modelValue === 'mysql' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300',
        ]"
      >
        <input type="radio" :checked="modelValue === 'mysql'" @change="select('mysql')" class="sr-only" />

        <!-- Icône orange pour MySQL -->
        <div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <span class="text-lg font-bold text-orange-600">My</span>
        </div>

        <div class="flex-1">
          <h4 class="font-semibold text-slate-900">MySQL / MariaDB</h4>
          <p class="text-sm text-slate-600 mt-1">{{ t('database.wizard.selection.mysql.description') }}</p>
          <div class="flex flex-wrap gap-2 mt-2">
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">WordPress</span>
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Lectures rapides</span>
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Ecosystème PHP</span>
          </div>
        </div>

        <CheckCircle2 v-if="modelValue === 'mysql'" class="absolute top-4 right-4 w-5 h-5 text-blue-500" />
      </label>

      <!--
        ═══════════════════════════════════════════════════════════════════════
        OPTION 3 : REDIS
        ═══════════════════════════════════════════════════════════════════════
        Redis est idéal pour :
        - Le cache (stocker temporairement des données)
        - Les sessions utilisateurs
        - Les files d'attente (queues)
        - Tout ce qui nécessite des accès ultra-rapides
      -->
      <label
        :class="[
          'relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all',
          modelValue === 'redis' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300',
        ]"
      >
        <input type="radio" :checked="modelValue === 'redis'" @change="select('redis')" class="sr-only" />

        <!-- Icône rouge pour Redis -->
        <div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <span class="text-lg font-bold text-red-600">Rd</span>
        </div>

        <div class="flex-1">
          <h4 class="font-semibold text-slate-900">Redis</h4>
          <p class="text-sm text-slate-600 mt-1">{{ t('database.wizard.selection.redis.description') }}</p>
          <div class="flex flex-wrap gap-2 mt-2">
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Cache</span>
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Sessions</span>
            <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Queues</span>
          </div>
        </div>

        <CheckCircle2 v-if="modelValue === 'redis'" class="absolute top-4 right-4 w-5 h-5 text-blue-500" />
      </label>
    </div>
  </div>
</template>
