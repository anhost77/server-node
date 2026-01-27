<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import MailServerWizard from '@/components/mail/MailServerWizard.vue'

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

interface Service {
  type: string
  installed: boolean
  running?: boolean
  version?: string
}

interface InfraStatus {
  runtimes: Runtime[]
  databases: Database[]
  services?: Service[]
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
  installingService: string | null
  removingService: string | null
  startingService: string | null
  stoppingService: string | null
  startingDatabase: string | null
  stoppingDatabase: string | null
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
  openDbConfigModal: [dbType: 'postgresql' | 'mysql' | 'redis' | 'mongodb']
  configureDatabase: [dbType: string, dbName: string, securityOptions: any]
  reconfigureDatabase: [dbType: string, dbName: string]
  removeDatabase: [dbType: string]
  startDatabase: [dbType: string]
  stopDatabase: [dbType: string]
  installService: [service: string]
  removeService: [service: string]
  startService: [service: string]
  stopService: [service: string]
  fetchServiceLogs: [service: string]
  fetchRemoteLogs: []
  clearRemoteLogs: []
  clearInfraLogs: []
  copyInfraLogs: []
}>()

const serverName = computed(() => props.server.alias || props.server.hostname || props.server.id.slice(0, 8))

// Runtime helpers
const runtimes = [
  { type: 'nodejs', name: 'Node.js', icon: 'N', size: 'Pre-installed', canRemove: false },
  { type: 'python', name: 'Python', icon: 'Py', size: '~200MB', canRemove: false },
  { type: 'php', name: 'PHP', icon: 'P', size: '~100MB', canRemove: true },
  { type: 'go', name: 'Go', icon: 'Go', size: '~500MB', canRemove: true },
  { type: 'docker', name: 'Docker', icon: 'D', size: '~500MB', canRemove: true },
  { type: 'rust', name: 'Rust', icon: 'Rs', size: '~1GB', canRemove: true },
  { type: 'ruby', name: 'Ruby', icon: 'Rb', size: '~300MB', canRemove: true }
]

const databases = [
  { type: 'postgresql', name: 'PostgreSQL', icon: 'PG' },
  { type: 'mysql', name: 'MySQL', icon: 'My' },
  { type: 'redis', name: 'Redis', icon: 'Rd' },
  { type: 'mongodb', name: 'MongoDB', icon: 'Mg' }
]

// Network & Proxy services
const networkServices = [
  { type: 'nginx', name: 'Nginx', icon: 'Nx', size: '~10MB', description: 'Reverse Proxy', canRemove: true },
  { type: 'haproxy', name: 'HAProxy', icon: 'HA', size: '~10MB', description: 'Load Balancer', canRemove: true },
  { type: 'keepalived', name: 'Keepalived', icon: 'KA', size: '~5MB', description: 'High Availability', canRemove: true },
  { type: 'certbot', name: 'Certbot', icon: 'CB', size: '~20MB', description: 'SSL Auto', canRemove: true }
]

// Security services
const securityServices = [
  { type: 'fail2ban', name: 'Fail2ban', icon: 'F2', size: '~20MB', description: 'Intrusion Prevention', canRemove: true },
  { type: 'ufw', name: 'UFW', icon: 'FW', size: '~5MB', description: 'Firewall', canRemove: true },
  { type: 'wireguard', name: 'WireGuard', icon: 'WG', size: '~50MB', description: 'VPN', canRemove: true }
]

// Monitoring services
const monitoringServices = [
  { type: 'pm2', name: 'PM2', icon: 'PM', size: '~50MB', description: 'Process Manager', canRemove: true },
  { type: 'netdata', name: 'Netdata', icon: 'ND', size: '~100MB', description: 'Real-time Monitoring', canRemove: true },
  { type: 'loki', name: 'Loki', icon: 'LK', size: '~100MB', description: 'Log Aggregation', canRemove: true }
]

