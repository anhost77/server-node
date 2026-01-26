export type WSMessageType =
  | 'INITIAL_STATE'
  | 'SERVER_STATUS'
  | 'LOG_STREAM'
  | 'STATUS_UPDATE'
  | 'PROXIES_UPDATE'
  | 'APPS_UPDATE'
  | 'SYSTEM_LOG'
  | 'SERVER_STATUS_RESPONSE'
  | 'INFRASTRUCTURE_STATUS'
  | 'INFRASTRUCTURE_LOG'
  | 'INFRASTRUCTURE_LOGS_RESPONSE'
  | 'RUNTIME_INSTALLED'
  | 'RUNTIME_UPDATED'
  | 'RUNTIME_REMOVED'
  | 'DATABASE_CONFIGURED'
  | 'DATABASE_REMOVED'
  | 'DATABASE_RECONFIGURED'
  | 'SERVICE_INSTALLED'
  | 'SERVICE_REMOVED'
  | 'SERVICE_STARTED'
  | 'SERVICE_STOPPED'
  | 'DATABASE_STARTED'
  | 'DATABASE_STOPPED'
  | 'AGENT_UPDATE_STATUS'
  | 'AGENT_UPDATE_LOG'
  | 'SERVICE_LOGS_RESPONSE'

export interface WSMessage {
  type: WSMessageType
  [key: string]: unknown
}

export interface ConsoleLog {
  timestamp: number
  data: string
  stream: 'stdout' | 'stderr' | 'system'
  type: string
  serverId: string
}

export interface InfrastructureLog {
  message: string
  stream: 'stdout' | 'stderr'
}

export interface SSHSession {
  id: string | null
  status: 'idle' | 'connecting' | 'preflight' | 'installing' | 'complete' | 'error'
  step: number
  totalSteps: number
  message: string
  output: string[]
}

export interface SSHForm {
  host: string
  port: number
  username: string
  password: string
  privateKey: string
  authType: 'password' | 'key'
  verbose: boolean
}
