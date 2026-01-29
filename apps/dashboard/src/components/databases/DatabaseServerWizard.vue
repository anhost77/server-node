<!--
  @file apps/dashboard/src/components/databases/DatabaseServerWizard.vue

  @description Wizard d'INSTALLATION de base de données étape par étape.

  Ce composant est un assistant multi-étapes pour installer une nouvelle
  base de données sur un serveur. Il guide l'utilisateur à travers :

  1. SÉLECTION DU TYPE : PostgreSQL, MySQL, Redis ou MongoDB
  2. SÉLECTION DU SERVEUR : Choisir sur quel serveur installer
  3. CONFIGURATION DE BASE : Nom de la BDD, utilisateur (ou usage Redis)
  4. SÉCURITÉ : Voir les mesures de sécurité automatiques
  5. PERFORMANCE : Configurer les paramètres avancés (optionnel)
  6. RÉSUMÉ : Vérifier la configuration avant installation
  7. INSTALLATION : Suivre la progression en temps réel

  Ce wizard est différent de DatabaseManagementWizard qui gère les BDD
  EXISTANTES. Celui-ci installe le serveur de BDD depuis zéro.

  @dependencies
  - Vue 3 : Framework frontend avec ref, computed, watch
  - vue-i18n : Traductions
  - Lucide Icons : Database, X, ChevronLeft, ChevronRight, Play

  @composants_enfants (dans wizard/)
  - StepIndicator : Barre de progression
  - StepTypeSelection : Sélection du type de BDD
  - StepServerSelection : Sélection du serveur cible
  - StepBasicConfig : Configuration nom/user
  - StepSecurityConfig : Info sécurité automatique
  - StepPerformanceConfig : Configuration performance
  - StepSummary : Récapitulatif
  - StepInstallation : Progression de l'installation

  @fonctions_principales
  - nextStep() / previousStep() : Navigation entre les étapes
  - startInstallation() : Lance l'installation
  - updateStepStatus() : Met à jour le statut des étapes d'installation
