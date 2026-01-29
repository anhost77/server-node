<!--
  @file apps/dashboard/src/components/databases/wizard/StepPerformanceConfig.vue

  @description Étape 5 du wizard : Configuration des performances.

  Ce composant permet de configurer les paramètres de performance de la BDD.
  C'est une étape OPTIONNELLE - les valeurs par défaut sont bonnes pour
  la plupart des cas.

  L'utilisateur peut choisir parmi des PRESETS (configurations prédéfinies) :
  - Auto (recommandé) : Calculé automatiquement selon la RAM du serveur
  - Light : Pour les petits serveurs ou utilisation légère
  - Standard : Configuration équilibrée
  - Performance : Pour les serveurs puissants avec beaucoup de trafic
  - Custom : Configuration manuelle de chaque paramètre

  Les paramètres varient selon le type de BDD :
  - PostgreSQL : shared_buffers, max_connections
  - MySQL : innodb_buffer_pool_size, max_connections
  - Redis : maxmemory, maxmemory-policy
  - MongoDB : wiredTigerCacheSizeGB

  @dependencies
  - Vue 3 : Framework frontend avec ref, computed
  - vue-i18n : Traductions
  - Lucide Icons : Gauge (jauge), ChevronDown (flèche accordéon)

  @fonctions_principales
  - serverRamGB : Calcul de la RAM du serveur en Go
  - recommendedValues : Valeurs recommandées selon le preset
  - applyPreset() : Applique un preset à la configuration
  - updateField() : Met à jour un champ individuel
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Gauge, ChevronDown } from 'lucide-vue-next'

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
 * **PerformancePreset** - Les presets de performance disponibles
 *
 * - auto : Calculé automatiquement (recommandé)
 * - light : Pour petits serveurs (<4GB RAM)
 * - standard : Configuration équilibrée (4-8GB RAM)
 * - performance : Pour serveurs puissants (>8GB RAM)
 * - custom : L'utilisateur définit chaque valeur manuellement
 */
type PerformancePreset = 'auto' | 'light' | 'standard' | 'performance' | 'custom'

/**
 * **PerformanceConfig** - Configuration de performance de la BDD
 *
 * Contient tous les paramètres de performance pour tous les types de BDD.
 * Seuls les paramètres pertinents sont utilisés selon le type.
 */
interface PerformanceConfig {
  /** Nombre max de connexions simultanées (PostgreSQL, MySQL) */
  maxConnections: number
  /** Taille du cache partagé PostgreSQL (ex: "1GB") */
  sharedBuffers: string
  /** Taille du buffer pool InnoDB MySQL (ex: "1G") */
  innodbBufferPoolSize: string
  /** Mémoire max Redis (ex: "512mb") */
  maxMemory: string
  /** Politique d'éviction Redis quand la mémoire est pleine */
  maxmemoryPolicy: string
  /** Taille du cache WiredTiger MongoDB en Go (ex: "2") */
  wiredTigerCacheSizeGB: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Type de BDD sélectionné */
  databaseType: DbType
  /** RAM du serveur (ex: "8 GB", "16GB", "2048 MB") */
  serverRam?: string
  /** Configuration actuelle */
  config: PerformanceConfig
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Mise à jour de la configuration complète */
  'update:config': [value: PerformanceConfig]
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT LOCAL
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** L'accordéon des performances est-il ouvert ? */
const accordionOpen = ref(false)

/** Preset actuellement sélectionné */
const performancePreset = ref<PerformancePreset>('auto')

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPRIÉTÉS CALCULÉES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **serverRamGB** - RAM du serveur convertie en Go
 *
 * Cette fonction prend la chaîne de caractères de RAM (ex: "8 GB", "2048 MB")
 * et la convertit en nombre de gigaoctets pour faciliter les calculs.
 *
 * Par défaut, on suppose 4 Go si l'info n'est pas disponible.
 */
const serverRamGB = computed(() => {
  if (!props.serverRam) return 4

  // Regex pour extraire le nombre et l'unité
  // Ex: "8 GB" → ["8 GB", "8", "GB"]
  const match = props.serverRam.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i)
  if (!match) return 4

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  // Conversion en Go
  if (unit === 'TB') return value * 1024
  if (unit === 'MB') return value / 1024
  return value
})

/**
 * **recommendedValues** - Valeurs recommandées pour chaque preset
 *
 * Calcule les valeurs optimales de configuration selon :
 * - Le preset sélectionné
 * - La RAM disponible sur le serveur
 *
 * Les formules sont basées sur les recommandations officielles
 * de chaque base de données.
 */
