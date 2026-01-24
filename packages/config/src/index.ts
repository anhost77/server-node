import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const ConfigSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = ConfigSchema.parse(process.env);