-->
<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    OVERLAY DU MODAL
    ═══════════════════════════════════════════════════════════════════════════
    Fond noir semi-transparent qui recouvre toute la page.
  -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!--
        ═══════════════════════════════════════════════════════════════════════════
        EN-TÊTE DU WIZARD
        ═══════════════════════════════════════════════════════════════════════════
        Bandeau bleu avec le titre et le bouton de fermeture.
        Couleur bleue pour différencier du wizard de gestion (vert).
      -->
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600">
        <div class="flex items-center gap-3">
          <!-- Icône dans un cercle semi-transparent -->
          <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Database class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">{{ t('database.wizard.title') }}</h2>
            <p class="text-sm text-white/80">{{ t('database.wizard.subtitle') }}</p>
          </div>
        </div>
        <!-- Bouton fermer (X) -->
        <button @click="$emit('close')" class="text-white/80 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        INDICATEUR DE PROGRESSION
        ═══════════════════════════════════════════════════════════════════════════
        Barre horizontale montrant les 7 étapes avec l'étape actuelle en surbrillance.
      -->
      <StepIndicator :steps="steps" :currentStep="currentStep" />

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        CONTENU PRINCIPAL - ÉTAPES DU WIZARD
        ═══════════════════════════════════════════════════════════════════════════
        Affiche le composant correspondant à l'étape actuelle.
        Un seul composant est visible à la fois grâce aux v-if.
      -->
      <div class="flex-1 overflow-y-auto p-6">
        <!--
          ÉTAPE 1 : TYPE DE BASE DE DONNÉES
          L'utilisateur choisit entre PostgreSQL, MySQL, Redis, MongoDB
        -->
        <StepTypeSelection
          v-if="currentStep === 0"
          v-model="config.databaseType"
        />

        <!--
          ÉTAPE 2 : SÉLECTION DU SERVEUR
          L'utilisateur choisit sur quel serveur installer la BDD
        -->
        <StepServerSelection
          v-if="currentStep === 1"
          :servers="servers"
          v-model="config.serverId"
          :databaseName="selectedDatabaseName"
        />

        <!--
          ÉTAPE 3 : CONFIGURATION DE BASE
          Nom de la BDD, nom d'utilisateur (ou usage Redis)
        -->
        <StepBasicConfig
          v-if="currentStep === 2"
          :databaseType="config.databaseType"
          :databaseName="config.basic.databaseName"
          :username="config.basic.username"
          :redisUsage="config.basic.redisUsage"
          @update:databaseName="config.basic.databaseName = $event"
          @update:username="onUsernameManualInput($event)"
          @update:redisUsage="config.basic.redisUsage = $event"
        />

        <!--
          ÉTAPE 4 : SÉCURITÉ (informative)
          Montre les mesures de sécurité qui seront appliquées automatiquement
        -->
        <StepSecurityConfig
          v-if="currentStep === 3"
          :databaseType="config.databaseType"
        />

        <!--
          ÉTAPE 5 : CONFIGURATION PERFORMANCE (optionnelle)
          L'utilisateur peut ajuster les paramètres de performance via des presets
        -->
        <StepPerformanceConfig
          v-if="currentStep === 4"
          :databaseType="config.databaseType"
          :serverRam="serverRam"
          :config="config.advanced.performance"
          @update:config="config.advanced.performance = $event"
        />

        <!--
          ÉTAPE 6 : RÉSUMÉ
          Récapitule toute la configuration pour vérification avant installation
        -->
        <StepSummary
          v-if="currentStep === 5"
          :databaseType="config.databaseType"
          :databaseName="config.basic.databaseName"
          :username="config.basic.username"
          :redisUsage="config.basic.redisUsage"
          :serverName="getServerName()"
        />

        <!--
          ÉTAPE 7 : INSTALLATION
          Affiche la progression de l'installation avec logs en temps réel
        -->
        <StepInstallation
          v-if="currentStep === 6"
          :installing="installing"
          :installComplete="installComplete"
          :installFailed="installFailed"
          :installError="installError"
          :steps="installationSteps"
          :logs="installationLogs || []"
          :connectionString="connectionString"
          @copyConnectionString="copyConnectionString"
        />
      </div>

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        PIED DE PAGE - NAVIGATION
        ═══════════════════════════════════════════════════════════════════════════
        Boutons Précédent et Suivant pour naviguer entre les étapes.
        Le bouton change selon l'étape :
        - Étapes 0-5 : "Suivant"
        - Étape 6 avant install : "Installer"
        - Après installation : "Terminé"
      -->
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <!--
          BOUTON PRÉCÉDENT
          Visible sauf à la première étape et pendant l'installation
        -->
        <button
          v-if="currentStep > 0 && !installing"
          @click="previousStep"
          class="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium flex items-center gap-2"
        >
          <ChevronLeft class="w-4 h-4" />
          {{ t('common.back') }}
        </button>
        <!-- Placeholder vide si pas de bouton Précédent -->
        <div v-else></div>

        <div class="flex items-center gap-3">
          <!--
            BOUTON SUIVANT
            Pour les étapes 0 à 5 (avant l'installation)
          -->
          <button
            v-if="currentStep < steps.length - 1"
            @click="nextStep"
            :disabled="!canProceed"
            class="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            {{ t('common.next') }}
            <ChevronRight class="w-4 h-4" />
          </button>

          <!--
            BOUTON INSTALLER
            À l'étape finale, avant de lancer l'installation
          -->
          <button
            v-else-if="!installing && !installComplete && !installFailed"
            @click="startInstallation"
            class="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            <Play class="w-4 h-4" />
            {{ t('database.wizard.install.start') }}
          </button>

          <!--
            BOUTON TERMINÉ
            Après la fin de l'installation pour fermer le wizard.
            Émet 'complete' pour que le parent rafraîchisse le statut du serveur.
          -->
          <button
            v-else-if="installComplete"
            @click="emit('complete', config)"
            class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            {{ t('common.done') }}
          </button>

          <!--
            BOUTON FERMER (ERREUR)
            Après un échec d'installation pour fermer le wizard.
            Le sys admin a pu voir les logs et comprendre le problème.
          -->
          <button
            v-else-if="installFailed"
            @click="$emit('close')"
            class="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Database, X, ChevronLeft, ChevronRight, Play } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IMPORTS DES COMPOSANTS D'ÉTAPES
 * ═══════════════════════════════════════════════════════════════════════════
 * Chaque étape du wizard est un composant séparé pour maintenir la lisibilité.
 */
import StepIndicator from './wizard/StepIndicator.vue'
import StepTypeSelection from './wizard/StepTypeSelection.vue'
import StepServerSelection from './wizard/StepServerSelection.vue'
import StepBasicConfig from './wizard/StepBasicConfig.vue'
import StepSecurityConfig from './wizard/StepSecurityConfig.vue'
import StepPerformanceConfig from './wizard/StepPerformanceConfig.vue'
import StepSummary from './wizard/StepSummary.vue'
import StepInstallation from './wizard/StepInstallation.vue'

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Types de bases de données supportés */
type DbType = 'postgresql' | 'mysql' | 'redis' | 'mongodb'

/** Types d'utilisation de Redis */
type RedisUsage = 'cache' | 'sessions' | 'queue' | 'general'

/**
 * **ServerInfo** - Informations sur un serveur disponible
 */
interface ServerInfo {
  /** Identifiant unique */
  id: string
  /** Nom d'hôte */
  hostname: string
  /** Adresse IP */
  ip: string
  /** Alias optionnel */
  alias?: string
  /** Est-il en ligne ? */
  online: boolean
}

/**
 * **InstallStep** - Une étape du processus d'installation
 */
interface InstallStep {
  /** Identifiant unique */
  id: string
  /** Nom affiché */
  name: string
  /** Statut actuel */
  status: 'pending' | 'running' | 'complete' | 'error'
  /** Message optionnel (ex: erreur) */
  message?: string
}

/**
 * **LogEntry** - Une ligne de log de l'installation
 */
interface LogEntry {
  /** Contenu du message */
  message: string
  /** Source : stdout (normal) ou stderr (erreur) */
  stream: 'stdout' | 'stderr'
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const emit = defineEmits<{
  /** Fermer le wizard */
  close: []
  /** Installation terminée avec succès */
  complete: [config: any]
  /** Lancer l'installation sur le serveur */
  configureDatabaseStack: [serverId: string, config: any]
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Liste des serveurs disponibles */
  servers: ServerInfo[]
  /** RAM du serveur sélectionné (pour les recommandations de performance) */
  serverRam?: string
  /** Logs d'installation reçus en temps réel */
  installationLogs?: LogEntry[]
  /** Résultat de l'installation */
  installationResult?: { success: boolean; connectionString?: string; error?: string } | null
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT DE NAVIGATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Index de l'étape actuelle (0-6) */
const currentStep = ref(0)

/**
 * **steps** - Définition des 7 étapes du wizard
 *
 * Chaque étape a un id et un titre affiché dans l'indicateur de progression.
 */
const steps = [
  { id: 'selection', title: 'Type' },
  { id: 'server', title: 'Serveur' },
  { id: 'config', title: 'Configuration' },
  { id: 'security', title: 'Sécurité' },
  { id: 'advanced', title: 'Avancé' },
  { id: 'summary', title: 'Résumé' },
  { id: 'install', title: 'Installation' },
]

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT DE CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 * Stocke toutes les valeurs saisies par l'utilisateur à travers les étapes.
 */
const config = ref({
  /** Type de BDD sélectionné */
  databaseType: 'postgresql' as DbType,
  /** ID du serveur sélectionné */
  serverId: '',
  /** Configuration de base */
  basic: {
    databaseName: '',
    username: '',
    redisUsage: 'cache' as RedisUsage,
  },
  /** Options de sécurité (appliquées automatiquement) */
  security: {
    enableTls: false,
    bindLocalhost: true,
    setRootPassword: true,
    removeAnonymousUsers: true,
    disableRemoteRoot: true,
    removeTestDb: true,
    configureHba: true,
    enableProtectedMode: true,
  },
  /** Configuration avancée (performance) */
  advanced: {
    performance: {
      maxConnections: 100,
      sharedBuffers: '256MB',
      innodbBufferPoolSize: '256M',
      maxMemory: '256mb',
      maxmemoryPolicy: 'allkeys-lru',
      wiredTigerCacheSizeGB: '1',
    },
  },
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT DE L'INSTALLATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Installation en cours ? */
const installing = ref(false)

/** Installation terminée avec succès ? */
const installComplete = ref(false)

/** Installation échouée ? */
const installFailed = ref(false)

/** Message d'erreur de l'installation */
const installError = ref('')

/** Connection string générée après installation */
const connectionString = ref('')

/** Étapes de l'installation avec leur statut */
const installationSteps = ref<InstallStep[]>([])

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPRIÉTÉS CALCULÉES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **selectedDatabaseName** - Nom complet du type de BDD sélectionné
 *
 * Utilisé pour l'affichage (ex: "PostgreSQL" au lieu de "postgresql")
 */
const selectedDatabaseName = computed(() => {
  const names: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL / MariaDB',
    redis: 'Redis',
    mongodb: 'MongoDB',
  }
  return names[config.value.databaseType] || ''
})

/**
 * **canProceed** - L'utilisateur peut-il passer à l'étape suivante ?
 *
 * Vérifie que les champs obligatoires de l'étape actuelle sont remplis.
 */
const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0:
      // Étape 1 : Un type doit être sélectionné
      return !!config.value.databaseType
    case 1:
      // Étape 2 : Un serveur doit être sélectionné
      return !!config.value.serverId
    case 2:
      // Étape 3 : Nom de BDD et username requis (sauf pour Redis)
      if (config.value.databaseType === 'redis') return true
      return !!config.value.basic.databaseName && !!config.value.basic.username
    default:
      // Les autres étapes n'ont pas de champs obligatoires
      return true
  }
})

/**
 * **userManuallyEditedUsername** - Indique si l'utilisateur a modifié manuellement le username
 *
 * Si false, on continue d'auto-remplir le username quand le nom de BDD change.
 * Si true, on ne touche plus au username car l'utilisateur l'a personnalisé.
 */
const userManuallyEditedUsername = ref(false)

/**
 * **Auto-remplissage du username**
 *
 * Quand l'utilisateur saisit un nom de base de données, on suggère
 * automatiquement un nom d'utilisateur basé sur ce nom (dbname_user).
 * Cela facilite la saisie et évite les oublis.
 *
 * On arrête d'auto-remplir dès que l'utilisateur modifie manuellement le username.
 */
watch(
  () => config.value.basic.databaseName,
  (newDbName) => {
    // Auto-remplir le username seulement si l'utilisateur ne l'a pas modifié manuellement
    if (newDbName && !userManuallyEditedUsername.value) {
      config.value.basic.username = `${newDbName}_user`
    }
  }
)

/**
 * **onUsernameManualInput()** - Appelé quand l'utilisateur modifie manuellement le username
 *
 * Marque que l'utilisateur a personnalisé le username, ce qui désactive
 * l'auto-remplissage basé sur le nom de la BDD.
 */
function onUsernameManualInput(value: string) {
  userManuallyEditedUsername.value = true
  config.value.basic.username = value
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTIONS DE NAVIGATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **nextStep()** - Passe à l'étape suivante
 */
function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

/**
 * **previousStep()** - Retourne à l'étape précédente
 */
function previousStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FONCTIONS UTILITAIRES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **getServerName()** - Retourne le nom du serveur sélectionné
 *
 * Affiche l'alias s'il existe, sinon le hostname, sinon l'IP.
 */
function getServerName(): string {
  const server = props.servers.find(s => s.id === config.value.serverId)
  return server ? (server.alias || server.hostname || server.ip) : ''
}

/**
 * **copyConnectionString()** - Copie la connection string dans le presse-papier
 */
function copyConnectionString() {
  navigator.clipboard.writeText(connectionString.value)
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTIONS D'INSTALLATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **startInstallation()** - Lance le processus d'installation
 *
 * Prépare les étapes d'installation et émet l'événement pour que
 * le parent lance l'installation via l'API.
 */
async function startInstallation() {
  installing.value = true

  // Initialise les 4 étapes de l'installation avec leur statut
  installationSteps.value = [
    { id: 'install', name: t('database.wizard.install.steps.installing'), status: 'running' },
    { id: 'security', name: t('database.wizard.install.steps.security'), status: 'pending' },
    { id: 'config', name: t('database.wizard.install.steps.configuring'), status: 'pending' },
    { id: 'start', name: t('database.wizard.install.steps.starting'), status: 'pending' },
  ]

  // Émet l'événement avec toute la configuration
  emit('configureDatabaseStack', config.value.serverId, {
    type: config.value.databaseType,
    databaseName: config.value.basic.databaseName || 'app_db',
    username: config.value.basic.username || `${config.value.basic.databaseName || 'app'}_user`,
    redisUsage: config.value.basic.redisUsage,
    security: config.value.security,
    advanced: config.value.advanced,
  })
}

/**
 * **updateStepStatus()** - Met à jour le statut d'une étape d'installation
 *
 * Utilisé pour suivre la progression en analysant les logs.
 * Ne met à jour que si l'étape n'est pas déjà complétée ou en erreur.
 *
 * @param stepId - L'ID de l'étape à mettre à jour
 * @param status - Le nouveau statut
 */
function updateStepStatus(stepId: string, status: 'pending' | 'running' | 'complete' | 'error') {
  const step = installationSteps.value.find(s => s.id === stepId)
  if (step && step.status !== 'complete' && step.status !== 'error') {
    step.status = status
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WATCHERS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Observe le résultat de l'installation (reçu via prop du parent).
 *
 * - Si succès : marque toutes les étapes comme complétées, affiche le résultat
 * - Si erreur : marque l'étape en cours comme erreur, arrête l'installation
 */
watch(() => props.installationResult, (result) => {
  if (result) {
    if (result.success) {
      // Succès : toutes les étapes sont complétées
      installationSteps.value.forEach(step => (step.status = 'complete'))
      installComplete.value = true
      installing.value = false // Arrêter l'état "installing" pour afficher le résultat
      if (result.connectionString) {
        connectionString.value = result.connectionString
      }
      // NE PAS émettre 'complete' ici - l'utilisateur doit d'abord voir la connection string
      // Le wizard sera fermé quand l'utilisateur clique sur "Terminer"
    } else {
      // Erreur : marque l'étape en cours comme erreur
      const runningStep = installationSteps.value.find(s => s.status === 'running')
      if (runningStep) {
        runningStep.status = 'error'
        runningStep.message = result.error
      }
      installing.value = false
      installFailed.value = true
      installError.value = result.error || 'Installation failed'
    }
  }
})

/**
 * Observe les logs d'installation pour mettre à jour automatiquement
 * le statut des étapes en fonction du contenu des logs.
 *
 * Cette logique analyse les derniers logs pour détecter les mots-clés
 * indiquant quelle étape est en cours.
 */
watch(() => props.installationLogs?.length, () => {
  if (props.installationLogs && props.installationLogs.length > 0) {
    // Analyse les 5 derniers logs
    const lastLogs = props.installationLogs.slice(-5)
    for (const log of lastLogs) {
      const msg = log.message

      // Détection de l'étape d'installation
      if (msg.includes('Installing') || msg.includes('apt-get install')) {
        updateStepStatus('install', 'running')
      }
      // Détection de l'étape de sécurité
      else if (msg.includes('Securing') || msg.includes('security')) {
        updateStepStatus('install', 'complete')
        updateStepStatus('security', 'running')
      }
      // Détection de l'étape de configuration
      else if (msg.includes('Configuring') || msg.includes('configuration')) {
        updateStepStatus('security', 'complete')
        updateStepStatus('config', 'running')
      }
      // Détection de l'étape de démarrage
      else if (msg.includes('Starting') || msg.includes('systemctl start')) {
        updateStepStatus('config', 'complete')
        updateStepStatus('start', 'running')
      }
      // Détection de la fin
      else if (msg.includes('successfully') || msg.includes('complete')) {
        updateStepStatus('start', 'complete')
      }
    }
  }
})
</script>
