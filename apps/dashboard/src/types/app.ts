export interface App {
  id: string
  name: string
  repoUrl: string
  nodeId: string
  port: number
  ports?: string // JSON string of PortConfig[]
  detectedPorts?: string
  status?: string
  env?: string
}

export interface PortConfig {
  port: number
  name: string
  isMain: boolean
}

export interface NewAppForm {
  name: string
  repoUrl: string
  serverId: string
  port: number
  ports: PortConfig[]
  env: string
}

export interface DeployLog {
  data: string
  stream: 'stdout' | 'stderr'
}

export interface RestoreBranch {
  name: string
  commit: string
  date?: string
}

export interface RestoreCommit {
  hash: string
  message: string
  date: string
  author?: string
}