const recommendedValues = computed(() => {
  const ram = serverRamGB.value
  return {
    // Light : Pour petits serveurs, valeurs minimales
    light: {
      maxConnections: 50,
      sharedBuffers: '256MB',
      innodbBufferPoolSize: '256M',
      maxMemory: '128mb',
      wiredTigerCacheSizeGB: '0.5',
    },
    // Standard : Configuration équilibrée selon la RAM
    standard: {
      maxConnections: 100,
      sharedBuffers: ram >= 8 ? '1GB' : ram >= 4 ? '512MB' : '256MB',
      innodbBufferPoolSize: ram >= 8 ? '1G' : ram >= 4 ? '512M' : '256M',
      maxMemory: ram >= 8 ? '512mb' : ram >= 4 ? '256mb' : '128mb',
      wiredTigerCacheSizeGB: ram >= 8 ? '2' : ram >= 4 ? '1' : '0.5',
    },
    // Performance : Pour serveurs puissants, valeurs maximales
    performance: {
      maxConnections: ram >= 16 ? 300 : ram >= 8 ? 200 : 150,
      sharedBuffers: ram >= 16 ? '4GB' : ram >= 8 ? '2GB' : '1GB',
      innodbBufferPoolSize: ram >= 16 ? '4G' : ram >= 8 ? '2G' : '1G',
      maxMemory: ram >= 16 ? '2gb' : ram >= 8 ? '1gb' : '512mb',
      wiredTigerCacheSizeGB: ram >= 16 ? '4' : ram >= 8 ? '2' : '1',
    },
    // Auto : Calculé automatiquement, le meilleur compromis
    auto: {
      // Connexions : environ 25 par Go de RAM, max 300
      maxConnections: Math.min(Math.floor(ram * 25), 300),
      sharedBuffers: ram >= 16 ? '4GB' : ram >= 8 ? '2GB' : ram >= 4 ? '1GB' : '512MB',
      innodbBufferPoolSize: ram >= 16 ? '4G' : ram >= 8 ? '2G' : ram >= 4 ? '1G' : '512M',
      maxMemory: ram >= 16 ? '2gb' : ram >= 8 ? '1gb' : ram >= 4 ? '512mb' : '256mb',
      // Cache MongoDB : environ 25% de la RAM, max 4 Go
      wiredTigerCacheSizeGB: String(Math.min(Math.floor(ram * 0.25), 4)),
    },
  }
})

/**
 * **autoPresetDescription** - Description du preset Auto
 *
 * Affiche les valeurs calculées pour le preset Auto afin que
 * l'utilisateur sache ce qui sera appliqué.
 */
