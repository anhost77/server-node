<!--
  @file apps/dashboard/src/components/databases/DatabaseManagementWizard.vue

  @description Wizard de gestion des bases de données EXISTANTES.

  Ce composant est un modal plein écran qui permet de gérer les bases de
  données déjà installées sur les serveurs. Il est différent du
  DatabaseServerWizard qui est pour l'INSTALLATION de nouvelles BDD.

  Fonctionnalités principales :
  1. Sélectionner un serveur pour voir ses BDD
  2. Voir les informations de connexion (host, port, user...)
  3. Réinitialiser le mot de passe d'une BDD
  4. Créer une nouvelle BDD (sur un serveur où le type est déjà installé)
  5. Supprimer une BDD (à venir)

  Architecture du composant :
  - Ce fichier est le CONTENEUR principal (orchestrateur)
  - La logique d'affichage est déléguée aux sous-composants dans management/
  - Les modals sont aussi des sous-composants séparés

  @dependencies
  - Vue 3 : Framework frontend avec ref, watch, onMounted
  - vue-i18n : Traductions
  - Lucide Icons : Settings, X, Loader2

  @composants_enfants
  - ServerSelect : Sélection du serveur
  - DatabaseList : Liste des BDD avec actions
  - ConnectionModal : Affiche les infos de connexion
  - ResetPasswordModal : Confirmation reset password
  - CreateModal : Création d'une nouvelle BDD
  - NewPasswordModal : Affiche le nouveau password après reset/création

  @fonctions_principales
  - selectServer() : Sélectionne un serveur et charge ses BDD
  - viewConnectionInfo() : Ouvre le modal de connexion
  - executeResetPassword() : Lance le reset de mot de passe
  - executeCreateDatabase() : Lance la création de BDD
