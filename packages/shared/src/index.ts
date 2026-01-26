import { z } from 'zod';

export const ExampleSchema = z.object({
  foo: z.string()
});

export type Example = z.infer<typeof ExampleSchema>;

// ============================================
// Infrastructure Types (Story 7.7)
// ============================================

export type RuntimeType = 'nodejs' | 'python' | 'go' | 'docker' | 'rust' | 'ruby';
export type DatabaseType = 'postgresql' | 'mysql' | 'redis';

// Services système (ne peuvent pas être supprimés, juste configurés/redémarrés)
export type SystemServiceType = 'ssh' | 'cron';

// Services FTP (peuvent être installés/supprimés)
export type FtpServiceType = 'vsftpd' | 'proftpd';

// Services de stockage réseau (NFS)
export type StorageServiceType = 'nfs';

// Services réseau, sécurité, monitoring, etc.
export type InfraServiceType = 'nginx' | 'haproxy' | 'keepalived' | 'certbot' | 'fail2ban' | 'ufw' | 'wireguard' | 'pm2' | 'netdata' | 'loki' | 'bind9' | 'postfix' | 'dovecot' | 'rspamd' | 'opendkim' | 'rsync' | 'rclone' | 'restic';

// Tous les types de services
export type ServiceType = SystemServiceType | FtpServiceType | StorageServiceType | InfraServiceType;

// Liste des services système non-supprimables
export const PROTECTED_SERVICES: ServiceType[] = ['ssh', 'cron'];

export interface RuntimeInfo {
    type: RuntimeType;
    installed: boolean;
    version?: string;
    latestVersion?: string;
    updateAvailable?: boolean;
    estimatedSize: string;
}

export interface DatabaseInfo {
    type: DatabaseType;
    installed: boolean;
    running: boolean;
    version?: string;
}

export interface ServiceInfo {
    type: ServiceType;
    installed: boolean;
    running: boolean;
    version?: string;
    protected?: boolean; // Services système qui ne peuvent pas être supprimés (ssh, cron)
}

export interface SystemInfo {
    os: string;
    osVersion: string;
    cpu: number;
    ram: string;
    disk: string;
    uptime: string;
}

export interface ServerStatus {
    runtimes: RuntimeInfo[];
    databases: DatabaseInfo[];
    services: ServiceInfo[];
    system: SystemInfo;
}

