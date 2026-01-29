<!--
  @file apps/dashboard/src/components/databases/wizard/StepInstallation.vue

  @description Étape 7 du wizard : Installation en cours avec logs temps réel.

  Ce composant affiche la progression de l'installation de la base de données.
  Il montre :
  - Les étapes d'installation avec leur statut (en attente, en cours, terminé, erreur)
  - Les logs en temps réel dans une console stylisée
  - Le message de succès avec la connection string une fois terminé

  IMPORTANT : Cette étape est "bloquante" - l'utilisateur ne peut pas
  naviguer tant que l'installation n'est pas terminée (succès ou erreur).

  @dependencies
  - Vue 3 : Framework frontend avec ref, watch, nextTick
  - vue-i18n : Traductions
  - Lucide Icons : Loader2 (spinner), CheckCircle2 (succès), XCircle (erreur), Copy (copier)

  @fonctions_principales
  - Auto-scroll des logs vers le bas quand de nouveaux logs arrivent
-->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **InstallStep** - Une étape dans le processus d'installation
 *
 * Chaque étape représente une action de l'installation :
 * - Installation des packages
 * - Configuration
 * - Création de l'utilisateur
 * - etc.
 */
interface InstallStep {
  /** Identifiant unique de l'étape */
  id: string
  /** Nom affiché à l'utilisateur */
  name: string
  /**
   * Statut de l'étape :
   * - pending : En attente (pas encore commencée)
   * - running : En cours d'exécution (avec spinner)
   * - complete : Terminée avec succès (coche verte)
   * - error : Échouée (croix rouge)
   */
  status: 'pending' | 'running' | 'complete' | 'error'
  /** Message optionnel (ex: message d'erreur) */
  message?: string
}

/**
 * **LogEntry** - Une ligne de log de la console
 *
 * Les logs sont affichés en temps réel pendant l'installation.
 * La couleur dépend du stream (stdout = vert, stderr = rouge).
 */
interface LogEntry {
  /** Contenu du message de log */
  message: string
  /** Source du log : stdout (normal) ou stderr (erreur) */
  stream: 'stdout' | 'stderr'
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** L'installation est-elle en cours ? */
  installing: boolean
  /** L'installation est-elle terminée (avec succès) ? */
  installComplete: boolean
  /** Liste des étapes avec leur statut */
  steps: InstallStep[]
  /** Liste des logs en temps réel */
  logs: LogEntry[]
  /** Connection string à afficher une fois l'installation terminée */
  connectionString: string
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** L'utilisateur veut copier la connection string */
  copyConnectionString: []
}>()

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT LOCAL
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Référence vers le conteneur des logs pour l'auto-scroll.
 * Permet de faire défiler automatiquement vers le bas quand
 * de nouveaux logs arrivent.
 */
const logsContainer = ref<HTMLElement | null>(null)

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WATCHERS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **Auto-scroll des logs**
 *
 * Quand de nouveaux logs arrivent, on fait défiler automatiquement
 * le conteneur vers le bas pour que l'utilisateur voie toujours
 * les derniers messages.
 *
 * On utilise nextTick() pour attendre que le DOM soit mis à jour
 * avant de scroller, sinon on scrollerait vers l'ancienne hauteur.
 */
