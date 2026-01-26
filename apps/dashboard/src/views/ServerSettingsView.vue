<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Runtime {
  type: string
  installed: boolean
  version?: string
  latestVersion?: string
  updateAvailable?: boolean
  estimatedSize: string
}

interface Database {
  type: string
  installed: boolean
  running: boolean
  version?: string
}

interface InfraStatus {
  runtimes: Runtime[]
  databases: Database[]
  system: {
    os: string
    osVersion: string
    cpu: number
    ram: string
    disk: string
    uptime: string
  }
}

interface InfraLog {
  message: string
  stream: 'stdout' | 'stderr'
}

interface Props {
  server: {
    id: string
    alias?: string
    hostname?: string
    status: string
  }
  infraStatus: InfraStatus | null
  infraStatusLoading: boolean
  installingRuntime: string | null
  updatingRuntime: string | null
  removingRuntime: string | null
  configuringDatabase: string | null
  reconfiguringDatabase: string | null
  removingDatabase: string | null
  infrastructureLogs: InfraLog[]
  fetchingRemoteLogs: boolean
  remoteLogFilePath: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  back: []
  refresh: []
  installRuntime: [runtime: string]
  updateRuntime: [runtime: string]
  removeRuntime: [runtime: string]
  openDbConfigModal: [dbType: 'postgresql' | 'mysql' | 'redis']
  configureDatabase: [dbType: string, dbName: string, securityOptions: any]
  reconfigureDatabase: [dbType: string, dbName: string]
  removeDatabase: [dbType: string]
  fetchServiceLogs: [service: string]
  fetchRemoteLogs: []
  clearRemoteLogs: []
  clearInfraLogs: []
  copyInfraLogs: []
}>()

const serverName = computed(() => props.server.alias || props.server.hostname || props.server.id.slice(0, 8))

// Runtime helpers
const runtimes = [
  { type: 'nodejs', name: 'Node.js', icon: '🟢', size: 'Pre-installed', canRemove: false },
  { type: 'python', name: 'Python', icon: '🐍', size: '~200MB', canRemove: false },
  { type: 'go', name: 'Go', icon: '🔵', size: '~500MB', canRemove: true },
  { type: 'docker', name: 'Docker', icon: '🐳', size: '~500MB', canRemove: true },
  { type: 'rust', name: 'Rust', icon: '🦀', size: '~1GB', canRemove: true },
  { type: 'ruby', name: 'Ruby', icon: '💎', size: '~300MB', canRemove: true }
]

const databases = [
  { type: 'postgresql', name: 'PostgreSQL', icon: '🐘' },
  { type: 'mysql', name: 'MySQL', icon: '🐬' },
  { type: 'redis', name: 'Redis', icon: '⚡' }
]

function getRuntime(type: string) {
  return props.infraStatus?.runtimes.find(r => r.type === type)
}

function getDatabase(type: string) {
  return props.infraStatus?.databases.find(d => d.type === type)
}

// Local modal state
const showDbConfigModal = ref(false)
const dbConfigType = ref<'postgresql' | 'mysql' | 'redis'>('postgresql')
const dbConfigName = ref('')
const dbSecurityOptions = ref({
  setRootPassword: true,
  removeAnonymousUsers: true,
  disallowRootRemote: true,
  removeTestDb: true,
  configureHba: true,
  enableProtectedMode: true,
  bindLocalhost: true
})

const showRemoveRuntimeModal = ref(false)
const runtimeToRemove = ref<string | null>(null)

const showRemoveDatabaseModal = ref(false)
const databaseToRemove = ref<string | null>(null)

const showReconfigureDatabaseModal = ref(false)
const reconfigureDbType = ref<string | null>(null)
const reconfigureDbName = ref('')

function openDbConfig(dbType: 'postgresql' | 'mysql' | 'redis') {
  dbConfigType.value = dbType
  dbConfigName.value = ''
  dbSecurityOptions.value = {
    setRootPassword: true,
    removeAnonymousUsers: true,
    disallowRootRemote: true,
    removeTestDb: true,
    configureHba: true,
    enableProtectedMode: true,
    bindLocalhost: true
  }
  showDbConfigModal.value = true
}

