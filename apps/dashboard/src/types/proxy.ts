export interface Proxy {
  id: string
  domain: string
  port: number
  nodeId: string
  appId?: string
  sslEnabled?: boolean
  createdAt?: number
}

export interface NewProxyForm {
  domain: string
  port: number
  targetMode: 'existing' | 'git'
  selectedAppId?: string
  gitUrl?: string
  appName?: string
}
