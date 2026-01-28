<!--
  @file apps/dashboard/src/components/databases/DatabaseManagementWizard.vue
  @description Wizard de gestion des bases de données existantes.
  Ce composant permet de lister, gérer et modifier les bases de données
  déjà configurées sur un serveur : reset password, créer une nouvelle BDD,
  voir les infos de connexion.

  IMPORTANT: Aucune donnée n'est stockée sur le dashboard.
  Toutes les informations sont récupérées et stockées sur l'agent via JSON.

  @dependencies
  - Vue 3 : Framework frontend
  - Lucide Icons : Icônes pour l'interface

  @fonctions_principales
  - loadDatabaseInfo() : Charge les infos DB depuis l'agent
  - resetPassword() : Réinitialise le mot de passe d'une BDD
  - createDatabase() : Crée une nouvelle base de données
  - viewConnectionInfo() : Affiche les infos de connexion
-->
<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-emerald-600"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Settings class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">{{ t('database.management.title') }}</h2>
            <p class="text-sm text-white/80">{{ t('database.management.subtitle') }}</p>
          </div>
        </div>
        <button @click="$emit('close')" class="text-white/80 hover:text-white transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Server Selection (if not preselected) -->
      <div v-if="!selectedServer && !loading" class="p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">
          {{ t('database.management.selectServer') }}
        </h3>
        <div class="grid gap-3">
          <button
            v-for="server in availableServers"
            :key="server.id"
            @click="selectServer(server)"
            class="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
          >
            <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Server class="w-5 h-5 text-emerald-600" />
            </div>
            <div class="flex-1">
              <span class="font-medium text-slate-900">{{ server.alias || server.hostname }}</span>
              <p class="text-sm text-slate-500">{{ server.ip }}</p>
            </div>
            <ChevronRight class="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="flex-1 flex items-center justify-center p-12">
        <div class="text-center">
          <Loader2 class="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p class="text-slate-600">{{ t('database.management.loading') }}</p>
        </div>
      </div>

      <!-- Content -->
      <div v-else class="flex-1 overflow-y-auto p-6">
        <!-- Server Info Banner -->
        <div class="flex items-center justify-between mb-6 p-4 bg-slate-50 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Server class="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <span class="font-medium text-slate-900">{{ selectedServer?.alias || selectedServer?.hostname }}</span>
              <p class="text-sm text-slate-500">{{ selectedServer?.ip }}</p>
            </div>
          </div>
          <button
            @click="refreshDatabaseInfo"
            :disabled="refreshing"
            class="px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw :class="['w-4 h-4', { 'animate-spin': refreshing }]" />
            {{ t('common.refresh') }}
          </button>
        </div>

        <!-- No Databases -->
        <div v-if="databases.length === 0 && !loading" class="text-center py-12">
          <Database class="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h4 class="text-lg font-medium text-slate-900 mb-2">
            {{ t('database.management.noDatabases') }}
          </h4>
          <p class="text-sm text-slate-500 mb-6">{{ t('database.management.noDatabasesDesc') }}</p>
          <button
            @click="showCreateModal = true"
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Plus class="w-4 h-4" />
            {{ t('database.management.createFirst') }}
          </button>
        </div>

        <!-- Database List -->
        <div v-else class="space-y-4">
          <!-- Actions Bar -->
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              {{ t('database.management.installedDatabases') }}
            </h3>
            <button
              @click="showCreateModal = true"
              class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus class="w-4 h-4" />
              {{ t('database.management.createNew') }}
            </button>
          </div>

          <!-- Database Cards -->
          <div class="grid gap-4">
            <div
              v-for="db in databases"
              :key="db.type"
              class="border border-slate-200 rounded-xl overflow-hidden"
            >
              <!-- Database Header -->
              <div class="p-4 bg-slate-50 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    :class="[
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      getDatabaseColorClass(db.type),
                    ]"
                  >
                    <span class="text-sm font-bold">{{ getDatabaseIcon(db.type) }}</span>
                  </div>
                  <div>
                    <h4 class="font-semibold text-slate-900">{{ getDatabaseName(db.type) }}</h4>
                    <p class="text-xs text-slate-500">
                      {{ db.version || t('database.management.versionUnknown') }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'px-2 py-1 text-xs rounded-full',
                      db.running ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                    ]"
                  >
                    {{ db.running ? t('common.running') : t('common.stopped') }}
                  </span>
                </div>
              </div>

              <!-- Database Instances -->
              <div class="divide-y divide-slate-100">
                <div
                  v-for="instance in db.instances"
                  :key="instance.name"
                  class="p-4 flex items-center justify-between"
                >
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
                  <div class="flex items-center gap-2">
                    <button
                      @click="viewConnectionInfo(db.type, instance)"
                      class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      :title="t('database.management.viewConnection')"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    <button
                      @click="openResetPassword(db.type, instance)"
                      class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      :title="t('database.management.resetPassword')"
                    >
                      <Key class="w-4 h-4" />
                    </button>
                    <button
                      @click="openDeleteConfirm(db.type, instance)"
                      class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      :title="t('database.management.deleteDatabase')"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- No instances message -->
                <div v-if="db.instances.length === 0" class="p-4 text-center text-sm text-slate-500">
                  {{ t('database.management.noInstances') }}
                  <button
                    @click="openCreateDatabase(db.type)"
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

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
        <button
          @click="$emit('close')"
          class="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </div>

    <!-- Connection Info Modal -->
    <div
      v-if="connectionModal.visible"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div class="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">{{ t('database.management.connectionInfo') }}</h3>
          <button @click="connectionModal.visible = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 space-y-4">
          <!-- Connection String -->
          <div>
            <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.connectionString') }}</label>
            <div class="flex items-center gap-2">
              <code class="flex-1 p-2 bg-slate-100 rounded text-sm text-slate-700 break-all">
                {{ connectionModal.connectionString }}
              </code>
              <button
                @click="copyToClipboard(connectionModal.connectionString)"
                class="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                <Copy class="w-4 h-4" />
              </button>
            </div>
          </div>
          <!-- Details -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.host') }}</label>
              <span class="text-slate-900">localhost</span>
            </div>
            <div>
              <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.port') }}</label>
              <span class="text-slate-900">{{ connectionModal.port }}</span>
            </div>
            <div>
              <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.database') }}</label>
              <span class="text-slate-900">{{ connectionModal.database }}</span>
            </div>
            <div>
              <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.username') }}</label>
              <span class="text-slate-900">{{ connectionModal.username }}</span>
            </div>
          </div>
          <!-- Warning -->
          <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p class="text-sm text-amber-700">{{ t('database.management.connectionWarning') }}</p>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-slate-200 flex justify-end">
          <button
            @click="connectionModal.visible = false"
            class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reset Password Modal -->
    <div
      v-if="resetPasswordModal.visible"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div class="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">{{ t('database.management.resetPasswordTitle') }}</h3>
          <button @click="resetPasswordModal.visible = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 space-y-4">
          <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', getDatabaseColorClass(resetPasswordModal.dbType)]">
              <span class="text-xs font-bold">{{ getDatabaseIcon(resetPasswordModal.dbType) }}</span>
            </div>
            <div>
              <span class="font-medium text-slate-900">{{ resetPasswordModal.instance?.name }}</span>
              <p class="text-xs text-slate-500">{{ getDatabaseName(resetPasswordModal.dbType) }}</p>
            </div>
          </div>

          <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p class="text-sm text-amber-700">{{ t('database.management.resetPasswordWarning') }}</p>
            </div>
          </div>

          <!-- New Password Preview (optional manual password) -->
          <div>
            <label class="flex items-center gap-2 mb-2">
              <input type="checkbox" v-model="resetPasswordModal.useCustomPassword" class="rounded text-emerald-500" />
              <span class="text-sm text-slate-700">{{ t('database.management.useCustomPassword') }}</span>
            </label>
            <input
              v-if="resetPasswordModal.useCustomPassword"
              v-model="resetPasswordModal.customPassword"
              type="text"
              :placeholder="t('database.management.enterPassword')"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
        <div class="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            @click="resetPasswordModal.visible = false"
            class="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="executeResetPassword"
            :disabled="resetPasswordModal.loading"
            class="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Loader2 v-if="resetPasswordModal.loading" class="w-4 h-4 animate-spin" />
            <Key v-else class="w-4 h-4" />
            {{ t('database.management.resetPassword') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Database Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div class="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">{{ t('database.management.createNewDatabase') }}</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 space-y-4">
          <!-- Database Type Selection -->
          <div>
            <label class="text-sm font-medium text-slate-700 block mb-2">{{ t('database.management.selectType') }}</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="type in availableDbTypes"
                :key="type.id"
                @click="createModal.dbType = type.id"
                :class="[
                  'p-3 border rounded-lg text-left transition-all',
                  createModal.dbType === type.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300',
                ]"
              >
                <div class="flex items-center gap-2">
                  <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', type.colorClass]">
                    <span class="text-xs font-bold">{{ type.icon }}</span>
                  </div>
                  <span class="font-medium text-slate-900 text-sm">{{ type.name }}</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Database Name -->
          <div v-if="createModal.dbType !== 'redis'">
            <label class="text-sm font-medium text-slate-700 block mb-1">{{ t('database.management.databaseName') }}</label>
            <input
              v-model="createModal.databaseName"
              type="text"
              placeholder="my_database"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <!-- Username -->
          <div v-if="createModal.dbType !== 'redis'">
            <label class="text-sm font-medium text-slate-700 block mb-1">{{ t('database.management.username') }}</label>
            <input
              v-model="createModal.username"
              type="text"
              :placeholder="createModal.databaseName ? `${createModal.databaseName}_user` : 'db_user'"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <!-- Info -->
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div class="flex items-start gap-2">
              <Lock class="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p class="text-sm text-emerald-700">{{ t('database.management.passwordAutoGenerated') }}</p>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            @click="showCreateModal = false"
            class="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="executeCreateDatabase"
            :disabled="createModal.loading || !isCreateFormValid"
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Loader2 v-if="createModal.loading" class="w-4 h-4 animate-spin" />
            <Plus v-else class="w-4 h-4" />
            {{ t('database.management.create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- New Password Result Modal -->
    <div
      v-if="newPasswordModal.visible"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div class="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="font-semibold text-green-700 flex items-center gap-2">
            <CheckCircle2 class="w-5 h-5" />
            {{ t('database.management.passwordResetSuccess') }}
          </h3>
          <button @click="newPasswordModal.visible = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-4 space-y-4">
          <div class="p-4 bg-slate-100 rounded-lg">
            <label class="text-sm text-slate-500 block mb-1">{{ t('database.management.newPassword') }}</label>
            <div class="flex items-center gap-2">
              <code class="flex-1 p-2 bg-white rounded text-lg font-mono text-slate-900 select-all">
                {{ newPasswordModal.password }}
              </code>
              <button
                @click="copyToClipboard(newPasswordModal.password)"
                class="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                <Copy class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p class="text-sm text-red-700">{{ t('database.management.savePasswordWarning') }}</p>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-slate-200 flex justify-end">
          <button
            @click="newPasswordModal.visible = false"
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            {{ t('database.management.understood') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Settings,
  X,
  Server,
  Database,
  ChevronRight,
  Loader2,
  RefreshCw,
  Plus,
  HardDrive,
  Eye,
  Key,
  Trash2,
  Copy,
  AlertTriangle,
  Lock,
  CheckCircle2,
} from 'lucide-vue-next';

const { t } = useI18n();

interface DatabaseInstance {
  name: string;
  user?: string;
  createdAt?: string;
}

interface DatabaseInfo {
  type: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  version?: string;
  running: boolean;
  instances: DatabaseInstance[];
}

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'getDatabaseInfo', serverId: string): void;
  (e: 'resetDatabasePassword', serverId: string, dbType: string, dbName: string, customPassword?: string): void;
  (e: 'createDatabase', serverId: string, dbType: string, dbName: string, username: string): void;
}>();

const props = defineProps<{
  servers: Array<{
    id: string;
    hostname: string;
    ip: string;
    alias?: string;
    online: boolean;
  }>;
  preselectedServerId?: string;
  databaseInfo?: DatabaseInfo[];
  operationResult?: {
    success: boolean;
    operation: 'reset_password' | 'create_database';
    connectionString?: string;
    password?: string;
    error?: string;
  } | null;
}>();

// State
const loading = ref(false);
const refreshing = ref(false);
const selectedServer = ref<typeof props.servers[0] | null>(null);
const databases = ref<DatabaseInfo[]>([]);
const showCreateModal = ref(false);

// Connection Info Modal
const connectionModal = ref({
  visible: false,
  connectionString: '',
  port: '',
  database: '',
  username: '',
});

// Reset Password Modal
const resetPasswordModal = ref({
  visible: false,
  loading: false,
  dbType: '' as string,
  instance: null as DatabaseInstance | null,
  useCustomPassword: false,
  customPassword: '',
});

// Create Database Modal
const createModal = ref({
  loading: false,
  dbType: 'postgresql' as 'postgresql' | 'mysql' | 'redis' | 'mongodb',
  databaseName: '',
  username: '',
});

// New Password Result Modal
const newPasswordModal = ref({
  visible: false,
  password: '',
});

// Computed
const availableServers = computed(() => props.servers.filter((s) => s.online));

const availableDbTypes = computed(() => [
  { id: 'postgresql', name: 'PostgreSQL', icon: 'PG', colorClass: 'bg-blue-100 text-blue-600' },
  { id: 'mysql', name: 'MySQL / MariaDB', icon: 'My', colorClass: 'bg-orange-100 text-orange-600' },
  { id: 'redis', name: 'Redis', icon: 'Rd', colorClass: 'bg-red-100 text-red-600' },
]);

const isCreateFormValid = computed(() => {
  if (createModal.value.dbType === 'redis') return true;
  return createModal.value.databaseName.trim().length > 0;
});

// Methods
function selectServer(server: typeof props.servers[0]) {
  selectedServer.value = server;
  loadDatabaseInfo();
}

function loadDatabaseInfo() {
  if (!selectedServer.value) return;
  loading.value = true;
  emit('getDatabaseInfo', selectedServer.value.id);
}

function refreshDatabaseInfo() {
  if (!selectedServer.value) return;
  refreshing.value = true;
  emit('getDatabaseInfo', selectedServer.value.id);
}

function getDatabaseColorClass(type: string): string {
  const colors: Record<string, string> = {
    postgresql: 'bg-blue-100 text-blue-600',
    mysql: 'bg-orange-100 text-orange-600',
    redis: 'bg-red-100 text-red-600',
    mongodb: 'bg-green-100 text-green-600',
  };
  return colors[type] || 'bg-slate-100 text-slate-600';
}

function getDatabaseIcon(type: string): string {
  const icons: Record<string, string> = {
    postgresql: 'PG',
    mysql: 'My',
    redis: 'Rd',
    mongodb: 'Mg',
  };
  return icons[type] || 'DB';
}

function getDatabaseName(type: string): string {
  const names: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL / MariaDB',
    redis: 'Redis',
    mongodb: 'MongoDB',
  };
  return names[type] || type;
}

function viewConnectionInfo(dbType: string, instance: DatabaseInstance) {
  const ports: Record<string, string> = {
    postgresql: '5432',
    mysql: '3306',
    redis: '6379',
    mongodb: '27017',
  };

  connectionModal.value = {
    visible: true,
    connectionString: generateConnectionString(dbType, instance),
    port: ports[dbType] || '0',
    database: instance.name,
    username: instance.user || '',
  };
}

function generateConnectionString(dbType: string, instance: DatabaseInstance): string {
  const user = instance.user || 'root';
  switch (dbType) {
    case 'postgresql':
      return `postgresql://${user}:***@localhost:5432/${instance.name}`;
    case 'mysql':
      return `mysql://${user}:***@localhost:3306/${instance.name}`;
    case 'redis':
      return `redis://:***@localhost:6379/0`;
    case 'mongodb':
      return `mongodb://${user}:***@localhost:27017/${instance.name}`;
    default:
      return '';
  }
}

function openResetPassword(dbType: string, instance: DatabaseInstance) {
  resetPasswordModal.value = {
    visible: true,
    loading: false,
    dbType,
    instance,
    useCustomPassword: false,
    customPassword: '',
  };
}

function executeResetPassword() {
  if (!selectedServer.value || !resetPasswordModal.value.instance) return;

  resetPasswordModal.value.loading = true;
  const customPwd = resetPasswordModal.value.useCustomPassword
    ? resetPasswordModal.value.customPassword
    : undefined;

  emit(
    'resetDatabasePassword',
    selectedServer.value.id,
    resetPasswordModal.value.dbType,
    resetPasswordModal.value.instance.name,
    customPwd,
  );
}

function openCreateDatabase(dbType?: string) {
  createModal.value = {
    loading: false,
    dbType: (dbType as any) || 'postgresql',
    databaseName: '',
    username: '',
  };
  showCreateModal.value = true;
}

function executeCreateDatabase() {
  if (!selectedServer.value) return;

  createModal.value.loading = true;
  const username = createModal.value.username || `${createModal.value.databaseName}_user`;

  emit(
    'createDatabase',
    selectedServer.value.id,
    createModal.value.dbType,
    createModal.value.databaseName,
    username,
  );
}

function openDeleteConfirm(_dbType: string, _instance: DatabaseInstance) {
  // TODO: Implement delete confirmation
  alert('Delete functionality coming soon');
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// Watch for database info updates
watch(
  () => props.databaseInfo,
  (info) => {
    if (info) {
      databases.value = info;
      loading.value = false;
      refreshing.value = false;
    }
  },
);

// Watch for operation results
watch(
  () => props.operationResult,
  (result) => {
    if (result) {
      if (result.operation === 'reset_password') {
        resetPasswordModal.value.loading = false;
        resetPasswordModal.value.visible = false;

        if (result.success && result.password) {
          newPasswordModal.value = {
            visible: true,
            password: result.password,
          };
          // Refresh database info
          refreshDatabaseInfo();
        }
      } else if (result.operation === 'create_database') {
        createModal.value.loading = false;
        showCreateModal.value = false;

        if (result.success && result.password) {
          newPasswordModal.value = {
            visible: true,
            password: result.password,
          };
          // Refresh database info
          refreshDatabaseInfo();
        }
      }
    }
  },
);

// Initialize
onMounted(() => {
  if (props.preselectedServerId) {
    const server = props.servers.find((s) => s.id === props.preselectedServerId);
    if (server) {
      selectServer(server);
    }
  }
});
</script>
