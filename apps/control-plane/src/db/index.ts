import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import path from 'node:path';
import fs from 'node:fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const client = createClient({
    url: 'file:data/auth.db',
});

export const db = drizzle(client, { schema });