function submitDbConfig() {
  emit('configureDatabase', dbConfigType.value, dbConfigName.value || (dbConfigType.value === 'redis' ? '' : 'serverflow'), dbSecurityOptions.value)
  showDbConfigModal.value = false
}

function openRemoveRuntime(runtime: string) {
  runtimeToRemove.value = runtime
  showRemoveRuntimeModal.value = true
}

function confirmRemoveRuntime() {
  if (runtimeToRemove.value) {
    emit('removeRuntime', runtimeToRemove.value)
    showRemoveRuntimeModal.value = false
    runtimeToRemove.value = null
  }
}

function openRemoveDatabase(dbType: string) {
  databaseToRemove.value = dbType
  showRemoveDatabaseModal.value = true
}

function confirmRemoveDatabase() {
  if (databaseToRemove.value) {
    emit('removeDatabase', databaseToRemove.value)
    showRemoveDatabaseModal.value = false
    databaseToRemove.value = null
  }
}

function openReconfigureDatabase(dbType: string) {
  reconfigureDbType.value = dbType
  reconfigureDbName.value = ''
  showReconfigureDatabaseModal.value = true
}

function confirmReconfigureDatabase() {
  if (reconfigureDbType.value) {
    emit('reconfigureDatabase', reconfigureDbType.value, reconfigureDbName.value || (reconfigureDbType.value === 'redis' ? '' : 'serverflow_new'))
    showReconfigureDatabaseModal.value = false
    reconfigureDbType.value = null
  }
}

function copyLogs() {
  const text = props.infrastructureLogs.map(l => l.message).join('\n')
  navigator.clipboard.writeText(text)
}

// Console auto-scroll
const consoleContainer = ref<HTMLDivElement | null>(null)

watch(
  () => props.infrastructureLogs.length,
  async () => {
    await nextTick()
    if (consoleContainer.value) {
      consoleContainer.value.scrollTop = consoleContainer.value.scrollHeight
    }
  }
)
</script>