// DNS services
const dnsServices = [
  { type: 'bind9', name: 'BIND9', icon: 'DN', size: '~50MB', description: 'DNS Server', canRemove: true }
]

// Mail services - postfix est critique, les autres peuvent être supprimés
const mailServices = [
  { type: 'postfix', name: 'Postfix', icon: 'PF', size: '~30MB', description: 'Mail Transfer Agent', canRemove: false },
  { type: 'dovecot', name: 'Dovecot', icon: 'DC', size: '~40MB', description: 'IMAP/POP3 Server', canRemove: true },
  { type: 'rspamd', name: 'Rspamd', icon: 'RS', size: '~100MB', description: 'Antispam Filter', canRemove: true },
  { type: 'opendkim', name: 'OpenDKIM', icon: 'DK', size: '~10MB', description: 'DKIM Signing', canRemove: true },
  { type: 'clamav', name: 'ClamAV', icon: 'AV', size: '~500MB', description: 'Antivirus Scanner', canRemove: true, warning: '⚠️ Installation gourmande en ressources (RAM/CPU). Peut prendre 5-10 min.' },
  { type: 'spf-policyd', name: 'SPF Policy', icon: 'SP', size: '~5MB', description: 'SPF Verification', canRemove: true, canStartStop: false }
]

// Backup services (tools, not services - cannot be started/stopped)
const backupServices = [
  { type: 'rsync', name: 'Rsync', icon: 'RS', size: '~5MB', description: 'File Sync', canRemove: true, canStartStop: false },
  { type: 'rclone', name: 'Rclone', icon: 'RC', size: '~50MB', description: 'Cloud Storage Sync', canRemove: true, canStartStop: false },
  { type: 'restic', name: 'Restic', icon: 'RT', size: '~30MB', description: 'Encrypted Backups', canRemove: true, canStartStop: false }
]

// System services (protected - cannot be removed)
const systemServices = [
  { type: 'ssh', name: 'SSH', icon: 'SS', size: '~5MB', description: 'Secure Shell', canRemove: false },
  { type: 'cron', name: 'Cron', icon: 'CR', size: '~2MB', description: 'Task Scheduler', canRemove: false }
]

// FTP services
const ftpServices = [
  { type: 'vsftpd', name: 'vsftpd', icon: 'VS', size: '~5MB', description: 'Very Secure FTP', canRemove: true },
  { type: 'proftpd', name: 'ProFTPD', icon: 'PF', size: '~10MB', description: 'Modular FTP Server', canRemove: true }
]

// Storage services
const storageServices = [
  { type: 'nfs', name: 'NFS', icon: 'NF', size: '~10MB', description: 'Network File System', canRemove: true }
]

function getRuntime(type: string) {
  return props.infraStatus?.runtimes.find(r => r.type === type)
}

function getDatabase(type: string) {
  return props.infraStatus?.databases.find(d => d.type === type)
}

function getService(type: string) {
  return props.infraStatus?.services?.find(s => s.type === type)
}

// Console Modal State
const showConsoleModal = ref(false)
const consoleModalTitle = ref('')
const consoleContainer = ref<HTMLDivElement | null>(null)
const consoleModalMode = ref<'operation' | 'logs'>('logs') // Track why modal was opened
const operationCompleted = ref(false) // Track if operation finished successfully

// Mail Wizard
const showMailWizard = ref(false)

/**
 * **handleMailWizardComplete()** - Gère la fin du wizard mail
 *
 * Cette fonction est appelée quand l'utilisateur termine le wizard de
 * configuration mail. Elle ferme le modal et pourrait lancer des actions
 * comme l'installation des services ou l'envoi de la config au serveur.
 */
function handleMailWizardComplete(config: any) {
  console.log('Mail wizard completed with config:', config)
  showMailWizard.value = false
  // TODO: Émettre un événement pour lancer l'installation via WebSocket
  // emit('installMailStack', config)
}