const autoPresetDescription = computed(() => {
  const v = recommendedValues.value.auto
  return `${v.maxConnections} conn. / ${v.sharedBuffers} cache`
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **applyPreset()** - Applique un preset de performance
 *
 * Quand l'utilisateur clique sur un preset, cette fonction :
 * 1. Met à jour le preset sélectionné (pour l'UI)
 * 2. Applique les valeurs correspondantes à la configuration
 *
 * Si le preset est "custom", on ne change pas les valeurs actuelles
 * pour permettre à l'utilisateur de les modifier manuellement.
 *
 * @param preset - Le preset à appliquer
 */
function applyPreset(preset: PerformancePreset) {
  performancePreset.value = preset

  // En mode custom, on laisse les valeurs actuelles
  if (preset === 'custom') return

  // Récupère les valeurs du preset et les applique
  const values = recommendedValues.value[preset]
  emit('update:config', {
    ...props.config,
    maxConnections: values.maxConnections,
    sharedBuffers: values.sharedBuffers,
    innodbBufferPoolSize: values.innodbBufferPoolSize,
    maxMemory: values.maxMemory,
    wiredTigerCacheSizeGB: values.wiredTigerCacheSizeGB,
  })
}

/**
 * **updateField()** - Met à jour un champ individuel de la config
 *
 * Utilisé en mode "custom" pour modifier un seul paramètre
 * sans affecter les autres.
 *
 * @param field - Le nom du champ à modifier
 * @param value - La nouvelle valeur
 */
function updateField<K extends keyof PerformanceConfig>(field: K, value: PerformanceConfig[K]) {
  emit('update:config', { ...props.config, [field]: value })
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
    -->
    <div>
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.advanced.title') }}
      </h3>
      <p class="text-sm text-slate-600">{{ t('database.wizard.advanced.description') }}</p>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      ACCORDÉON PERFORMANCE
      ═══════════════════════════════════════════════════════════════════════════
      Un accordéon permet de cacher les options avancées par défaut.
      L'utilisateur peut l'ouvrir s'il veut modifier les performances.
    -->
    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <!--
        BOUTON D'OUVERTURE DE L'ACCORDÉON
        Clique pour afficher/masquer les options
      -->
      <button
        @click="accordionOpen = !accordionOpen"
        class="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-left"
      >
        <div class="flex items-center gap-3">
          <!-- Icône jauge pour représenter les performances -->
          <Gauge class="w-5 h-5 text-slate-600" />
          <span class="font-medium text-slate-900">{{ t('database.wizard.advanced.performance.title') }}</span>
        </div>
        <!-- Flèche qui tourne quand l'accordéon est ouvert -->
        <ChevronDown :class="['w-5 h-5 text-slate-400 transition-transform', { 'rotate-180': accordionOpen }]" />
      </button>

      <!--
        CONTENU DE L'ACCORDÉON
        Visible uniquement quand accordionOpen est true
      -->
      <div v-show="accordionOpen" class="p-4 space-y-4">
        <!--
          INFO RAM DU SERVEUR
          Affiche la RAM disponible pour aider l'utilisateur à choisir
        -->
        <div v-if="serverRam" class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span class="text-sm text-blue-700">
            {{ t('database.wizard.advanced.performance.serverRam') }}: <strong>{{ serverRam }}</strong>
          </span>
        </div>

        <!--
          ═══════════════════════════════════════════════════════════════════════
          GRILLE DES PRESETS
          ═══════════════════════════════════════════════════════════════════════
          4 boutons en grille 2x2, plus un bouton Custom en dessous
        -->
        <div class="space-y-3">
          <label class="text-sm font-medium text-slate-700">{{ t('database.wizard.advanced.performance.presetLabel') }}</label>
          <div class="grid grid-cols-2 gap-2">
            <!--
              PRESET AUTO (Recommandé)
              Calculé automatiquement selon la RAM du serveur
            -->
            <button
              type="button"
              @click="applyPreset('auto')"
              :class="[
                'p-3 border rounded-lg text-left transition-all',
                performancePreset === 'auto' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
              ]"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetAuto') }}</span>
                <span class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">{{ t('common.recommended') }}</span>
              </div>
              <!-- Description des valeurs qui seront appliquées -->
              <p class="text-xs text-slate-500">{{ autoPresetDescription }}</p>
            </button>

            <!--
              PRESET LIGHT
              Pour les petits serveurs ou faible charge
            -->
            <button
              type="button"
              @click="applyPreset('light')"
              :class="[
                'p-3 border rounded-lg text-left transition-all',
                performancePreset === 'light' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
              ]"
            >
              <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetLight') }}</span>
              <p class="text-xs text-slate-500">50 conn. / 256MB cache</p>
            </button>

            <!--
              PRESET STANDARD
              Configuration équilibrée
            -->
            <button
              type="button"
              @click="applyPreset('standard')"
              :class="[
                'p-3 border rounded-lg text-left transition-all',
                performancePreset === 'standard' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
              ]"
            >
              <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetStandard') }}</span>
              <p class="text-xs text-slate-500">100 conn. / {{ recommendedValues.standard.sharedBuffers }} cache</p>
            </button>

            <!--
              PRESET PERFORMANCE
              Pour serveurs puissants avec beaucoup de trafic
            -->
            <button
              type="button"
              @click="applyPreset('performance')"
              :class="[
                'p-3 border rounded-lg text-left transition-all',
                performancePreset === 'performance' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
              ]"
            >
              <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetPerformance') }}</span>
              <p class="text-xs text-slate-500">{{ recommendedValues.performance.maxConnections }} conn. / {{ recommendedValues.performance.sharedBuffers }} cache</p>
            </button>
          </div>

          <!--
            PRESET CUSTOM
            Permet de définir chaque valeur manuellement
          -->
          <button
            type="button"
            @click="applyPreset('custom')"
            :class="[
              'w-full p-3 border rounded-lg text-left transition-all',
              performancePreset === 'custom' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
            ]"
          >
            <span class="text-sm font-medium text-slate-900">{{ t('database.wizard.advanced.performance.presetCustom') }}</span>
          </button>
        </div>

        <!--
          ═══════════════════════════════════════════════════════════════════════
          FORMULAIRE CUSTOM
          ═══════════════════════════════════════════════════════════════════════
          Visible uniquement en mode custom.
          Les champs varient selon le type de BDD.
        -->
        <div v-if="performancePreset === 'custom'" class="pt-4 border-t border-slate-200 space-y-4">
          <!--
            CONFIGURATION POSTGRESQL
          -->
          <template v-if="databaseType === 'postgresql'">
            <!-- Nombre max de connexions -->
            <label class="block">
              <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.maxConnections') }}</span>
              <input
                type="number"
                :value="config.maxConnections"
                @input="updateField('maxConnections', parseInt(($event.target as HTMLInputElement).value))"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <!-- Taille du cache partagé (shared_buffers) -->
            <label class="block">
              <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.sharedBuffers') }}</span>
              <select
                :value="config.sharedBuffers"
                @change="updateField('sharedBuffers', ($event.target as HTMLSelectElement).value)"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="128MB">128 MB</option>
                <option value="256MB">256 MB</option>
                <option value="512MB">512 MB</option>
                <option value="1GB">1 GB</option>
                <option value="2GB">2 GB</option>
                <option value="4GB">4 GB</option>
              </select>
            </label>
          </template>

          <!--
            CONFIGURATION MYSQL
          -->
          <template v-if="databaseType === 'mysql'">
            <!-- Nombre max de connexions -->
            <label class="block">
              <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.maxConnections') }}</span>
              <input
                type="number"
                :value="config.maxConnections"
                @input="updateField('maxConnections', parseInt(($event.target as HTMLInputElement).value))"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </label>
            <!-- Taille du buffer pool InnoDB -->
            <label class="block">
              <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.innodbBuffer') }}</span>
              <select
                :value="config.innodbBufferPoolSize"
                @change="updateField('innodbBufferPoolSize', ($event.target as HTMLSelectElement).value)"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="128M">128 MB</option>
                <option value="256M">256 MB</option>
                <option value="512M">512 MB</option>
                <option value="1G">1 GB</option>
                <option value="2G">2 GB</option>
                <option value="4G">4 GB</option>
              </select>
            </label>
          </template>

          <!--
            CONFIGURATION REDIS
          -->
          <template v-if="databaseType === 'redis'">
            <!-- Mémoire maximale -->
            <label class="block">
              <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.maxMemory') }}</span>
              <select
                :value="config.maxMemory"
                @change="updateField('maxMemory', ($event.target as HTMLSelectElement).value)"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="64mb">64 MB</option>
                <option value="128mb">128 MB</option>
                <option value="256mb">256 MB</option>
                <option value="512mb">512 MB</option>
                <option value="1gb">1 GB</option>
                <option value="2gb">2 GB</option>
              </select>
            </label>
            <!--
              Politique d'éviction : que faire quand la mémoire est pleine ?
              - allkeys-lru : Supprimer les clés les moins récemment utilisées
              - volatile-lru : Supprimer uniquement les clés avec TTL
              - noeviction : Refuser les nouvelles écritures
            -->
            <label class="block">
              <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.evictionPolicy') }}</span>
              <select
                :value="config.maxmemoryPolicy"
                @change="updateField('maxmemoryPolicy', ($event.target as HTMLSelectElement).value)"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="allkeys-lru">allkeys-lru</option>
                <option value="volatile-lru">volatile-lru</option>
                <option value="noeviction">noeviction</option>
              </select>
            </label>
          </template>

          <!--
            CONFIGURATION MONGODB
          -->
          <template v-if="databaseType === 'mongodb'">
            <!-- Taille du cache WiredTiger en Go -->
            <label class="block">
              <span class="text-sm text-slate-600">{{ t('database.wizard.advanced.performance.cacheSizeGB') }}</span>
              <select
                :value="config.wiredTigerCacheSizeGB"
                @change="updateField('wiredTigerCacheSizeGB', ($event.target as HTMLSelectElement).value)"
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="0.25">0.25 GB</option>
                <option value="0.5">0.5 GB</option>
                <option value="1">1 GB</option>
                <option value="2">2 GB</option>
                <option value="4">4 GB</option>
              </select>
            </label>
          </template>
        </div>

        <!--
          ═══════════════════════════════════════════════════════════════════════
          RÉSUMÉ DES VALEURS APPLIQUÉES
          ═══════════════════════════════════════════════════════════════════════
          Visible quand on n'est PAS en mode custom.
          Montre les valeurs qui seront utilisées.
        -->
        <div v-else class="p-3 bg-slate-50 rounded-lg">
          <p class="text-xs text-slate-500 mb-2">{{ t('database.wizard.advanced.performance.appliedValues') }}:</p>
          <div class="flex flex-wrap gap-2">
            <!-- Nombre de connexions (tous types sauf Redis) -->
            <span class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
              {{ config.maxConnections }} {{ t('database.wizard.advanced.performance.connections') }}
            </span>
            <!-- Shared buffers (PostgreSQL) -->
            <span v-if="databaseType === 'postgresql'" class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
              {{ config.sharedBuffers }} cache
            </span>
            <!-- InnoDB buffer (MySQL) -->
            <span v-if="databaseType === 'mysql'" class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
              {{ config.innodbBufferPoolSize }} buffer
            </span>
            <!-- Max memory (Redis) -->
            <span v-if="databaseType === 'redis'" class="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
              {{ config.maxMemory }} max
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
