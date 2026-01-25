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

export interface RuntimeInfo {
    type: RuntimeType;
    installed: boolean;
    version?: string;
    estimatedSize: string;
}

export interface DatabaseInfo {
    type: DatabaseType;
    installed: boolean;
    running: boolean;
    version?: string;
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
    type: z.literal('CONFIGURE_DATABASE'),
    serverId: z.string(),
    database: z.enum(['postgresql', 'mysql', 'redis']),
    dbName: z.string()
  }),
  // Agent Update (one-click update from dashboard)
  z.object({
    type: z.literal('UPDATE_AGENT'),
    serverId: z.string()
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
        estimatedSize: z.string()
      })),
      databases: z.array(z.object({
        type: z.string(),
        installed: z.boolean(),
        running: z.boolean(),
        version: z.string().optional()
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
  })
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