// Track if an operation is in progress
const isOperationInProgress = computed(() =>
  props.installingRuntime !== null ||
  props.updatingRuntime !== null ||
  props.removingRuntime !== null ||
  props.configuringDatabase !== null ||
  props.reconfiguringDatabase !== null ||
  props.removingDatabase !== null ||
  props.startingDatabase !== null ||
  props.stoppingDatabase !== null ||
  props.installingService !== null ||
  props.removingService !== null ||
  props.startingService !== null ||
  props.stoppingService !== null
)

// Auto-open console modal when operation starts
watch(isOperationInProgress, (inProgress, wasInProgress) => {
  if (inProgress) {
    // Starting a new operation
    operationCompleted.value = false
    consoleModalMode.value = 'operation'

    // Clear previous logs when starting a new operation
    emit('clearInfraLogs')

    // Determine title based on operation
    if (props.installingRuntime) {
      consoleModalTitle.value = t('infrastructure.installingRuntime', { runtime: props.installingRuntime })
    } else if (props.updatingRuntime) {
      consoleModalTitle.value = t('infrastructure.updatingRuntime', { runtime: props.updatingRuntime })
    } else if (props.removingRuntime) {
      consoleModalTitle.value = t('infrastructure.removingRuntime', { runtime: props.removingRuntime })
    } else if (props.configuringDatabase) {
      consoleModalTitle.value = t('infrastructure.configuringDb', { db: props.configuringDatabase })
    } else if (props.reconfiguringDatabase) {
      consoleModalTitle.value = t('infrastructure.reconfiguringDb', { db: props.reconfiguringDatabase })
    } else if (props.removingDatabase) {
      consoleModalTitle.value = t('infrastructure.removingDb', { db: props.removingDatabase })
    } else if (props.installingService) {
      consoleModalTitle.value = t('infrastructure.installingService', { service: props.installingService })
    } else if (props.removingService) {
      consoleModalTitle.value = t('infrastructure.removingService', { service: props.removingService })
    } else if (props.startingService) {
      consoleModalTitle.value = t('infrastructure.startingService', { service: props.startingService })
    } else if (props.stoppingService) {
      consoleModalTitle.value = t('infrastructure.stoppingService', { service: props.stoppingService })
    } else if (props.startingDatabase) {
      consoleModalTitle.value = t('infrastructure.startingDb', { db: props.startingDatabase })
    } else if (props.stoppingDatabase) {
      consoleModalTitle.value = t('infrastructure.stoppingDb', { db: props.stoppingDatabase })
    }
    showConsoleModal.value = true
  } else if (wasInProgress) {
    // Operation just finished
    operationCompleted.value = true
  }
})

// Auto-scroll console
watch(
  () => props.infrastructureLogs.length,
  async () => {
    await nextTick()
    if (consoleContainer.value) {
      consoleContainer.value.scrollTop = consoleContainer.value.scrollHeight
    }
  }
)

function openConsoleForLogs(service: string) {
  consoleModalMode.value = 'logs'
  operationCompleted.value = false
  consoleModalTitle.value = t('infrastructure.logsFor', { service })
  emit('fetchServiceLogs', service)
  showConsoleModal.value = true
}

function openRemoteLogsModal() {
  consoleModalMode.value = 'logs'
  operationCompleted.value = false
  consoleModalTitle.value = t('infrastructure.serverLogs')
  emit('fetchRemoteLogs')
  showConsoleModal.value = true
}

function closeConsoleModal() {
  // Don't close if operation is in progress
  if (isOperationInProgress.value) return
  // Don't clear logs - let the user review them
  // Logs will be cleared when a new operation starts
  showConsoleModal.value = false
}

function copyLogs() {
  const text = props.infrastructureLogs.map(l => l.message).join('\n')
  navigator.clipboard.writeText(text)
}

// Database Config Modal State
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