watch(() => props.logs.length, () => {
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  })
})
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
      Affiché uniquement pendant l'installation (pas après la fin)
    -->
    <div v-if="!installComplete">
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.install.title') }}
      </h3>
      <p class="text-sm text-slate-600">{{ t('database.wizard.install.description') }}</p>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      AFFICHAGE PENDANT L'INSTALLATION
      ═══════════════════════════════════════════════════════════════════════════
      Montre les étapes et les logs pendant que l'installation est en cours
    -->
    <div v-if="installing" class="space-y-4">
      <!--
        LISTE DES ÉTAPES D'INSTALLATION
        Chaque étape a un indicateur visuel de son statut
      -->
      <div
        v-for="step in steps"
        :key="step.id"
        class="flex items-center gap-3 p-3 rounded-lg"
        :class="{
          'bg-blue-50': step.status === 'running',
          'bg-green-50': step.status === 'complete',
          'bg-red-50': step.status === 'error',
        }"
      >
        <!--
          INDICATEUR DE STATUT
          - Numéro dans un cercle gris : en attente
          - Spinner bleu : en cours
          - Coche verte : terminé
          - Croix rouge : erreur
        -->
        <div
          v-if="step.status === 'pending'"
          class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"
        >
          <!-- Numéro de l'étape (1, 2, 3...) -->
          <span class="text-xs text-slate-500">{{ steps.indexOf(step) + 1 }}</span>
        </div>
        <!-- Spinner animé pour l'étape en cours -->
        <Loader2 v-else-if="step.status === 'running'" class="w-6 h-6 text-blue-500 animate-spin" />
        <!-- Coche verte pour les étapes terminées -->
        <CheckCircle2 v-else-if="step.status === 'complete'" class="w-6 h-6 text-green-500" />
        <!-- Croix rouge pour les étapes en erreur -->
        <XCircle v-else-if="step.status === 'error'" class="w-6 h-6 text-red-500" />

        <!--
          NOM ET MESSAGE DE L'ÉTAPE
        -->
        <div class="flex-1">
          <span :class="['text-sm font-medium', step.status === 'running' ? 'text-blue-600' : 'text-slate-700']">
            {{ step.name }}
          </span>
          <!-- Message optionnel (ex: erreur détaillée) -->
          <p v-if="step.message" class="text-xs text-slate-500">{{ step.message }}</p>
        </div>
      </div>

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        CONSOLE DE LOGS
        ═══════════════════════════════════════════════════════════════════════════
        Affiche les logs en temps réel dans un style "terminal"
      -->
      <div class="mt-4">
        <!-- En-tête de la console avec compteur de lignes -->
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-slate-700">Console</span>
          <span class="text-xs text-slate-500">{{ logs.length }} lignes</span>
        </div>

        <!--
          CONTENEUR DES LOGS
          - Fond noir style terminal
          - Police monospace
          - Hauteur fixe avec scroll
        -->
        <div
          ref="logsContainer"
          class="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs"
        >
          <!--
            LIGNES DE LOG
            - Vert pour stdout (sortie normale)
            - Rouge pour stderr (erreurs)
          -->
          <div
            v-for="(log, i) in logs"
            :key="i"
            :class="['whitespace-pre-wrap', log.stream === 'stderr' ? 'text-red-400' : 'text-green-400']"
          >
            {{ log.message }}
          </div>

          <!-- Message si aucun log n'est encore arrivé -->
          <div v-if="!logs.length" class="text-slate-500 italic">
            {{ t('database.wizard.install.waitingLogs') }}
          </div>
        </div>
      </div>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      AFFICHAGE APRÈS INSTALLATION RÉUSSIE
      ═══════════════════════════════════════════════════════════════════════════
      Message de succès avec la connection string à copier
    -->
    <div v-if="installComplete" class="text-center py-8">
      <!--
        ICÔNE DE SUCCÈS
        Grande icône verte pour montrer clairement que tout s'est bien passé
      -->
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 class="w-8 h-8 text-green-600" />
      </div>

      <!--
        MESSAGE DE SUCCÈS
      -->
      <h4 class="text-lg font-semibold text-slate-900 mb-2">
        {{ t('database.wizard.install.complete') }}
      </h4>
      <p class="text-sm text-slate-600 mb-4">{{ t('database.wizard.install.completeDesc') }}</p>

      <!--
        CONNECTION STRING
        La chaîne de connexion que l'utilisateur peut copier pour
        configurer son application.

        Ex: postgresql://user:password@localhost:5432/dbname
      -->
      <div v-if="connectionString" class="p-4 bg-slate-100 rounded-xl text-left mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-slate-700">{{ t('database.wizard.install.connectionString') }}</span>
          <!-- Bouton pour copier dans le presse-papier -->
          <button @click="emit('copyConnectionString')" class="text-blue-500 hover:text-blue-600">
            <Copy class="w-4 h-4" />
          </button>
        </div>
        <!-- La connection string elle-même, avec break-all pour les longues URLs -->
        <code class="text-xs text-slate-600 break-all">{{ connectionString }}</code>
      </div>
    </div>
  </div>
</template>