// ============================================
// WebSocket Protocol Messages
// ============================================

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CHALLENGE'), nonce: z.string() }),
  z.object({ type: z.literal('AUTHORIZED'), sessionId: z.string() }),
  z.object({ type: z.literal('ERROR'), message: z.string() }),
  z.object({ type: z.literal('REGISTERED'), serverId: z.string(), cpPublicKey: z.string().optional() }),
  z.object({
    type: z.literal('SERVER_STATUS'),
    serverId: z.string(),
    status: z.enum(['online', 'offline'])
  }),
  z.object({
    type: z.literal('DEPLOY'),
    appId: z.string(),
    repoUrl: z.string(),
    commitHash: z.string().optional(),
    branch: z.string().optional(),
    port: z.number().optional(),
    ports: z.array(z.object({ port: z.number(), name: z.string(), isMain: z.boolean() })).optional(),
    env: z.record(z.string()).optional()
  }),
  z.object({
    type: z.literal('APP_ACTION'),
    appId: z.string(),
    action: z.enum(['START', 'STOP', 'RESTART', 'DELETE']),
    repoUrl: z.string()
  }),
  z.object({
    type: z.literal('DEPLOY_LOG'),
    serverId: z.string(),
    repoUrl: z.string(),
    data: z.string(),
    stream: z.enum(['stdout', 'stderr'])
  }),
  z.object({
    type: z.literal('DEPLOY_STATUS'),
    serverId: z.string(),
    repoUrl: z.string(),
    status: z.string()
  }),
  z.object({
    type: z.literal('PROVISION_DOMAIN'),
    domain: z.string(),
    port: z.number(),
    repoUrl: z.string(),
    appId: z.string().optional()
  }),
  z.object({
    type: z.literal('DELETE_PROXY'),
    serverId: z.string(),
    domain: z.string()
  }),
  z.object({
    type: z.literal('SYSTEM_LOG'),
    serverId: z.string(),
    data: z.string(),
    stream: z.enum(['stdout', 'stderr', 'system']),
    source: z.string().optional()
  }),
  z.object({
    type: z.literal('SERVICE_ACTION'),
    serverId: z.string(),
    service: z.enum(['nginx', 'pm2']),
    action: z.enum(['start', 'stop', 'restart', 'status'])
  }),
  // Infrastructure messages (Story 7.7)
  z.object({
    type: z.literal('GET_SERVER_STATUS'),
    serverId: z.string()
  }),
  z.object({
    type: z.literal('INSTALL_RUNTIME'),
    serverId: z.string(),
    runtime: z.enum(['python', 'go', 'docker', 'rust', 'ruby'])
  }),
  z.object({
    type: z.literal('UPDATE_RUNTIME'),
    serverId: z.string(),
    runtime: z.enum(['nodejs', 'python', 'go', 'docker', 'rust', 'ruby'])
  }),
  z.object({
    type: z.literal('CONFIGURE_DATABASE'),
    serverId: z.string(),
    database: z.enum(['postgresql', 'mysql', 'redis']),
    dbName: z.string(),
    // Security options (optional - defaults to secure if not provided)
    securityOptions: z.object({
      // MySQL/MariaDB specific
      setRootPassword: z.boolean().optional(),      // Generate and store root password
      removeAnonymousUsers: z.boolean().optional(), // Remove anonymous users
      disableRemoteRoot: z.boolean().optional(),    // Disable remote root access
      removeTestDb: z.boolean().optional(),         // Remove test database
      // PostgreSQL specific
      configureHba: z.boolean().optional(),         // Configure pg_hba.conf for password auth
      // Redis specific
      enableProtectedMode: z.boolean().optional(),  // Enable protected-mode
      // Common to all
      bindLocalhost: z.boolean().optional(),        // Bind to 127.0.0.1 only
    }).optional()
  }),
  // Agent Update (one-click update from dashboard)
  z.object({
    type: z.literal('UPDATE_AGENT'),
    serverId: z.string()
  }),
  // Agent Shutdown (server deletion from dashboard)
  z.object({
    type: z.literal('SHUTDOWN_AGENT'),
    serverId: z.string(),
    action: z.enum(['stop', 'uninstall']) // stop = arrête le service, uninstall = supprime tout
  }),
  // Infrastructure Logs (read logs from remote server)
  z.object({
    type: z.literal('GET_INFRASTRUCTURE_LOGS'),
    serverId: z.string(),
    lines: z.number().optional() // Number of lines to read (default: all)
  }),
  z.object({
    type: z.literal('CLEAR_INFRASTRUCTURE_LOGS'),
    serverId: z.string()
  }),
  // Service-specific logs (per runtime/database)
  z.object({
    type: z.literal('GET_SERVICE_LOGS'),
    serverId: z.string(),
    service: z.string(), // runtime or database type: python, go, docker, rust, ruby, postgresql, mysql, redis
    lines: z.number().optional()
  }),
  // Runtime/Database Removal (Story 7.7 Extension)
  z.object({
    type: z.literal('REMOVE_RUNTIME'),
    serverId: z.string(),
    runtime: z.enum(['go', 'docker', 'rust', 'ruby']), // Note: nodejs and python NOT allowed - required by agent/system
    purge: z.boolean() // true = remove config files too
  }),
  z.object({
    type: z.literal('REMOVE_DATABASE'),
    serverId: z.string(),
    database: z.enum(['postgresql', 'mysql', 'redis']),
    purge: z.boolean(), // true = remove config files
    removeData: z.boolean() // true = delete data directory (IRREVERSIBLE)
  }),
  // Database Reconfiguration (new password or new database)
  z.object({
    type: z.literal('RECONFIGURE_DATABASE'),
    serverId: z.string(),
    database: z.enum(['postgresql', 'mysql', 'redis']),
    dbName: z.string(),
    resetPassword: z.boolean() // true = generate new password only, false = create new database
  })
]);