// Remove Runtime Modal State
const showRemoveRuntimeModal = ref(false)
const runtimeToRemove = ref<string | null>(null)

// Remove Database Modal State
const showRemoveDatabaseModal = ref(false)
const databaseToRemove = ref<string | null>(null)

// Reconfigure Database Modal State
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
</script>

<template>
  <div class="p-6 max-w-[1200px] mx-auto">
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
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors"
          @click="openRemoteLogsModal"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {{ t('infrastructure.viewLogs') }}
        </button>
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
        <span class="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 text-sm font-bold">R</span>
        {{ t('infrastructure.runtimes') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="rt in runtimes"
          :key="rt.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getRuntime(rt.type)?.installed }"
        >
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 flex-shrink-0">
              {{ rt.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800">{{ rt.name }}</h3>
              <p v-if="getRuntime(rt.type)?.installed" class="text-sm text-emerald-600 font-medium">
                {{ getRuntime(rt.type)?.version }}
                <span v-if="getRuntime(rt.type)?.updateAvailable" class="text-amber-600">
                  -> {{ getRuntime(rt.type)?.latestVersion }}
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
                {{ t('infrastructure.installed') }}
              </span>
            </template>
            <button
              v-if="getRuntime(rt.type)?.installed"
              class="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              :title="t('infrastructure.viewLogs')"
              @click="openConsoleForLogs(rt.type)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              v-if="getRuntime(rt.type)?.installed && rt.canRemove"
              class="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
              :disabled="removingRuntime !== null"
              @click="openRemoveRuntime(rt.type)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Databases Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-sm font-bold">DB</span>
        {{ t('infrastructure.databases') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="db in databases"
          :key="db.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getDatabase(db.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
              {{ db.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ db.name }}</h3>
              <p v-if="getDatabase(db.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getDatabase(db.type)?.running ? 'text-emerald-600' : 'text-red-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getDatabase(db.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getDatabase(db.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ t('infrastructure.notConfigured') }}</p>
              <p v-if="getDatabase(db.type)?.version" class="text-xs text-slate-500 mt-0.5">
                v{{ getDatabase(db.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getDatabase(db.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="configuringDatabase !== null"
                @click="openDbConfig(db.type as any)"
              >
                {{ configuringDatabase === db.type ? t('infrastructure.settingUp') : t('infrastructure.setup') }}
              </button>
            </template>
            <template v-else>
              <!-- Start/Stop button -->
              <button
                v-if="getDatabase(db.type)?.running"
                class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="stoppingDatabase !== null"
                @click="emit('stopDatabase', db.type)"
              >
                {{ stoppingDatabase === db.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
              </button>
              <button
                v-else
                class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="startingDatabase !== null"
                @click="emit('startDatabase', db.type)"
              >
                {{ startingDatabase === db.type ? t('infrastructure.starting') : t('infrastructure.start') }}
              </button>
              <!-- Logs button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                :title="t('infrastructure.viewLogs')"
                @click="openConsoleForLogs(db.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <!-- Reconfigure button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-violet-50 hover:bg-violet-100 rounded-lg text-violet-600 transition-colors"
                :disabled="reconfiguringDatabase !== null"
                :title="t('infrastructure.reconfigure')"
                @click="openReconfigureDatabase(db.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <!-- Delete button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingDatabase !== null"
                @click="openRemoveDatabase(db.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Network & Proxy Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center text-cyan-600 text-sm font-bold">N</span>
        {{ t('infrastructure.networkProxy') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="svc in networkServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-sm font-bold text-cyan-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Start/Stop button -->
              <button
                v-if="getService(svc.type)?.running"
                class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="stoppingService !== null"
                @click="emit('stopService', svc.type)"
              >
                {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
              </button>
              <button
                v-else
                class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="startingService !== null"
                @click="emit('startService', svc.type)"
              >
                {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
              </button>
              <!-- Logs button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                :title="t('infrastructure.viewLogs')"
                @click="openConsoleForLogs(svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <!-- Delete button -->
              <button
                v-if="svc.canRemove"
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Security Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600 text-sm font-bold">S</span>
        {{ t('infrastructure.security') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          v-for="svc in securityServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-sm font-bold text-red-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Start/Stop button -->
              <button
                v-if="getService(svc.type)?.running"
                class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="stoppingService !== null"
                @click="emit('stopService', svc.type)"
              >
                {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
              </button>
              <button
                v-else
                class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="startingService !== null"
                @click="emit('startService', svc.type)"
              >
                {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
              </button>
              <!-- Logs button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                :title="t('infrastructure.viewLogs')"
                @click="openConsoleForLogs(svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <!-- Delete button -->
              <button
                v-if="svc.canRemove"
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Monitoring Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-sm font-bold">M</span>
        {{ t('infrastructure.monitoring') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          v-for="svc in monitoringServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-sm font-bold text-purple-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Start/Stop button -->
              <button
                v-if="getService(svc.type)?.running"
                class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="stoppingService !== null"
                @click="emit('stopService', svc.type)"
              >
                {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
              </button>
              <button
                v-else
                class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="startingService !== null"
                @click="emit('startService', svc.type)"
              >
                {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
              </button>
              <!-- Logs button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                :title="t('infrastructure.viewLogs')"
                @click="openConsoleForLogs(svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <!-- Delete button -->
              <button
                v-if="svc.canRemove"
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- DNS Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-sm font-bold">D</span>
        {{ t('infrastructure.dns') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="svc in dnsServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Start/Stop button -->
              <button
                v-if="getService(svc.type)?.running"
                class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="stoppingService !== null"
                @click="emit('stopService', svc.type)"
              >
                {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
              </button>
              <button
                v-else
                class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="startingService !== null"
                @click="emit('startService', svc.type)"
              >
                {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
              </button>
              <!-- Logs button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                :title="t('infrastructure.viewLogs')"
                @click="openConsoleForLogs(svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <!-- Delete button -->
              <button
                v-if="svc.canRemove"
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Mail Section -->
    <section class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 text-sm font-bold">M</span>
          {{ t('infrastructure.mail') }}
        </h2>
        <button
          @click="showMailWizard = true"
          class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.29 7 12 12 20.71 7"/>
            <line x1="12" y1="22" x2="12" y2="12"/>
          </svg>
          {{ t('mail.wizard.title') || 'Configurer Stack Mail' }}
        </button>
      </div>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="svc in mailServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-sm font-bold text-orange-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="svc.warning && !getService(svc.type)?.installed" class="text-xs text-amber-600 mt-0.5 font-medium">{{ svc.warning }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else-if="!svc.warning" class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Start/Stop button (only for services that can be started/stopped) -->
              <template v-if="svc.canStartStop !== false">
                <button
                  v-if="getService(svc.type)?.running"
                  class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="stoppingService !== null"
                  @click="emit('stopService', svc.type)"
                >
                  {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
                </button>
                <button
                  v-else
                  class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="startingService !== null"
                  @click="emit('startService', svc.type)"
                >
                  {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
                </button>
              </template>
              <!-- Tool indicator (for services without start/stop) -->
              <div v-else class="flex-1 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium text-center">
                {{ t('infrastructure.tool') || 'Outil' }}
              </div>
              <!-- Logs button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                :title="t('infrastructure.viewLogs')"
                @click="openConsoleForLogs(svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <!-- Delete button (only if canRemove) -->
              <button
                v-if="svc.canRemove"
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <!-- Lock icon if cannot remove (critical service) -->
              <div
                v-else
                class="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-lg text-slate-400"
                :title="t('infrastructure.criticalService')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Backups Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 text-sm font-bold">B</span>
        {{ t('infrastructure.backups') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          v-for="svc in backupServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-sm font-bold text-amber-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1 text-emerald-600">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {{ t('infrastructure.installed') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Installed badge -->
              <span class="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium text-center">
                {{ t('infrastructure.installed') }}
              </span>
              <!-- Delete button -->
              <button
                v-if="svc.canRemove"
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- System Services Section (SSH, Cron - protected) -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center text-slate-700 text-sm font-bold">SY</span>
        {{ t('infrastructure.systemServices') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="svc in systemServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-700 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-600'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Running status buttons -->
              <template v-if="getService(svc.type)?.running">
                <button
                  class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="stoppingService !== null"
                  @click="emit('stopService', svc.type)"
                >
                  {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
                </button>
              </template>
              <template v-else>
                <button
                  class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="startingService !== null"
                  @click="emit('startService', svc.type)"
                >
                  {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
                </button>
              </template>
              <!-- Lock icon - protected service -->
              <div
                class="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-lg text-slate-400"
                :title="t('infrastructure.protectedService')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- FTP Services Section -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center text-cyan-600 text-sm font-bold">FT</span>
        {{ t('infrastructure.ftpServices') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="svc in ftpServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-sm font-bold text-cyan-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-600'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Running status buttons -->
              <template v-if="getService(svc.type)?.running">
                <button
                  class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="stoppingService !== null"
                  @click="emit('stopService', svc.type)"
                >
                  {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
                </button>
              </template>
              <template v-else>
                <button
                  class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="startingService !== null"
                  @click="emit('startService', svc.type)"
                >
                  {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
                </button>
              </template>
              <!-- Delete button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Storage Services Section (NFS) -->
    <section class="mb-8">
      <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span class="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center text-teal-600 text-sm font-bold">ST</span>
        {{ t('infrastructure.storageServices') }}
      </h2>
      <div v-if="infraStatus" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="svc in storageServices"
          :key="svc.type"
          class="glass-card p-4"
          :class="{ 'ring-2 ring-emerald-500/30': getService(svc.type)?.installed }"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-sm font-bold text-teal-600 flex-shrink-0">
              {{ svc.icon }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-800 text-sm">{{ svc.name }}</h3>
              <p class="text-xs text-slate-500">{{ svc.description }}</p>
              <p v-if="getService(svc.type)?.installed" class="text-xs font-medium mt-0.5">
                <span class="inline-flex items-center gap-1" :class="getService(svc.type)?.running ? 'text-emerald-600' : 'text-red-600'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getService(svc.type)?.running ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ getService(svc.type)?.running ? t('infrastructure.running') : t('infrastructure.stopped') }}
                </span>
              </p>
              <p v-else class="text-xs text-slate-400 mt-0.5">{{ svc.size }}</p>
              <p v-if="getService(svc.type)?.version" class="text-xs text-slate-500">
                v{{ getService(svc.type)?.version }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <template v-if="!getService(svc.type)?.installed">
              <button
                class="flex-1 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                :disabled="installingService !== null"
                @click="emit('installService', svc.type)"
              >
                {{ installingService === svc.type ? t('infrastructure.installing') : t('infrastructure.install') }}
              </button>
            </template>
            <template v-else>
              <!-- Running status buttons -->
              <template v-if="getService(svc.type)?.running">
                <button
                  class="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="stoppingService !== null"
                  @click="emit('stopService', svc.type)"
                >
                  {{ stoppingService === svc.type ? t('infrastructure.stopping') : t('infrastructure.stop') }}
                </button>
              </template>
              <template v-else>
                <button
                  class="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  :disabled="startingService !== null"
                  @click="emit('startService', svc.type)"
                >
                  {{ startingService === svc.type ? t('infrastructure.starting') : t('infrastructure.start') }}
                </button>
              </template>
              <!-- Delete button -->
              <button
                class="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                :disabled="removingService !== null"
                @click="emit('removeService', svc.type)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Console Modal -->
    <Teleport to="body">
      <div
        v-if="showConsoleModal"
        class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="closeConsoleModal"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-900">{{ consoleModalTitle }}</h3>
                <p v-if="isOperationInProgress" class="text-sm text-amber-600 font-medium flex items-center gap-2">
                  <span class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  {{ t('infrastructure.operationInProgress') }}
                </p>
                <p v-else-if="consoleModalMode === 'operation' && operationCompleted" class="text-sm text-emerald-600 font-medium flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ t('infrastructure.operationComplete') }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-600 transition-colors"
                @click="copyLogs"
              >
                {{ t('common.copy') }}
              </button>
              <button
                class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                :disabled="isOperationInProgress"
                :class="{ 'opacity-50 cursor-not-allowed': isOperationInProgress }"
                @click="closeConsoleModal"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Console Output -->
          <div ref="consoleContainer" class="flex-1 overflow-y-auto bg-slate-900 p-4 font-mono text-sm min-h-[300px]">
            <div v-if="infrastructureLogs.length === 0" class="text-slate-500 text-center py-8">
              <!-- Loading state for operation or fetching logs -->
              <div v-if="fetchingRemoteLogs || isOperationInProgress" class="flex flex-col items-center gap-3">
                <div class="w-8 h-8 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
                <span>{{ t('infrastructure.loadingLogs') }}</span>
              </div>
              <!-- Operation completed but no logs received -->
              <div v-else-if="consoleModalMode === 'operation' && operationCompleted" class="flex flex-col items-center gap-3 text-emerald-400">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{{ t('infrastructure.operationComplete') }}</span>
              </div>
              <!-- Waiting for logs (logs mode) -->
              <span v-else>{{ t('infrastructure.waitingForLogs') }}</span>
            </div>
            <div
              v-for="(log, idx) in infrastructureLogs"
              :key="idx"
              class="py-0.5 leading-relaxed"
              :class="log.stream === 'stderr' ? 'text-red-400' : 'text-emerald-400'"
            >
              {{ log.message }}
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            <p class="text-sm text-slate-500">
              {{ infrastructureLogs.length }} {{ t('console.lines') }}
            </p>
            <div class="flex items-center gap-2">
              <button
                v-if="infrastructureLogs.length > 0 && !isOperationInProgress"
                class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                @click="emit('clearInfraLogs')"
              >
                {{ t('console.clear') }}
              </button>
              <button
                class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isOperationInProgress"
                @click="closeConsoleModal"
              >
                {{ isOperationInProgress ? t('infrastructure.pleaseWait') : t('common.close') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Database Config Modal -->
    <Teleport to="body">
      <div
        v-if="showDbConfigModal"
        class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="showDbConfigModal = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
          <div class="flex justify-between items-center px-6 py-4 border-b border-slate-200">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600 text-sm font-bold">DB</span>
              {{ t('infrastructure.setupDbTitle', { db: dbConfigType === 'postgresql' ? 'PostgreSQL' : dbConfigType === 'mysql' ? 'MySQL' : 'Redis' }) }}
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
          <div class="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div v-if="dbConfigType !== 'redis'" class="space-y-2">
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">{{ t('infrastructure.databaseName') }}</label>
              <input
                v-model="dbConfigName"
                type="text"
                placeholder="serverflow"
                class="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <!-- Security Options -->
            <div class="space-y-3">
              <h4 class="font-medium text-slate-700">{{ t('infrastructure.securityOptions') }}</h4>

              <template v-if="dbConfigType === 'mysql'">
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input v-model="dbSecurityOptions.setRootPassword" type="checkbox" class="w-4 h-4 text-violet-600 rounded" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.setRootPassword') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input v-model="dbSecurityOptions.removeAnonymousUsers" type="checkbox" class="w-4 h-4 text-violet-600 rounded" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.removeAnonymousUsers') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input v-model="dbSecurityOptions.disallowRootRemote" type="checkbox" class="w-4 h-4 text-violet-600 rounded" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.disallowRootRemote') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input v-model="dbSecurityOptions.removeTestDb" type="checkbox" class="w-4 h-4 text-violet-600 rounded" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.removeTestDb') }}</span>
                </label>
              </template>

              <template v-else-if="dbConfigType === 'postgresql'">
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input v-model="dbSecurityOptions.configureHba" type="checkbox" class="w-4 h-4 text-violet-600 rounded" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.configureHba') }}</span>
                </label>
              </template>

              <template v-else-if="dbConfigType === 'redis'">
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input v-model="dbSecurityOptions.enableProtectedMode" type="checkbox" class="w-4 h-4 text-violet-600 rounded" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.enableProtectedMode') }}</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input v-model="dbSecurityOptions.bindLocalhost" type="checkbox" class="w-4 h-4 text-violet-600 rounded" />
                  <span class="text-sm text-slate-700">{{ t('infrastructure.bindLocalhost') }}</span>
                </label>
              </template>
            </div>

            <div class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p class="text-sm text-amber-800">
                {{ t('infrastructure.connectionStringWarning') }}
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
              @click="showDbConfigModal = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              :disabled="configuringDatabase !== null"
              @click="submitDbConfig"
            >
              {{ configuringDatabase ? t('infrastructure.settingUp') : t('infrastructure.installAndSecure') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Remove Runtime Modal -->
    <Teleport to="body">
      <div
        v-if="showRemoveRuntimeModal"
        class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="showRemoveRuntimeModal = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="flex justify-between items-center px-6 py-4 border-b border-red-200 bg-red-50 rounded-t-2xl">
            <h3 class="text-lg font-bold text-red-800 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {{ t('infrastructure.removeRuntimeTitle', { runtime: runtimeToRemove }) }}
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
          <div class="p-6">
            <p class="text-slate-600">{{ t('infrastructure.removeRuntimeWarning', { runtime: runtimeToRemove }) }}</p>
          </div>
          <div class="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button
              class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
              @click="showRemoveRuntimeModal = false"
            >
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
        class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="showRemoveDatabaseModal = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="flex justify-between items-center px-6 py-4 border-b border-red-200 bg-red-50 rounded-t-2xl">
            <h3 class="text-lg font-bold text-red-800 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {{ t('infrastructure.removeDatabaseTitle', { db: databaseToRemove }) }}
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
          <div class="p-6">
            <p class="text-slate-600">{{ t('infrastructure.removeDatabaseWarning', { db: databaseToRemove }) }}</p>
          </div>
          <div class="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button
              class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
              @click="showRemoveDatabaseModal = false"
            >
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
        class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="showReconfigureDatabaseModal = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="flex justify-between items-center px-6 py-4 border-b border-slate-200">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {{ t('infrastructure.reconfigureDbTitle', { db: reconfigureDbType }) }}
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
          <div class="p-6 space-y-4">
            <p class="text-slate-600">{{ t('infrastructure.reconfigureDbDesc') }}</p>
            <div v-if="reconfigureDbType !== 'redis'" class="space-y-2">
              <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">{{ t('infrastructure.newDbName') }}</label>
              <input
                v-model="reconfigureDbName"
                type="text"
                placeholder="serverflow_new"
                class="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
          <div class="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button
              class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
              @click="showReconfigureDatabaseModal = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              :disabled="reconfiguringDatabase !== null"
              @click="confirmReconfigureDatabase"
            >
              {{ reconfiguringDatabase ? t('infrastructure.settingUp') : t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Mail Server Wizard -->
    <MailServerWizard
      v-if="showMailWizard"
      :servers="[{
        id: server.id,
        hostname: server.hostname || server.alias || server.id,
        ip: server.hostname || '',
        alias: server.alias,
        online: server.status === 'online'
      }]"
      @close="showMailWizard = false"
      @complete="handleMailWizardComplete"
    />
  </div>
</template>
