export interface Server {
  id: string
  alias?: string
  status: 'online' | 'offline'
  agentVersion?: string
  hostname?: string
  ip?: string
  os?: string
  registeredAt?: number
  lastSeen?: number
  updateAvailable?: boolean
  domain?: string
  port?: number
}

export interface InfraStatus {
  runtimes: Runtime[]
  databases: Database[]
  system: SystemInfo
}

export interface Runtime {
  type: RuntimeType
  installed: boolean
  version?: string
  latestVersion?: string
  updateAvailable?: boolean
  estimatedSize: string
}

export type RuntimeType = 'nodejs' | 'python' | 'go' | 'docker' | 'rust' | 'ruby'

export interface Database {
  type: DatabaseType
  installed: boolean
  running: boolean
  version?: string
}

export type DatabaseType = 'postgresql' | 'mysql' | 'redis'

export interface SystemInfo {
  os: string
  osVersion: string
  cpu: number
  ram: string
  disk: string
  uptime: string
}

export interface DbSecurityOptions {
  // MySQL/MariaDB specific
  setRootPassword?: boolean
  removeAnonymousUsers?: boolean
  disableRemoteRoot?: boolean
  removeTestDb?: boolean
  // PostgreSQL specific
  configureHba?: boolean
  // Redis specific
  enableProtectedMode?: boolean
  // Common to all
  bindLocalhost?: boolean
}
