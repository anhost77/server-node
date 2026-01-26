import { ref } from 'vue'
import { useWebSocket } from './useWebSocket'

// Types
export interface Runtime {
  type: 'nodejs' | 'python' | 'go' | 'docker' | 'rust' | 'ruby'
  installed: boolean
  version?: string
  latestVersion?: string
  updateAvailable?: boolean
}

export interface Database {
  type: 'postgresql' | 'mysql' | 'redis'
  installed: boolean
  running: boolean
  version?: string
}

export interface InfraStatus {
  system: {
    os: string
    osVersion: string
    cpu: number
    ram: string
    disk: string
    uptime: string
  }
  runtimes: Runtime[]
  databases: Database[]
}

export interface InfraLog {
  message: string
  stream: 'stdout' | 'stderr'
}

// Singleton state
const infraStatus = ref<InfraStatus | null>(null)
const infraStatusLoading = ref(false)
const installingRuntime = ref<string | null>(null)
const updatingRuntime = ref<string | null>(null)
const removingRuntime = ref<string | null>(null)
const configuringDatabase = ref<string | null>(null)
const reconfiguringDatabase = ref<string | null>(null)
const removingDatabase = ref<string | null>(null)
const infrastructureLogs = ref<InfraLog[]>([])
const fetchingRemoteLogs = ref(false)
const remoteLogFilePath = ref<string | null>(null)

// Modal state
const showDbConfigModal = ref(false)
const dbConfigType = ref<'postgresql' | 'mysql' | 'redis'>('postgresql')
const dbConfigName = ref('')
const lastConnectionString = ref<string | null>(null)
const showConnectionStringModal = ref(false)
const showRemoveRuntimeModal = ref(false)
const runtimeToRemove = ref<string | null>(null)
const showRemoveDatabaseModal = ref(false)
const databaseToRemove = ref<string | null>(null)
const showReconfigureDatabaseModal = ref(false)
const reconfigureDbType = ref<string | null>(null)
const reconfigureDbName = ref('')

// Database security options
const dbSecurityOptions = ref({
  setRootPassword: true,
  removeAnonymousUsers: true,
  disallowRootRemote: true,
  removeTestDb: true,
  configureHba: true,
  enableProtectedMode: true,
  bindLocalhost: true
})