export const AgentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CONNECT'), pubKey: z.string(), version: z.string().optional() }),
  z.object({ type: z.literal('RESPONSE'), signature: z.string() }),
  z.object({ type: z.literal('REGISTER'), token: z.string(), pubKey: z.string(), version: z.string().optional() }),
  z.object({
    type: z.literal('LOG_STREAM'),
    data: z.string(),
    stream: z.enum(['stdout', 'stderr']),
    repoUrl: z.string()
  }),
  z.object({
    type: z.literal('STATUS_UPDATE'),
    repoUrl: z.string(),
    status: z.string()
  }),
  z.object({
    type: z.literal('DETECTED_PORTS'),
    appId: z.string(),
    repoUrl: z.string(),
    ports: z.array(z.number())
  }),
  // Infrastructure response messages (Story 7.7)
  z.object({
    type: z.literal('SERVER_STATUS_RESPONSE'),
    serverId: z.string(),
    status: z.object({
      runtimes: z.array(z.object({
        type: z.string(),
        installed: z.boolean(),
        version: z.string().optional(),
        latestVersion: z.string().optional(),
        updateAvailable: z.boolean().optional(),
        estimatedSize: z.string()
      })),
      databases: z.array(z.object({
        type: z.string(),
        installed: z.boolean(),
        running: z.boolean(),
        version: z.string().optional()
      })),
      services: z.array(z.object({
        type: z.string(),
        installed: z.boolean(),
        running: z.boolean(),
        version: z.string().optional(),
        protected: z.boolean().optional()
      })),
      system: z.object({
        os: z.string(),
        osVersion: z.string(),
        cpu: z.number(),
        ram: z.string(),
        disk: z.string(),
        uptime: z.string()
      })
    })
  }),
  z.object({
    type: z.literal('INFRASTRUCTURE_LOG'),
    serverId: z.string(),
    message: z.string(),
    stream: z.enum(['stdout', 'stderr'])
  }),
  z.object({
    type: z.literal('RUNTIME_INSTALLED'),
    serverId: z.string(),
    runtime: z.string(),
    success: z.boolean(),
    version: z.string().optional(),
    error: z.string().optional()
  }),
  z.object({
    type: z.literal('RUNTIME_UPDATED'),
    serverId: z.string(),
    runtime: z.string(),
    success: z.boolean(),
    oldVersion: z.string().optional(),
    newVersion: z.string().optional(),
    error: z.string().optional()
  }),
  z.object({
    type: z.literal('DATABASE_CONFIGURED'),
    serverId: z.string(),
    database: z.string(),
    success: z.boolean(),
    connectionString: z.string().optional(),
    error: z.string().optional()
  }),
  // Agent Update Response
  z.object({
    type: z.literal('AGENT_UPDATE_STATUS'),
    serverId: z.string(),
    status: z.enum(['downloading', 'installing', 'restarting', 'success', 'failed']),
    message: z.string().optional(),
    newVersion: z.string().optional()
  }),
  // Agent Update Log (streaming output during update)
  z.object({
    type: z.literal('AGENT_UPDATE_LOG'),
    serverId: z.string(),
    data: z.string(),
    stream: z.enum(['stdout', 'stderr'])
  }),
  // Agent Shutdown Acknowledgment
  z.object({
    type: z.literal('AGENT_SHUTDOWN_ACK'),
    serverId: z.string(),
    action: z.enum(['stop', 'uninstall'])
  }),
  // Infrastructure Logs Response
  z.object({
    type: z.literal('INFRASTRUCTURE_LOGS_RESPONSE'),
    serverId: z.string(),
    logs: z.string(),
    logFilePath: z.string()
  }),
  z.object({
    type: z.literal('INFRASTRUCTURE_LOGS_CLEARED'),
    serverId: z.string()
  }),
  // Service-specific logs response
  z.object({
    type: z.literal('SERVICE_LOGS_RESPONSE'),
    serverId: z.string(),
    service: z.string(),
    logs: z.string(),
    logFilePath: z.string(),
    hasLogs: z.boolean()
  }),
  // Runtime/Database Removal Responses (Story 7.7 Extension)
  z.object({
    type: z.literal('RUNTIME_REMOVED'),
    serverId: z.string(),
    runtime: z.string(),
    success: z.boolean(),
    error: z.string().optional()
  }),
  z.object({
    type: z.literal('DATABASE_REMOVED'),
    serverId: z.string(),
    database: z.string(),
    success: z.boolean(),
    error: z.string().optional()
  }),
  z.object({
    type: z.literal('DATABASE_RECONFIGURED'),
    serverId: z.string(),
    database: z.string(),
    success: z.boolean(),
    connectionString: z.string().optional(),
    error: z.string().optional()
  })
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