<template>
  <div class="server-settings-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div class="flex items-center gap-4">
        <button
          class="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
          @click="emit('back')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ t('infrastructure.serverSettings') }}</h1>
          <p class="text-slate-500 text-sm mt-1">{{ serverName }}</p>
        </div>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium transition-colors"
        :disabled="infraStatusLoading"
        @click="emit('refresh')"
      >
        <svg v-if="!infraStatusLoading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <div v-else class="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        {{ t('common.refresh') }}
      </button>
    </div>

    <!-- Server Info Bar -->
    <div v-if="infraStatus" class="glass-card p-4 mb-6">
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div class="text-center">
          <p class="text-xs text-slate-500 uppercase font-medium mb-1">OS</p>
          <p class="text-sm font-semibold text-slate-800">{{ infraStatus.system.os }} {{ infraStatus.system.osVersion }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-slate-500 uppercase font-medium mb-1">CPU</p>
          <p class="text-sm font-semibold text-slate-800">{{ infraStatus.system.cpu }} cores</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-slate-500 uppercase font-medium mb-1">RAM</p>
          <p class="text-sm font-semibold text-slate-800">{{ infraStatus.system.ram }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-slate-500 uppercase font-medium mb-1">Disk</p>
          <p class="text-sm font-semibold text-slate-800">{{ infraStatus.system.disk }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-slate-500 uppercase font-medium mb-1">{{ t('infrastructure.uptime') }}</p>
          <p class="text-sm font-semibold text-slate-800">{{ infraStatus.system.uptime }}</p>
        </div>
      </div>
    </div>
    <div v-else-if="infraStatusLoading" class="glass-card p-8 mb-6 text-center">
      <div class="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin mx-auto mb-3" />
      <p class="text-slate-500">{{ t('common.loading') }}</p>
    </div>

    <!-- Runtimes Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span>📦</span> {{ t('infrastructure.runtimes') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="rt in runtimes"
          :key="rt.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getRuntime(rt.type)?.installed }"
        >
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
              {{ rt.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800">{{ rt.name }}</h3>
              <p v-if="getRuntime(rt.type)?.installed" class="text-sm text-emerald-600 font-medium">
                {{ getRuntime(rt.type)?.version }}
                <span v-if="getRuntime(rt.type)?.updateAvailable" class="text-amber-600">
                  → {{ getRuntime(rt.type)?.latestVersion }}
                </span>
              </p>
              <p v-else class="text-sm text-slate-400">{{ rt.size }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-4">
            <template v-if="!getRuntime(rt.type)?.installed">
              <button
                class="flex-1 px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                :disabled="installingRuntime !== null"
                @click="emit('installRuntime', rt.type)"
              >
                {{ installingRuntime === rt.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else-if="getRuntime(rt.type)?.updateAvailable">
              <button
                class="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                :disabled="updatingRuntime !== null"
                @click="emit('updateRuntime', rt.type)"
              >
                {{ updatingRuntime === rt.type ? t('infrastructure.updating') : t('infrastructure.updateAvailable') }}
              </button>
            </template>
            <template v-else>
              <span class="flex-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium text-center">
                ✓ {{ t('infrastructure.installed') }}
              </span>
            </template>
            <button
              v-if="getRuntime(rt.type)?.installed"
              class="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              title="View logs"
              @click="emit('fetchServiceLogs', rt.type)"
            >
              📋
            </button>
            <button
              v-if="getRuntime(rt.type)?.installed && rt.canRemove"
              class="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
              :disabled="removingRuntime !== null"
              @click="openRemoveRuntime(rt.type)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Databases Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span>🗄️</span> {{ t('infrastructure.databases') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          v-for="db in databases"
          :key="db.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getDatabase(db.type)?.installed }"
        >
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
              {{ db.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800">{{ db.name }}</h3>
              <p v-if="getDatabase(db.type)?.installed" class="text-sm font-medium" :class="getDatabase(db.type)?.running ? 'text-emerald-600' : 'text-red-500'">
                {{ getDatabase(db.type)?.running ? '🟢 Running' : '🔴 Stopped' }}
              </p>
              <p v-else class="text-sm text-slate-400">{{ t('infrastructure.notConfigured') }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-4">
            <template v-if="!getDatabase(db.type)?.installed">
              <button
                class="flex-1 px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                :disabled="configuringDatabase !== null"
                @click="openDbConfig(db.type as any)"
              >
                {{ configuringDatabase === db.type ? t('infrastructure.settingUp') : t('infrastructure.setup') }}
              </button>
            </template>
            <template v-else>
              <span class="flex-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium text-center">
                ✓ {{ t('infrastructure.configured') }}
              </span>
            </template>
            <button
              v-if="getDatabase(db.type)?.installed"
              class="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              title="View logs"
              @click="emit('fetchServiceLogs', db.type)"
            >
              📋
            </button>
            <button
              v-if="getDatabase(db.type)?.installed"
              class="w-10 h-10 flex items-center justify-center bg-amber-50 hover:bg-amber-100 rounded-lg text-amber-600 transition-colors"
              :disabled="reconfiguringDatabase !== null"
              title="Reconfigure"
              @click="openReconfigureDatabase(db.type)"
            >
              🔄
            </button>
            <button
              v-if="getDatabase(db.type)?.installed"
              class="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
              :disabled="removingDatabase !== null"
              @click="openRemoveDatabase(db.type)"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Live Console Section -->
    <section class="mb-8">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>📋</span> {{ t('infrastructure.installConsole') }}
        </h2>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            :disabled="fetchingRemoteLogs"
            @click="emit('fetchRemoteLogs')"
          >
            <span v-if="!fetchingRemoteLogs">📥</span>
            <div v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {{ t('infrastructure.loadServerLogs') }}
          </button>
          <button
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            @click="emit('clearRemoteLogs')"
          >
            🗑️ {{ t('infrastructure.clearServerLogs') }}
          </button>
          <button
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            @click="emit('clearInfraLogs')"
          >
            {{ t('console.clear') }}
          </button>
          <button
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            @click="copyLogs"
          >
            {{ t('common.copy') }}
          </button>
        </div>
      </div>
      <div v-if="remoteLogFilePath" class="mb-2 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-600">
        📂 {{ t('infrastructure.serverLogFile') }}: <code class="bg-slate-200 px-1 rounded">{{ remoteLogFilePath }}</code>
      </div>
      <div class="glass-card p-0 overflow-hidden">
        <div ref="consoleContainer" class="h-64 overflow-y-auto bg-slate-900 p-4 font-mono text-sm">
          <div v-if="infrastructureLogs.length === 0" class="text-slate-500 text-center py-8">
            {{ fetchingRemoteLogs ? t('infrastructure.loadingLogs') : t('infrastructure.waitingForLogs') }}
          </div>
          <div
            v-for="(log, idx) in infrastructureLogs"
            :key="idx"
            class="py-0.5"
            :class="log.stream === 'stderr' ? 'text-red-400' : 'text-emerald-400'"
          >
            {{ log.message }}
          </div>
        </div>
      </div>
    </section>

    <!-- Backups Section (Coming Soon) -->
    <section class="mb-8 opacity-50">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span>💾</span> {{ t('infrastructure.backups') }}
        <span class="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{{ t('infrastructure.comingSoon') }}</span>
      </h2>
      <div class="glass-card p-6 text-center text-slate-500">
        {{ t('infrastructure.backupsDesc') }}
      </div>
    </section>

    <!-- Database Config Modal -->
    <Teleport to="body">
      <div
        v-if="showDbConfigModal"
        class="modal-overlay"
        @click.self="showDbConfigModal = false"
      >
        <div class="glass-card w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
          <div class="flex justify-between items-center p-5 border-b border-slate-200">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              🔧 {{ t('infrastructure.setupDbTitle', { db: dbConfigType === 'postgresql' ? 'PostgreSQL' : dbConfigType === 'mysql' ? 'MySQL' : 'Redis' }) }}
            </h3>
            <button
              class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              @click="showDbConfigModal = false"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div v-if="dbConfigType !== 'redis'" class="form-group">
              <label>{{ t('infrastructure.databaseName') }}</label>
              <input v-model="dbConfigName" type="text" placeholder="serverflow" />
            </div>

            <!-- Security Options -->
            <div class="space-y-3">
              <h4 class="font-medium text-slate-700">{{ t('infrastructure.securityOptions') }}</h4>

              <template v-if="dbConfigType === 'mysql'">
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input v-model="dbSecurityOptions.setRootPassword" type="checkbox" class="w-4 h-4" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.setRootPassword') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input v-model="dbSecurityOptions.removeAnonymousUsers" type="checkbox" class="w-4 h-4" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.removeAnonymousUsers') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input v-model="dbSecurityOptions.disallowRootRemote" type="checkbox" class="w-4 h-4" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.disallowRootRemote') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input v-model="dbSecurityOptions.removeTestDb" type="checkbox" class="w-4 h-4" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.removeTestDb') }}</span>
                </label>
              </template>

              <template v-else-if="dbConfigType === 'postgresql'">
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input v-model="dbSecurityOptions.configureHba" type="checkbox" class="w-4 h-4" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.configureHba') }}</span>
                </label>
              </template>

              <template v-else-if="dbConfigType === 'redis'">
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input v-model="dbSecurityOptions.enableProtectedMode" type="checkbox" class="w-4 h-4" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.enableProtectedMode') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input v-model="dbSecurityOptions.bindLocalhost" type="checkbox" class="w-4 h-4" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.bindLocalhost') }}</span>
                </label>
              </template>
            </div>

            <div class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <span class="text-xl">🔑</span>
              <p class="text-sm text-amber-800">
                {{ t('infrastructure.connectionStringWarning') }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50">
            <button class="secondary-btn" @click="showDbConfigModal = false">
              {{ t('common.cancel') }}
            </button>
            <button
              class="premium-btn"
              :disabled="configuringDatabase !== null"
              @click="submitDbConfig"
            >
              {{ configuringDatabase ? t('infrastructure.settingUp') : '🚀 ' + t('infrastructure.installAndSecure') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Remove Runtime Modal -->
    <Teleport to="body">
      <div
        v-if="showRemoveRuntimeModal"
        class="modal-overlay"
        @click.self="showRemoveRuntimeModal = false"
      >
        <div class="glass-card w-full max-w-md mx-4">
          <div class="flex justify-between items-center p-5 border-b border-red-200 bg-red-50">
            <h3 class="text-lg font-bold text-red-800 flex items-center gap-2">
              🗑️ {{ t('infrastructure.removeRuntimeTitle', { runtime: runtimeToRemove }) }}
            </h3>
            <button
              class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 rounded-lg text-red-600 transition-colors"
              @click="showRemoveRuntimeModal = false"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-5">
            <p class="text-slate-600">{{ t('infrastructure.removeRuntimeWarning', { runtime: runtimeToRemove }) }}</p>
          </div>
          <div class="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50">
            <button class="secondary-btn" @click="showRemoveRuntimeModal = false">
              {{ t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              :disabled="removingRuntime !== null"
              @click="confirmRemoveRuntime"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Remove Database Modal -->
    <Teleport to="body">
      <div
        v-if="showRemoveDatabaseModal"
        class="modal-overlay"
        @click.self="showRemoveDatabaseModal = false"
      >
        <div class="glass-card w-full max-w-md mx-4">
          <div class="flex justify-between items-center p-5 border-b border-red-200 bg-red-50">
            <h3 class="text-lg font-bold text-red-800 flex items-center gap-2">
              🗑️ {{ t('infrastructure.removeDatabaseTitle', { db: databaseToRemove }) }}
            </h3>
            <button
              class="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 rounded-lg text-red-600 transition-colors"
              @click="showRemoveDatabaseModal = false"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-5">
            <p class="text-slate-600">{{ t('infrastructure.removeDatabaseWarning', { db: databaseToRemove }) }}</p>
          </div>
          <div class="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50">
            <button class="secondary-btn" @click="showRemoveDatabaseModal = false">
              {{ t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              :disabled="removingDatabase !== null"
              @click="confirmRemoveDatabase"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Reconfigure Database Modal -->
    <Teleport to="body">
      <div
        v-if="showReconfigureDatabaseModal"
        class="modal-overlay"
        @click.self="showReconfigureDatabaseModal = false"
      >
        <div class="glass-card w-full max-w-md mx-4">
          <div class="flex justify-between items-center p-5 border-b border-slate-200">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              🔄 {{ t('infrastructure.reconfigureDbTitle', { db: reconfigureDbType }) }}
            </h3>
            <button
              class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              @click="showReconfigureDatabaseModal = false"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-slate-600">{{ t('infrastructure.reconfigureDbDesc') }}</p>
            <div v-if="reconfigureDbType !== 'redis'" class="form-group">
              <label>{{ t('infrastructure.newDbName') }}</label>
              <input v-model="reconfigureDbName" type="text" placeholder="serverflow_new" />
            </div>
          </div>
          <div class="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50">
            <button class="secondary-btn" @click="showReconfigureDatabaseModal = false">
              {{ t('common.cancel') }}
            </button>
            <button
              class="premium-btn"
              :disabled="reconfiguringDatabase !== null"
              @click="confirmReconfigureDatabase"
            >
              {{ reconfiguringDatabase ? t('infrastructure.settingUp') : t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.server-settings-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input,
.form-group select {
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.9375rem;
  color: #0f172a;
  background: #ffffff;
  transition: border-color 0.2s ease;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #8b5cf6;
}
</style>