export function useInfrastructure() {
  const { send, onMessage } = useWebSocket()

  // Request server status
  function requestServerStatus(serverId: string) {
    infraStatusLoading.value = true
    send({
      type: 'GET_INFRASTRUCTURE_STATUS',
      serverId
    })
  }

  // Install runtime
  function installRuntime(serverId: string, runtime: string) {
    if (installingRuntime.value) return
    installingRuntime.value = runtime
    infrastructureLogs.value = []
    send({
      type: 'INSTALL_RUNTIME',
      serverId,
      runtime
    })
  }

  // Update runtime
  function updateRuntime(serverId: string, runtime: string) {
    if (updatingRuntime.value) return
    updatingRuntime.value = runtime
    infrastructureLogs.value = []
    send({
      type: 'UPDATE_RUNTIME',
      serverId,
      runtime
    })
  }

  // Remove runtime
  function removeRuntime(serverId: string, runtime: string) {
    if (removingRuntime.value) return
    removingRuntime.value = runtime
    showRemoveRuntimeModal.value = false
    infrastructureLogs.value = []
    send({
      type: 'REMOVE_RUNTIME',
      serverId,
      runtime
    })
  }

  // Open database config modal
  function openDbConfigModal(dbType: 'postgresql' | 'mysql' | 'redis') {
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

  // Configure database
  function configureDatabase(serverId: string) {
    if (configuringDatabase.value) return
    configuringDatabase.value = dbConfigType.value
    showDbConfigModal.value = false
    infrastructureLogs.value = []
    send({
      type: 'CONFIGURE_DATABASE',
      serverId,
      database: dbConfigType.value,
      databaseName: dbConfigName.value || (dbConfigType.value === 'redis' ? undefined : 'serverflow'),
      securityOptions: dbSecurityOptions.value
    })
  }

  // Open reconfigure database modal
  function openReconfigureDatabaseModal(dbType: string) {
    reconfigureDbType.value = dbType
    reconfigureDbName.value = ''
    showReconfigureDatabaseModal.value = true
  }

  // Reconfigure database
  function reconfigureDatabase(serverId: string) {
    if (reconfiguringDatabase.value) return
    reconfiguringDatabase.value = reconfigureDbType.value
    showReconfigureDatabaseModal.value = false
    infrastructureLogs.value = []
    send({
      type: 'RECONFIGURE_DATABASE',
      serverId,
      database: reconfigureDbType.value,
      databaseName: reconfigureDbName.value || (reconfigureDbType.value === 'redis' ? undefined : 'serverflow_new')
    })
  }

  // Open remove database modal
  function openRemoveDatabaseModal(dbType: string) {
    databaseToRemove.value = dbType
    showRemoveDatabaseModal.value = true
  }

  // Remove database
  function removeDatabase(serverId: string) {
    if (removingDatabase.value || !databaseToRemove.value) return
    removingDatabase.value = databaseToRemove.value
    showRemoveDatabaseModal.value = false
    infrastructureLogs.value = []
    send({
      type: 'REMOVE_DATABASE',
      serverId,
      database: databaseToRemove.value
    })
  }

  // Open remove runtime modal
  function openRemoveRuntimeModal(runtime: string) {
    runtimeToRemove.value = runtime
    showRemoveRuntimeModal.value = true
  }

  // Fetch remote logs
  function fetchRemoteLogs(serverId: string) {
    fetchingRemoteLogs.value = true
    send({
      type: 'GET_INFRASTRUCTURE_LOGS',
      serverId
    })
  }

  // Clear remote logs
  function clearRemoteLogs(serverId: string) {
    send({
      type: 'CLEAR_INFRASTRUCTURE_LOGS',
      serverId
    })
    infrastructureLogs.value = []
    remoteLogFilePath.value = null
  }

  // Clear local logs
  function clearInfraLogs() {
    infrastructureLogs.value = []
  }

  // Copy logs to clipboard
  function copyInfraLogs() {
    const text = infrastructureLogs.value.map(l => l.message).join('\n')
    navigator.clipboard.writeText(text)
  }

  // Fetch service logs
  function fetchServiceLogs(serverId: string, service: string) {
    infrastructureLogs.value = []
    send({
      type: 'GET_SERVICE_LOGS',
      serverId,
      service
    })
  }

  // Copy connection string
  function copyConnectionString() {
    if (lastConnectionString.value) {
      navigator.clipboard.writeText(lastConnectionString.value)
    }
  }

  // Register WebSocket handlers
  function registerHandlers(serverId: string, onStatusRefresh?: () => void) {
    const unsubs: (() => void)[] = []

    unsubs.push(onMessage('SERVER_STATUS_RESPONSE', (msg) => {
      if (msg.serverId === serverId) {
        infraStatus.value = msg.status
        infraStatusLoading.value = false
      }
    }))

    unsubs.push(onMessage('RUNTIME_INSTALLED', (msg) => {
      if (msg.serverId === serverId) {
        installingRuntime.value = null
        if (msg.success) {
          requestServerStatus(serverId)
        }
      }
    }))

    unsubs.push(onMessage('RUNTIME_UPDATED', (msg) => {
      if (msg.serverId === serverId) {
        updatingRuntime.value = null
        if (msg.success) {
          requestServerStatus(serverId)
        }
      }
    }))

    unsubs.push(onMessage('RUNTIME_REMOVED', (msg) => {
      if (msg.serverId === serverId) {
        removingRuntime.value = null
        if (msg.success) {
          requestServerStatus(serverId)
        }
      }
    }))

    unsubs.push(onMessage('DATABASE_CONFIGURED', (msg) => {
      if (msg.serverId === serverId) {
        configuringDatabase.value = null
        if (msg.success && msg.connectionString) {
          lastConnectionString.value = msg.connectionString
          showConnectionStringModal.value = true
          requestServerStatus(serverId)
        }
      }
    }))

    unsubs.push(onMessage('DATABASE_RECONFIGURED', (msg) => {
      if (msg.serverId === serverId) {
        reconfiguringDatabase.value = null
        showReconfigureDatabaseModal.value = false
        if (msg.success && msg.connectionString) {
          lastConnectionString.value = msg.connectionString
          showConnectionStringModal.value = true
          requestServerStatus(serverId)
        }
      }
    }))

    unsubs.push(onMessage('DATABASE_REMOVED', (msg) => {
      if (msg.serverId === serverId) {
        removingDatabase.value = null
        if (msg.success) {
          requestServerStatus(serverId)
        }
      }
    }))

    unsubs.push(onMessage('INFRASTRUCTURE_LOG', (msg) => {
      if (msg.serverId === serverId) {
        infrastructureLogs.value.push({
          message: msg.message,
          stream: msg.stream || 'stdout'
        })
      }
    }))

    unsubs.push(onMessage('INFRASTRUCTURE_LOGS_RESPONSE', (msg) => {
      if (msg.serverId === serverId) {
        fetchingRemoteLogs.value = false
        if (msg.logs) {
          infrastructureLogs.value = msg.logs.map((l: any) => ({
            message: l.message || l,
            stream: l.stream || 'stdout'
          }))
        }
        if (msg.filePath) {
          remoteLogFilePath.value = msg.filePath
        }
      }
    }))

    unsubs.push(onMessage('SERVICE_LOGS_RESPONSE', (msg) => {
      if (msg.serverId === serverId && msg.logs) {
        infrastructureLogs.value = msg.logs.map((line: string) => ({
          message: line,
          stream: 'stdout' as const
        }))
      }
    }))

    return () => unsubs.forEach(fn => fn())
  }

  return {
    // State
    infraStatus,
    infraStatusLoading,
    installingRuntime,
    updatingRuntime,
    removingRuntime,
    configuringDatabase,
    reconfiguringDatabase,
    removingDatabase,
    infrastructureLogs,
    fetchingRemoteLogs,
    remoteLogFilePath,
    // Modal state
    showDbConfigModal,
    dbConfigType,
    dbConfigName,
    lastConnectionString,
    showConnectionStringModal,
    showRemoveRuntimeModal,
    runtimeToRemove,
    showRemoveDatabaseModal,
    databaseToRemove,
    showReconfigureDatabaseModal,
    reconfigureDbType,
    reconfigureDbName,
    dbSecurityOptions,
    // Functions
    requestServerStatus,
    installRuntime,
    updateRuntime,
    removeRuntime,
    openDbConfigModal,
    configureDatabase,
    openReconfigureDatabaseModal,
    reconfigureDatabase,
    openRemoveDatabaseModal,
    removeDatabase,
    openRemoveRuntimeModal,
    fetchRemoteLogs,
    clearRemoteLogs,
    clearInfraLogs,
    copyInfraLogs,
    fetchServiceLogs,
    copyConnectionString,
    registerHandlers
  }
}
