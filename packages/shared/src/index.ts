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
    commitHash: z.string(),
    branch: z.string()
  })
]);

export const AgentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CONNECT'), pubKey: z.string() }),
  z.object({ type: z.literal('RESPONSE'), signature: z.string() }),
  z.object({ type: z.literal('REGISTER'), token: z.string(), pubKey: z.string() })
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
