<!--
  @file apps/dashboard/src/components/databases/management/OperationProgressModal.vue

  @description Modal qui affiche la progression d'une opération sur la base de données.

  Ce composant s'affiche pendant qu'une opération est en cours (création de BDD,
  reset de mot de passe, etc.). Il montre :
  - Un titre indiquant l'opération en cours
  - Une console avec les logs en temps réel (style terminal noir)
  - Un spinner tant que l'opération n'est pas terminée
  - Le résultat (succès avec mot de passe, ou erreur)

  C'est comme une fenêtre de terminal qui permet de voir ce qui se passe
  sur le serveur pendant l'opération.

  @dependencies
  - Vue 3 : Framework frontend
  - vue-i18n : Traductions
  - Lucide Icons : Loader2 (spinner), CheckCircle2 (succès), XCircle (erreur), Copy (copier)

  @fonctions_principales
  - Auto-scroll des logs vers le bas quand de nouveaux logs arrivent
  - Copie du mot de passe dans le presse-papier
-->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, CheckCircle2, XCircle, Copy, X } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **LogEntry** - Une ligne de log dans la console
 *
 * Les logs sont affichés en temps réel pendant l'opération.
 * - stdout (vert) : messages normaux
 * - stderr (rouge) : erreurs ou avertissements
 */
interface LogEntry {
  message: string
  stream: 'stdout' | 'stderr'
}

/**
 * **OperationResult** - Résultat de l'opération une fois terminée
 */
interface OperationResult {
  success: boolean
  operation: 'reset_password' | 'create_database'
  connectionString?: string
  password?: string
  error?: string
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Titre de l'opération (ex: "Création de la base de données") */
  title: string
  /** Sous-titre optionnel (ex: nom de la BDD) */
  subtitle?: string
  /** Liste des logs en temps réel */
  logs: LogEntry[]
  /** Résultat de l'opération (null si en cours) */
  result: OperationResult | null
  /** Opération en cours ? */
  loading: boolean
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Fermer le modal */
  close: []
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT LOCAL
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Référence vers le conteneur des logs pour l'auto-scroll */
const logsContainer = ref<HTMLElement | null>(null)

/** Indique si le mot de passe a été copié */
const copied = ref(false)

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WATCHERS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **Auto-scroll des logs**
 *
 * Quand de nouveaux logs arrivent, on fait défiler automatiquement
 * la console vers le bas pour que l'utilisateur voie toujours
 * les derniers messages.
 */
watch(() => props.logs.length, () => {
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **copyPassword()** - Copie le mot de passe dans le presse-papier
 *
 * Affiche une confirmation visuelle pendant 2 secondes.
 */
function copyPassword() {
  if (props.result?.password) {
    navigator.clipboard.writeText(props.result.password)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

/**
 * **copyConnectionString()** - Copie la connection string dans le presse-papier
 */
function copyConnectionString() {
  if (props.result?.connectionString) {
    navigator.clipboard.writeText(props.result.connectionString)
  }
}
</script>

<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    OVERLAY DU MODAL
    ═══════════════════════════════════════════════════════════════════════════
    Fond semi-transparent qui recouvre l'écran.
    z-60 pour être au-dessus des autres modals (z-50).
  -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
      <!--
        ═══════════════════════════════════════════════════════════════════════════
        EN-TÊTE
        ═══════════════════════════════════════════════════════════════════════════
        Titre de l'opération avec spinner si en cours
      -->
      <div class="p-4 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Spinner si opération en cours -->
          <Loader2 v-if="loading" class="w-5 h-5 text-emerald-500 animate-spin" />
          <!-- Icône succès -->
          <CheckCircle2 v-else-if="result?.success" class="w-5 h-5 text-green-500" />
          <!-- Icône erreur -->
          <XCircle v-else-if="result && !result.success" class="w-5 h-5 text-red-500" />

          <div>
            <h3 class="font-semibold text-slate-900">{{ title }}</h3>
            <p v-if="subtitle" class="text-sm text-slate-500">{{ subtitle }}</p>
          </div>
        </div>

        <!-- Bouton fermer (seulement si opération terminée) -->
        <button
          v-if="!loading"
          @click="emit('close')"
          class="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        CONSOLE DE LOGS
        ═══════════════════════════════════════════════════════════════════════════
        Affiche les logs en temps réel dans un style "terminal"
      -->
      <div
        ref="logsContainer"
        class="flex-1 bg-slate-900 p-4 font-mono text-xs overflow-y-auto min-h-[200px] max-h-[300px]"
      >
        <!-- Message si aucun log -->
        <div v-if="logs.length === 0" class="text-slate-500 text-center py-4">
          <Loader2 v-if="loading" class="w-6 h-6 animate-spin mx-auto mb-2" />
          <span>{{ t('database.management.waitingForLogs') || 'En attente des logs...' }}</span>
        </div>

        <!-- Lignes de log -->
        <div
          v-for="(log, i) in logs"
          :key="i"
          :class="[
            'whitespace-pre-wrap leading-relaxed',
            log.stream === 'stderr' ? 'text-red-400' : 'text-green-400'
          ]"
        >
          {{ log.message }}
        </div>
      </div>

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        RÉSULTAT (affiché une fois l'opération terminée)
        ═══════════════════════════════════════════════════════════════════════════
      -->
      <div v-if="result" class="p-4 border-t border-slate-200">
        <!--
          SUCCÈS : Affiche le mot de passe et la connection string
        -->
        <div v-if="result.success" class="space-y-3">
          <!-- Mot de passe généré -->
          <div v-if="result.password" class="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-green-800">
                {{ t('database.management.generatedPassword') || 'Mot de passe généré' }}
              </span>
              <button
                @click="copyPassword"
                class="text-green-600 hover:text-green-700 flex items-center gap-1 text-sm"
              >
                <Copy class="w-4 h-4" />
                {{ copied ? 'Copié !' : 'Copier' }}
              </button>
            </div>
            <code class="text-sm text-green-700 font-mono break-all">{{ result.password }}</code>
          </div>

          <!-- Connection string -->
          <div v-if="result.connectionString" class="p-3 bg-slate-100 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-slate-700">Connection String</span>
              <button
                @click="copyConnectionString"
                class="text-slate-600 hover:text-slate-700"
              >
                <Copy class="w-4 h-4" />
              </button>
            </div>
            <code class="text-xs text-slate-600 font-mono break-all">{{ result.connectionString }}</code>
          </div>

          <!-- Avertissement : mot de passe affiché une seule fois -->
          <p class="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            {{ t('database.management.passwordWarning') || '⚠️ Ce mot de passe ne sera plus affiché. Notez-le maintenant !' }}
          </p>
        </div>

        <!--
          ERREUR : Affiche le message d'erreur
        -->
        <div v-else class="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-700">
            {{ result.error || t('database.management.operationFailed') || 'L\'opération a échoué' }}
          </p>
        </div>
      </div>

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        PIED DE PAGE
        ═══════════════════════════════════════════════════════════════════════════
      -->
      <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
        <span class="text-xs text-slate-500">{{ logs.length }} lignes</span>
        <button
          v-if="!loading"
          @click="emit('close')"
          class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
        >
          {{ t('common.close') || 'Fermer' }}
        </button>
        <span v-else class="text-sm text-slate-500">
          {{ t('database.management.operationInProgress') || 'Opération en cours...' }}
        </span>
      </div>
    </div>
  </div>
</template>