-->
<template>
  <!--
    ═══════════════════════════════════════════════════════════════════════════
    OVERLAY DU MODAL
    ═══════════════════════════════════════════════════════════════════════════
    Fond noir semi-transparent qui recouvre toute la page.
    Le modal est centré au milieu de l'écran.
  -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!--
        ═══════════════════════════════════════════════════════════════════════════
        EN-TÊTE DU MODAL
        ═══════════════════════════════════════════════════════════════════════════
        Bandeau vert avec le titre et le bouton de fermeture.
        Couleur emerald pour différencier du wizard d'installation (bleu).
      -->
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-emerald-600">
        <div class="flex items-center gap-3">
          <!-- Icône dans un cercle semi-transparent -->
          <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Settings class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">{{ t('database.management.title') }}</h2>
            <p class="text-sm text-white/80">{{ t('database.management.subtitle') }}</p>
          </div>
        </div>
        <!-- Bouton fermer (X) -->
        <button @click="$emit('close')" class="text-white/80 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        CONTENU PRINCIPAL (CONDITIONNEL)
        ═══════════════════════════════════════════════════════════════════════════
        Affiche différents contenus selon l'état :
        1. ServerSelect : Si aucun serveur n'est sélectionné
        2. Loader : Pendant le chargement des BDD
        3. DatabaseList : Une fois les BDD chargées
      -->

      <!--
        ÉTAPE 1 : SÉLECTION DU SERVEUR
        Affiché quand aucun serveur n'est encore sélectionné et qu'on n'est pas
        en train de charger.
      -->
      <ServerSelect
        v-if="!selectedServer && !loading"
        :servers="servers"
        @select="selectServer"
      />

      <!--
        ÉTAT DE CHARGEMENT
        Spinner centré pendant qu'on récupère les infos des BDD du serveur.
      -->
      <div v-else-if="loading" class="flex-1 flex items-center justify-center p-12">
        <div class="text-center">
          <Loader2 class="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p class="text-slate-600">{{ t('database.management.loading') }}</p>
        </div>
      </div>

      <!--
        LISTE DES BASES DE DONNÉES
        Affiche toutes les BDD du serveur sélectionné avec les actions possibles.
      -->
      <DatabaseList
        v-else
        :server="selectedServer!"
        :databases="databases"
        :refreshing="refreshing"
        @refresh="refreshDatabaseInfo"
        @create="showCreateModal = true"
        @createForType="openCreateDatabase"
        @viewConnection="viewConnectionInfo"
        @resetPassword="openResetPassword"
        @delete="openDeleteConfirm"
      />

      <!--
        ═══════════════════════════════════════════════════════════════════════════
        PIED DE PAGE
        ═══════════════════════════════════════════════════════════════════════════
        Bouton pour fermer le modal.
      -->
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
        <button
          @click="$emit('close')"
          class="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </div>

    <!--
      ═══════════════════════════════════════════════════════════════════════════
      MODALS SECONDAIRES
      ═══════════════════════════════════════════════════════════════════════════
      Ces modals s'affichent PAR-DESSUS le modal principal quand l'utilisateur
      effectue une action spécifique.
    -->

    <!--
      MODAL : INFORMATIONS DE CONNEXION
      Affiche l'URL de connexion, host, port, user...
    -->
    <ConnectionModal
      v-if="connectionModal.visible"
      :connectionString="connectionModal.connectionString"
      :port="connectionModal.port"
      :database="connectionModal.database"
      :username="connectionModal.username"
      @close="connectionModal.visible = false"
      @copy="copyToClipboard"
    />

    <!--
      MODAL : RÉINITIALISATION DU MOT DE PASSE
      Demande confirmation avant de reset le password.
    -->
    <ResetPasswordModal
      v-if="resetPasswordModal.visible"
      :dbType="resetPasswordModal.dbType"
      :instance="resetPasswordModal.instance"
      :loading="resetPasswordModal.loading"
      @close="resetPasswordModal.visible = false"
      @confirm="executeResetPassword"
    />

    <!--
      MODAL : CRÉATION DE BASE DE DONNÉES
      Formulaire pour créer une nouvelle BDD.
    -->
    <CreateModal
      v-if="showCreateModal"
      :loading="createModal.loading"
      :preselectedType="createModal.dbType"
      @close="showCreateModal = false"
      @create="executeCreateDatabase"
    />

    <!--
      MODAL : NOUVEAU MOT DE PASSE
      Affiche le mot de passe généré après un reset ou une création.
      IMPORTANT : Ce mot de passe ne sera plus jamais affiché !
    -->
    <NewPasswordModal
      v-if="newPasswordModal.visible"
      :password="newPasswordModal.password"
      @close="newPasswordModal.visible = false"
      @copy="copyToClipboard"
    />

    <!--
      MODAL : PROGRESSION DE L'OPÉRATION
      Affiche les logs en temps réel pendant une opération (création, reset...).
      C'est comme une console/terminal qui montre ce qui se passe sur le serveur.
      Utile pour débugger si quelque chose ne fonctionne pas.
    -->
    <OperationProgressModal
      v-if="operationProgressModal.visible"
      :title="operationProgressModal.title"
      :subtitle="operationProgressModal.subtitle"
      :logs="infrastructureLogs || []"
      :result="operationResult || null"
      :loading="operationProgressModal.loading"
      @close="closeOperationProgress"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, X, Loader2 } from 'lucide-vue-next'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IMPORTS DES COMPOSANTS ENFANTS
 * ═══════════════════════════════════════════════════════════════════════════
 * Chaque composant gère une partie spécifique de l'interface.
 * Cela permet de garder ce fichier léger et maintenable.
 */
import ServerSelect from './management/ServerSelect.vue'
import DatabaseList from './management/DatabaseList.vue'
import ConnectionModal from './management/ConnectionModal.vue'
import ResetPasswordModal from './management/ResetPasswordModal.vue'
import CreateModal from './management/CreateModal.vue'
import NewPasswordModal from './management/NewPasswordModal.vue'
import OperationProgressModal from './management/OperationProgressModal.vue'

const { t } = useI18n()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **DatabaseInstance** - Une base de données individuelle
 *
 * Représente une BDD spécifique sur un serveur.
 * Ex: "wordpress_db" sur PostgreSQL.
 */
