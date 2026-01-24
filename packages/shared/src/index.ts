import { z } from 'zod';

export const ExampleSchema = z.object({
  foo: z.string()
});

export type Example = z.infer<typeof ExampleSchema>;

// WebSocket Protocol Messages

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CHALLENGE'), nonce: z.string() }),
  z.object({ type: z.literal('AUTHORIZED'), sessionId: z.string() }),
  z.object({ type: z.literal('ERROR'), message: z.string() }),
  z.object({ type: z.literal('REGISTERED'), serverId: z.string() }),
  z.object({
    type: z.literal('SERVER_STATUS'),
    serverId: z.string(),
    status: z.enum(['online', 'offline'])
  }),
  z.object({
    type: z.literal('DEPLOY'),
    repoUrl: z.string(),
    commitHash: z.string().optional(),
    branch: z.string().optional(),
    port: z.number().optional(),
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
  })
]);

export const AgentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CONNECT'), pubKey: z.string() }),
  z.object({ type: z.literal('RESPONSE'), signature: z.string() }),
  z.object({ type: z.literal('REGISTER'), token: z.string(), pubKey: z.string() }),
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
  })
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