interface DatabaseInstance {
  /** Nom de la base de données */
  name: string
  /** Utilisateur propriétaire (optionnel) */
  user?: string
  /** Date de création (optionnel) */
  createdAt?: string
}

/**
 * **DatabaseInfo** - Informations sur un type de BDD installé
 *
 * Regroupe toutes les instances d'un même type.
 * Ex: PostgreSQL version 15 avec 3 bases de données.
 */
interface DatabaseInfo {
  /** Type de BDD : postgresql, mysql, redis, mongodb */
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb'
  /** Version installée (ex: "15.2") */
  version?: string
  /** Le service est-il en cours d'exécution ? */
  running: boolean
  /** Liste des bases de données de ce type */
  instances: DatabaseInstance[]
}

/**
 * **ServerInfo** - Informations sur un serveur
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
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉVÉNEMENTS ÉMIS
 * ═══════════════════════════════════════════════════════════════════════════
 * Ces événements sont envoyés au composant parent pour qu'il
 * effectue les actions côté API.
 */
const emit = defineEmits<{
  /** Fermer le modal */
  close: []
  /** Demander les infos BDD d'un serveur */
  getDatabaseInfo: [serverId: string]
  /** Réinitialiser le mot de passe d'une BDD (mot de passe auto-généré) */
  resetDatabasePassword: [serverId: string, dbType: string, dbName: string]
  /** Créer une nouvelle BDD */
  createDatabase: [serverId: string, dbType: string, dbName: string, username: string]
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPS
 * ═══════════════════════════════════════════════════════════════════════════
 */
const props = defineProps<{
  /** Liste des serveurs disponibles */
  servers: ServerInfo[]
  /** ID du serveur présélectionné (optionnel) */
  preselectedServerId?: string
  /** Infos BDD reçues du serveur (via l'API) */
  databaseInfo?: DatabaseInfo[]
  /**
   * Résultat d'une opération (reset password ou création).
   * Le parent met à jour cette prop après l'appel API.
   */
  operationResult?: {
    success: boolean
    operation: 'reset_password' | 'create_database'
    connectionString?: string
    password?: string
    error?: string
  } | null
  /**
   * Logs d'infrastructure reçus en temps réel via WebSocket.
   * Ces logs permettent de voir ce qui se passe sur le serveur
   * pendant une opération (création de BDD, reset password...).
   */
  infrastructureLogs?: Array<{ message: string; stream: 'stdout' | 'stderr' }>
}>()

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT LOCAL
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Chargement initial des BDD en cours ? */
const loading = ref(false)

/** Rafraîchissement des BDD en cours ? */
const refreshing = ref(false)

/** Serveur actuellement sélectionné */
const selectedServer = ref<ServerInfo | null>(null)

/** Liste des BDD du serveur sélectionné */
const databases = ref<DatabaseInfo[]>([])

/** Afficher le modal de création ? */
const showCreateModal = ref(false)

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ÉTAT DES MODALS
 * ═══════════════════════════════════════════════════════════════════════════
 * Chaque modal a son propre objet d'état avec toutes les données nécessaires.
 */

/** État du modal d'informations de connexion */
const connectionModal = ref({
  visible: false,
  connectionString: '',
  port: '',
  database: '',
  username: '',
})

/** État du modal de réinitialisation de mot de passe */
const resetPasswordModal = ref({
  visible: false,
  loading: false,
  dbType: '',
  instance: null as DatabaseInstance | null,
})

/** État du modal de création */
const createModal = ref({
  loading: false,
  dbType: 'postgresql',
})

/** État du modal d'affichage du nouveau mot de passe */
const newPasswordModal = ref({
  visible: false,
  password: '',
})

/**
 * État du modal de progression des opérations.
 *
 * Ce modal s'affiche pendant qu'une opération est en cours (création de BDD,
 * reset password...) et montre les logs en temps réel comme une console.
 * C'est utile pour débugger et voir ce qui se passe sur le serveur.
 */
const operationProgressModal = ref({
  /** Afficher le modal ? */
  visible: false,
  /** Titre de l'opération (ex: "Création de base de données") */
  title: '',
  /** Sous-titre (ex: nom de la BDD) */
  subtitle: '',
  /** Type d'opération en cours */
  operation: '' as 'reset_password' | 'create_database' | '',
  /** Opération en cours ? */
  loading: false,
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * **selectServer()** - Sélectionne un serveur et charge ses BDD
 *
 * Appelé quand l'utilisateur clique sur un serveur dans la liste.
 * Déclenche le chargement des informations BDD.
 *
 * @param server - Le serveur sélectionné
 */
function selectServer(server: ServerInfo) {
  selectedServer.value = server
  loadDatabaseInfo()
}

/**
 * **loadDatabaseInfo()** - Charge les informations BDD du serveur
 *
 * Émet un événement pour que le parent récupère les infos via l'API.
 * Affiche un spinner pendant le chargement.
 */
function loadDatabaseInfo() {
  if (!selectedServer.value) return
  loading.value = true
  emit('getDatabaseInfo', selectedServer.value.id)
}

/**
 * **refreshDatabaseInfo()** - Rafraîchit la liste des BDD
 *
 * Même chose que loadDatabaseInfo mais avec un indicateur différent
 * (refreshing au lieu de loading) pour l'UX.
 */
function refreshDatabaseInfo() {
  if (!selectedServer.value) return
  refreshing.value = true
  emit('getDatabaseInfo', selectedServer.value.id)
}

/**
 * **generateConnectionString()** - Génère l'URL de connexion à une BDD
 *
 * Crée une URL au format standard pour se connecter à la base de données.
 * Le mot de passe est remplacé par *** car on ne le connaît pas.
 *
 * @param dbType - Type de BDD (postgresql, mysql, redis, mongodb)
 * @param instance - L'instance de BDD
 * @returns L'URL de connexion (ex: postgresql://user:***@localhost:5432/dbname)
 */
function generateConnectionString(dbType: string, instance: DatabaseInstance): string {
  const user = instance.user || 'root'
  switch (dbType) {
    case 'postgresql':
      return `postgresql://${user}:***@localhost:5432/${instance.name}`
    case 'mysql':
      return `mysql://${user}:***@localhost:3306/${instance.name}`
    case 'redis':
      return `redis://:***@localhost:6379/0`
    case 'mongodb':
      return `mongodb://${user}:***@localhost:27017/${instance.name}`
    default:
      return ''
  }
}

/**
 * **viewConnectionInfo()** - Ouvre le modal d'informations de connexion
 *
 * Prépare les données et affiche le modal avec les infos de connexion.
 *
 * @param dbType - Type de BDD
 * @param instance - L'instance de BDD
 */
function viewConnectionInfo(dbType: string, instance: DatabaseInstance) {
  // Ports par défaut de chaque type de BDD
  const ports: Record<string, string> = {
    postgresql: '5432',
    mysql: '3306',
    redis: '6379',
    mongodb: '27017',
  }
  connectionModal.value = {
    visible: true,
    connectionString: generateConnectionString(dbType, instance),
    port: ports[dbType] || '0',
    database: instance.name,
    username: instance.user || '',
  }
}

/**
 * **openResetPassword()** - Ouvre le modal de reset password
 *
 * @param dbType - Type de BDD
 * @param instance - L'instance concernée
 */
function openResetPassword(dbType: string, instance: DatabaseInstance) {
  resetPasswordModal.value = {
    visible: true,
    loading: false,
    dbType,
    instance,
  }
}

/**
 * **executeResetPassword()** - Lance la réinitialisation du mot de passe
 *
 * Appelé quand l'utilisateur confirme dans le modal de reset.
 * Ferme le modal de confirmation et ouvre le modal de progression
 * qui montre les logs en temps réel.
 *
 * Le mot de passe est TOUJOURS généré automatiquement côté serveur.
 */
function executeResetPassword() {
  if (!selectedServer.value || !resetPasswordModal.value.instance) return

  // Fermer le modal de confirmation
  resetPasswordModal.value.visible = false

  // Ouvrir le modal de progression avec les logs
  operationProgressModal.value = {
    visible: true,
    title: 'Réinitialisation du mot de passe',
    subtitle: resetPasswordModal.value.instance.name,
    operation: 'reset_password',
    loading: true,
  }

  // Émettre l'événement pour lancer l'opération (mot de passe auto-généré)
  emit(
    'resetDatabasePassword',
    selectedServer.value.id,
    resetPasswordModal.value.dbType,
    resetPasswordModal.value.instance.name,
  )
}

/**
 * **openCreateDatabase()** - Ouvre le modal de création de BDD
 *
 * @param dbType - Type de BDD présélectionné (optionnel)
 */
function openCreateDatabase(dbType?: string) {
  createModal.value = {
    loading: false,
    dbType: dbType || 'postgresql',
  }
  showCreateModal.value = true
}

/**
 * **executeCreateDatabase()** - Lance la création d'une BDD
 *
 * Appelé quand l'utilisateur valide le formulaire de création.
 * Ferme le modal de création et ouvre le modal de progression
 * qui montre les logs en temps réel.
 *
 * @param dbType - Type de BDD
 * @param databaseName - Nom de la nouvelle BDD
 * @param username - Nom de l'utilisateur à créer
 */
function executeCreateDatabase(dbType: string, databaseName: string, username: string) {
  if (!selectedServer.value) return

  // Fermer le modal de création
  showCreateModal.value = false

  // Ouvrir le modal de progression avec les logs
  operationProgressModal.value = {
    visible: true,
    title: 'Création de la base de données',
    subtitle: `${databaseName} (${dbType})`,
    operation: 'create_database',
    loading: true,
  }

  // Émettre l'événement pour lancer l'opération
  emit('createDatabase', selectedServer.value.id, dbType, databaseName, username)
}

/**
 * **openDeleteConfirm()** - Ouvre la confirmation de suppression
 *
 * Fonctionnalité à venir - affiche juste un message pour l'instant.
 */
function openDeleteConfirm(_dbType: string, _instance: DatabaseInstance) {
  alert('Delete functionality coming soon')
}

/**
 * **copyToClipboard()** - Copie un texte dans le presse-papier
 *
 * Utilisé par les modals pour copier les URLs de connexion ou passwords.
 *
 * @param text - Le texte à copier
 */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

/**
 * **closeOperationProgress()** - Ferme le modal de progression
 *
 * Appelé quand l'utilisateur a fini de consulter le résultat de l'opération.
 * Réinitialise l'état du modal pour la prochaine opération.
 */
function closeOperationProgress() {
  operationProgressModal.value = {
    visible: false,
    title: '',
    subtitle: '',
    operation: '',
    loading: false,
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WATCHERS
 * ═══════════════════════════════════════════════════════════════════════════
 * Les watchers observent les changements des props et réagissent en conséquence.
 */

/**
 * Quand les infos BDD sont reçues du parent (après appel API),
 * on met à jour l'état local et on arrête les indicateurs de chargement.
 */
watch(() => props.databaseInfo, (info) => {
  if (info) {
    databases.value = info
    loading.value = false
    refreshing.value = false
  }
})

/**
 * Quand le résultat d'une opération est reçu, on met à jour le modal de progression.
 *
 * Le modal de progression reste ouvert et affiche :
 * - Le spinner disparaît (loading = false)
 * - Le résultat (succès avec mot de passe, ou erreur)
 * - Les logs restent visibles pour le debug
 *
 * L'utilisateur ferme le modal quand il a fini de consulter le résultat.
 */
watch(() => props.operationResult, (result) => {
  if (result && operationProgressModal.value.visible) {
    // Arrêter le spinner
    operationProgressModal.value.loading = false

    // Si succès, rafraîchir la liste des BDD
    if (result.success) {
      refreshDatabaseInfo()
    }
  }
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INITIALISATION
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Au montage du composant, si un serveur est présélectionné (via prop),
 * on le sélectionne automatiquement.
 */
onMounted(() => {
  if (props.preselectedServerId) {
    const server = props.servers.find(s => s.id === props.preselectedServerId)
    if (server) selectServer(server)
  }
})
</script>
